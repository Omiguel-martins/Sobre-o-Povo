import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Service Key (não a anon key)
const STORAGE_BUCKET = 'imagens-noticias';
const DEFAULT_COVER_IMAGE = 'https://sobreopovo.com.br/assets/logosemfundo.png';

// ─────────────────────────────────────────────
// Inicializa o cliente Supabase (Service Role)
// ─────────────────────────────────────────────
export function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_KEY não definidos nas variáveis de ambiente.');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

import { areNewsDuplicates } from './dedup.js';

// ─────────────────────────────────────────────
// Verifica se a notícia já existe no banco
// pelo slug, pela URL de origem ou por detecção
// de mesmo fato (últimas 72 horas)
// ─────────────────────────────────────────────
export async function isDuplicate(supabase, slug, sourceUrl, title, summary = '') {
  // 1. Checa por slug exato
  if (slug) {
    const { data: bySlug } = await supabase
      .from('noticias')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (bySlug) return true;
  }

  // 2. Checa por URL de origem na coluna dedicada source_url e legados
  if (sourceUrl) {
    const cleanUrl = sourceUrl.trim();
    const { data: bySourceCol } = await supabase
      .from('noticias')
      .select('id')
      .eq('source_url', cleanUrl)
      .maybeSingle();

    if (bySourceCol) return true;

    // Checa ocorrência em content (comentário HTML) ou credits legado
    const { data: byLegacy } = await supabase
      .from('noticias')
      .select('id')
      .or(`content.ilike.%${cleanUrl}%,credits.ilike.%${cleanUrl}%`)
      .maybeSingle();

    if (byLegacy) return true;
  }

  // 3. Checa detecção de mesmo fato nas últimas 72 horas (portais diferentes cobrindo a mesma pauta)
  if (title) {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: recentNews } = await supabase
      .from('noticias')
      .select('id, title, summary, source_url')
      .gte('date', threeDaysAgo.toISOString())
      .order('date', { ascending: false });

    if (recentNews && recentNews.length > 0) {
      for (const recent of recentNews) {
        const check = areNewsDuplicates(
          { title, summary, sourceUrl },
          recent
        );
        if (check.isDuplicate) {
          console.log(`  ⚠️  Bloqueado por duplicidade de fato (${check.reason}) com matéria existente: "${recent.title}"`);
          return true;
        }
      }
    }
  }

  return false;
}

// ─────────────────────────────────────────────
// Baixa a imagem e faz upload no Supabase Storage
// Retorna a URL pública da imagem no Supabase CDN ou imagem padrão do portal
// ─────────────────────────────────────────────
async function uploadCoverImage(supabase, imageUrl, slug) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    console.log(`  📷 Sem imagem de capa na matéria: "${slug}". Usando capa padrão do portal.`);
    return DEFAULT_COVER_IMAGE;
  }

  const cleanUrl = imageUrl.trim();
  if (cleanUrl.toLowerCase() === 'none' || cleanUrl.toLowerCase() === 'null' || (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://'))) {
    console.log(`  📷 URL de imagem inválida descartada: "${cleanUrl}". Usando capa padrão.`);
    return DEFAULT_COVER_IMAGE;
  }

  try {
    console.log(`  📥 Baixando imagem de capa original: ${cleanUrl.slice(0, 80)}...`);
    const response = await axios.get(cleanUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    const extension = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
      ? 'webp'
      : 'jpg';

    const fileName = `${slug}-${Date.now()}.${extension}`;
    const buffer = Buffer.from(response.data);

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, buffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error(`  ⚠️ Falha no upload para o Supabase Storage: ${error.message}. Mantendo URL de origem.`);
      return cleanUrl; // Fallback para a URL direta se for HTTP/HTTPS válida
    }

    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    console.log(`  ✅ Imagem re-hospedada com sucesso no Supabase CDN.`);
    return publicUrlData.publicUrl;
  } catch (err) {
    console.error(`  ⚠️ Não foi possível baixar a imagem original (${err.message}). Usando capa padrão.`);
    return cleanUrl.startsWith('http') ? cleanUrl : DEFAULT_COVER_IMAGE;
  }
}

// ─────────────────────────────────────────────
// Insere uma notícia no banco de dados
// ─────────────────────────────────────────────
async function insertArticle(supabase, article, publicImageUrl) {
  const finalImage = (publicImageUrl && publicImageUrl !== 'null' && publicImageUrl !== 'undefined')
    ? publicImageUrl
    : DEFAULT_COVER_IMAGE;

  // Garante que o comentário invisível com a URL de origem esteja no final do conteúdo
  const cleanSourceUrl = article.sourceUrl ? article.sourceUrl.trim() : '';
  const finalContent = cleanSourceUrl
    ? `${article.content}\n<!-- source_url: ${cleanSourceUrl} -->`
    : article.content;

  const payload = {
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    category: article.category,
    author: 'Redação',
    image: finalImage,
    content: finalContent,
    featured: false,
    credits: article.credits,
    source_url: cleanSourceUrl || null,
    date: new Date().toISOString(),
  };

  const { error } = await supabase.from('noticias').insert(payload);

  if (error) {
    throw new Error(`Falha ao inserir no banco: ${error.message}`);
  }

  return payload;
}

// ─────────────────────────────────────────────
// Função principal de publicação
// ─────────────────────────────────────────────
export async function publishArticles(rewrittenArticles, dryRun = false) {
  console.log('\n🚀 MÓDULO DE PUBLICAÇÃO — Enviando para o Supabase...\n');

  if (dryRun) {
    console.log('  [DRY-RUN] Modo de teste: simulando publicação sem gravar no banco.\n');
    for (const article of rewrittenArticles) {
      console.log(`  📰 [SIMULADO] "${article.title}" | Categoria: ${article.category} | Slug: ${article.slug}`);
    }
    console.log(`\n  ✅ Dry-run concluído. ${rewrittenArticles.length} artigos seriam publicados.`);
    return { published: 0, skipped: 0, errors: 0, dryRun: true };
  }

  const supabase = createSupabaseClient();
  const stats = { published: 0, skipped: 0, errors: 0 };

  for (const article of rewrittenArticles) {
    console.log(`\n  📰 Processando: "${article.title.slice(0, 70)}..."`);

    try {
      // 1. Verificar duplicidade com o título e resumo reescritos
      const duplicate = await isDuplicate(supabase, article.slug, article.sourceUrl, article.title, article.summary);
      if (duplicate) {
        console.log(`  ⏭️  Já publicado. Pulando.`);
        stats.skipped++;
        continue;
      }

      // 2. Processar a imagem de capa original e enviar para o Supabase Storage
      const publicImageUrl = await uploadCoverImage(supabase, article.originalImageUrl, article.slug);

      // 3. Inserir no banco com garantia de imagem válida (ou fallback padrão do portal)
      await insertArticle(supabase, article, publicImageUrl);
      console.log(`  ✅ Publicado com sucesso! Slug: ${article.slug}`);
      stats.published++;
    } catch (err) {
      console.error(`  ❌ Erro ao publicar "${article.title}": ${err.message}`);
      stats.errors++;
    }
  }

  console.log(`\n📊 Resultado da publicação:`);
  console.log(`   ✅ Publicados: ${stats.published}`);
  console.log(`   ⏭️  Duplicados ignorados: ${stats.skipped}`);
  console.log(`   ❌ Erros: ${stats.errors}`);

  return stats;
}
