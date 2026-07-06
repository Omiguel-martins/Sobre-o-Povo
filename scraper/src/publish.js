import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Service Key (não a anon key)
const STORAGE_BUCKET = 'imagens-noticias';

// ─────────────────────────────────────────────
// Inicializa o cliente Supabase (Service Role)
// ─────────────────────────────────────────────
function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_KEY não definidos nas variáveis de ambiente.');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ─────────────────────────────────────────────
// Verifica se a notícia já existe no banco
// pelo slug ou pela URL de origem
// ─────────────────────────────────────────────
async function isDuplicate(supabase, slug, sourceUrl) {
  // Checa por slug
  const { data: bySlug } = await supabase
    .from('noticias')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (bySlug) return true;

  // Checa por URL de origem (campo credits contém a URL original)
  const { data: bySource } = await supabase
    .from('noticias')
    .select('id')
    .ilike('credits', `%${sourceUrl}%`)
    .maybeSingle();

  return !!bySource;
}

// ─────────────────────────────────────────────
// Baixa a imagem e faz upload no Supabase Storage
// Retorna a URL pública da imagem
// ─────────────────────────────────────────────
async function uploadCoverImage(supabase, imageUrl, slug) {
  if (!imageUrl) {
    console.log(`  📷 Sem imagem de capa para: ${slug}. Usando placeholder.`);
    return null;
  }

  try {
    console.log(`  📥 Baixando imagem de capa...`);
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SobreOPovoBot/1.0)',
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
      console.error(`  ⚠️  Falha no upload da imagem: ${error.message}`);
      return imageUrl; // Usa a URL original como fallback
    }

    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    console.log(`  ✅ Imagem enviada ao Supabase Storage.`);
    return publicUrlData.publicUrl;
  } catch (err) {
    console.error(`  ⚠️  Não foi possível baixar a imagem de ${imageUrl}: ${err.message}`);
    return imageUrl; // Usa URL original como fallback
  }
}

// ─────────────────────────────────────────────
// Insere uma notícia no banco de dados
// ─────────────────────────────────────────────
async function insertArticle(supabase, article, publicImageUrl) {
  const payload = {
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    category: article.category,
    author: 'Redação',
    image: publicImageUrl || article.originalImageUrl || null,
    content: article.content,
    featured: false,
    credits: article.credits,
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
      // 1. Verificar duplicidade
      const duplicate = await isDuplicate(supabase, article.slug, article.sourceUrl);
      if (duplicate) {
        console.log(`  ⏭️  Já publicado. Pulando.`);
        stats.skipped++;
        continue;
      }

      // 2. Upload da imagem de capa
      const publicImageUrl = await uploadCoverImage(supabase, article.originalImageUrl, article.slug);

      // 3. Inserir no banco
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
