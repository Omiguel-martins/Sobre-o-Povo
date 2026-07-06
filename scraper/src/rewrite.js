import { GoogleGenerativeAI } from '@google/generative-ai';
import slugify from 'slugify';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Categorias suportadas pelo portal
const VALID_CATEGORIES = ['Brasil', 'Política', 'Cidades', 'Economia', 'Cultura', 'Celebridades', 'Opinião'];

// ─────────────────────────────────────────────
// Inicializa o cliente Gemini
// ─────────────────────────────────────────────
function createGeminiClient() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não definida nas variáveis de ambiente.');
  }
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
}

// ─────────────────────────────────────────────
// Gera um slug seguro e único com timestamp
// ─────────────────────────────────────────────
function generateSlug(title) {
  const base = slugify(title, {
    lower: true,
    strict: true,
    locale: 'pt',
    trim: true,
  }).slice(0, 80);
  return base;
}

// ─────────────────────────────────────────────
// Reescreve um artigo usando a API do Gemini
// ─────────────────────────────────────────────
async function rewriteArticle(model, rawArticle) {
  const prompt = `
Você é um redator jornalístico sênior do portal de notícias brasileiro "Sobre o Povo", focado em Mato Grosso.

Sua tarefa é transformar a notícia original abaixo em uma matéria totalmente original, sem plágio, mantendo os fatos essenciais.

**NOTÍCIA ORIGINAL:**
Título: ${rawArticle.title}
Resumo: ${rawArticle.summary}
Corpo: ${rawArticle.body}
Fonte: ${rawArticle.sourceName} (${rawArticle.sourceUrl})

**INSTRUÇÕES:**
1. Reescreva completamente o texto, usando sinônimos, estrutura de frase diferente e ângulo editorial próprio.
2. O texto final deve ser completamente original — NUNCA copie frases inteiras da fonte.
3. Use linguagem jornalística clara, objetiva e acessível para o grande público.
4. Estruture o conteúdo em HTML semântico usando apenas: <p>, <strong>, <em>, <ul>, <li>, <h3>
5. O corpo deve ter no mínimo 3 parágrafos.
6. Classifique a matéria em UMA das categorias: Brasil, Política, Cidades, Economia, Cultura, Celebridades, Opinião.

**RETORNE APENAS um JSON válido no seguinte formato, sem markdown, sem explicações extras:**
{
  "title": "Título reescrito original (máx 120 chars)",
  "summary": "Resumo reescrito original de 1-2 frases (máx 280 chars)",
  "category": "UMA das categorias listadas",
  "content": "<p>Corpo HTML completo reescrito...</p>",
  "credits": "Matéria produzida com base em informações do ${rawArticle.sourceName}. Acesse o original em: ${rawArticle.sourceUrl}"
}
`;

  const result = await model.generateContent(prompt);
  const rawText = result.response.text().trim();

  // Remove backticks de markdown se presentes
  const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  const parsed = JSON.parse(jsonText);

  // Valida e normaliza a categoria
  if (!VALID_CATEGORIES.includes(parsed.category)) {
    parsed.category = 'Brasil'; // fallback seguro
  }

  return {
    slug: generateSlug(parsed.title),
    title: parsed.title,
    summary: parsed.summary,
    category: parsed.category,
    content: parsed.content,
    credits: parsed.credits,
    originalImageUrl: rawArticle.imageUrl,
    sourceUrl: rawArticle.sourceUrl,
    sourceName: rawArticle.sourceName,
  };
}

// ─────────────────────────────────────────────
// Função principal de reescrita
// ─────────────────────────────────────────────
export async function rewriteArticles(rawArticles, dryRun = false) {
  console.log('\n✍️  MÓDULO DE REESCRITA — Processando artigos com Gemini...\n');

  if (dryRun) {
    console.log('  [DRY-RUN] Modo de teste: simulando reescrita sem chamar a API do Gemini.\n');
    return rawArticles.map((article, i) => ({
      slug: `artigo-teste-dry-run-${i + 1}`,
      title: `[SIMULADO] ${article.title}`,
      summary: `[SIMULADO] ${article.summary || 'Resumo simulado para dry-run.'}`,
      category: VALID_CATEGORIES[i % VALID_CATEGORIES.length],
      content: `<p>[SIMULADO] ${article.body?.slice(0, 300) || 'Corpo simulado para dry-run.'}</p>`,
      credits: `Matéria baseada em: ${article.sourceName} — ${article.sourceUrl}`,
      originalImageUrl: article.imageUrl,
      sourceUrl: article.sourceUrl,
      sourceName: article.sourceName,
    }));
  }

  const model = createGeminiClient();
  const rewritten = [];
  const DELAY_MS = 2000; // Respeitar rate limiting da API

  for (let i = 0; i < rawArticles.length; i++) {
    const article = rawArticles[i];
    console.log(`  [${i + 1}/${rawArticles.length}] Reescrevendo: "${article.title.slice(0, 60)}..."`);

    try {
      const result = await rewriteArticle(model, article);
      rewritten.push(result);
      console.log(`  ✅ Sucesso — Categoria: ${result.category} | Slug: ${result.slug}`);
    } catch (err) {
      console.error(`  ❌ Falha ao reescrever artigo "${article.title}": ${err.message}`);
      // Continua para o próximo artigo sem interromper o pipeline
    }

    // Delay para não sobrecarregar a API
    if (i < rawArticles.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n📝 Total reescrito: ${rewritten.length} de ${rawArticles.length} artigos.`);
  return rewritten;
}
