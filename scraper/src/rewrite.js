import { GoogleGenerativeAI } from '@google/generative-ai';
import slugify from 'slugify';

// Obtém a pool de chaves do Gemini (suporta múltiplas chaves separadas por vírgula)
const getApiKeyPool = () => {
  const raw = process.env.GEMINI_API_KEY;
  if (!raw) return [];
  return raw.split(',').map(k => k.trim()).filter(Boolean);
};

// Categorias suportadas pelo portal
const VALID_CATEGORIES = ['Brasil', 'Política', 'Cidades', 'Economia', 'Cultura', 'Celebridades', 'Opinião'];

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
2. O texto final deve ser completamente original — NUNCA copie frases inteiras da fonte original.
3. Use linguagem jornalística clara, objetiva e acessível para o grande público.
4. Estruture o conteúdo em HTML semântico usando apenas: <p>, <strong>, <em>, <ul>, <li>, <h3>
5. O corpo deve ter no mínimo 3 parágrafos.
6. Classifique a matéria em uma categoria. Você DEVE escolher OBRIGATORIAMENTE e estritamente uma das seguintes 7 categorias oficiais do portal: "Brasil", "Política", "Cidades", "Economia", "Cultura", "Celebridades" ou "Opinião". NUNCA crie, invente ou utilize novas categorias fora deste conjunto sob nenhuma circunstância. Todo e qualquer assunto deve ser enquadrado em uma destas 7 opções.
   - Assuntos policiais, trânsito local, acidentes, saneamento, prefeituras ou fatos do cotidiano regional de MT ➡️ "Cidades"
   - Esportes nacionais, geral de prefeituras distantes, notícias do país ou internacionais gerais ➡️ "Brasil"
   - Judiciário, emendas, STF, decisões governamentais ou debates de governantes ➡️ "Política"
   - Negócios locais, agronegócio, inovações financeiras ou dados de emprego ➡️ "Economia"
   - Festivais, prêmios artísticos, gastronomia, música, eventos culturais e arte ➡️ "Cultura"
   - Casamento de famosos, mortes de estrelas, reality shows ou fofocas de celebridades ➡️ "Celebridades"
   - Crônicas pessoais, artigos assinados ou editoriais do portal ➡️ "Opinião"
7. Escreva a ficha técnica/créditos no campo "credits" focando sempre nas fontes oficiais da informação primária mencionadas na notícia (como prefeituras, batalhões da polícia, delegacias, Politec, etc.), omitindo o link ou nome do portal concorrente de origem (como G1, Resumo MT, Olhar Direto). Exemplos de formatos recomendados:
   - Se for investigação criminal ou perícia: "Informações oficiais da [Delegacia/Órgão investigador] e Perícia Oficial e Identificação Técnica (Politec) de Mato Grosso"
   - Se for policiamento ou flagrante/BO: "Dados obtidos com o [Batalhão] da Polícia Militar e boletim de ocorrência registrado pela Polícia Civil de MT"
   - Se for matéria geral de prefeitura ou órgão público: "Dados obtidos junto à [Prefeitura/Secretaria/Órgão Oficial] de [Cidade/MT] e assessoria de comunicação oficial"
   - Caso genérico (se nenhuma fonte for citada): "Informações coletadas junto a órgãos públicos e assessorias de Mato Grosso"

**RETORNE APENAS um JSON válido no seguinte formato, sem markdown, sem explicações extras:**
{
  "title": "Título reescrito original (máx 120 chars)",
  "summary": "Resumo reescrito original de 1-2 frases (máx 280 chars)",
  "category": "UMA das categorias listadas",
  "content": "<p>Corpo HTML completo reescrito...</p>",
  "credits": "Ficha técnica gerada de acordo com as instruções do item 7"
}
`;

  const result = await model.generateContent(prompt);
  const rawText = result.response.text().trim();

  // Remove backticks de markdown se presentes
  const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  const parsed = JSON.parse(jsonText);

  // Normaliza a categoria (Title Case e remove espaços extras)
  if (typeof parsed.category === 'string') {
    let cat = parsed.category.trim();
    if (cat.length > 0) {
      // Capitaliza a primeira letra de cada palavra ou apenas a primeira letra global
      parsed.category = cat.charAt(0).toUpperCase() + cat.slice(1);
    } else {
      parsed.category = 'Brasil';
    }
  } else {
    parsed.category = 'Brasil';
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
// Executa a requisição ao Gemini com lógica de Retry (429/503)
// ─────────────────────────────────────────────
async function rewriteArticleWithRetry(model, rawArticle, maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await rewriteArticle(model, rawArticle);
    } catch (err) {
      attempt++;
      const isRateLimit = err.message.includes('429') || err.message.includes('Quota exceeded') || err.message.includes('Too Many Requests');
      const isServiceUnavailable = err.message.includes('503') || err.message.includes('Unavailable') || err.message.includes('high demand');

      if ((isRateLimit || isServiceUnavailable) && attempt < maxRetries) {
        // Aguarda 60 segundos antes de tentar novamente para garantir a liberação da cota do Free Tier
        const waitTime = 60000;
        console.warn(`  ⚠️  Erro temporário na API do Gemini (${err.message.slice(0, 100)}...). Tentativa ${attempt}/${maxRetries}. Aguardando 60s para tentar novamente...`);
        await new Promise((r) => setTimeout(r, waitTime));
      } else {
        throw err; // Erro fatal ou esgotou as tentativas de revalidação
      }
    }
  }
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

  const apiKeys = getApiKeyPool();
  if (apiKeys.length === 0) {
    throw new Error('GEMINI_API_KEY não definida nas variáveis de ambiente.');
  }

  let currentKeyIndex = 0;
  
  const getModel = (index) => {
    const genAI = new GoogleGenerativeAI(apiKeys[index]);
    return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  };

  let model = getModel(currentKeyIndex);
  const rewritten = [];
  const DELAY_MS = 55000; // 55 segundos de delay garante segurança máxima contra o limite de 5 RPM do Free Tier

  for (let i = 0; i < rawArticles.length; i++) {
    const article = rawArticles[i];
    console.log(`  [${i + 1}/${rawArticles.length}] Reescrevendo: "${article.title.slice(0, 60)}..."`);

    let success = false;
    let attemptsWithKeys = 0;

    while (!success && attemptsWithKeys < apiKeys.length) {
      try {
        const result = await rewriteArticleWithRetry(model, article, 2);
        rewritten.push(result);
        console.log(`  ✅ Sucesso — Categoria: ${result.category} | Slug: ${result.slug}`);
        success = true;
      } catch (err) {
        const errStr = err.message || '';
        const isBillingOrKeyError = errStr.includes('403') || errStr.includes('Forbidden') || errStr.toLowerCase().includes('dunning') || errStr.toLowerCase().includes('api key') || errStr.toLowerCase().includes('api_key');
        const isQuotaError = errStr.includes('429') || errStr.includes('Quota exceeded') || errStr.toLowerCase().includes('too many requests');

        if ((isBillingOrKeyError || isQuotaError) && apiKeys.length > 1) {
          attemptsWithKeys++;
          if (attemptsWithKeys < apiKeys.length) {
            currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
            console.warn(`  ⚠️  Falha com a chave no índice ${currentKeyIndex - 1} (${errStr.slice(0, 100)}...). Rotacionando para a chave reserva no índice ${currentKeyIndex}...`);
            model = getModel(currentKeyIndex);
            // Aguarda um pequeno intervalo de 2 segundos antes de tentar novamente com a nova chave
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
        }
        
        console.error(`  ❌ Falha definitiva ao reescrever artigo "${article.title}": ${errStr}`);
        break; // Sai do loop para este artigo se esgotar chaves ou for erro definitivo
      }
    }

    // Delay preventivo para respeitar o limite de 5 requisições por minuto da chave ativa atual
    if (success && i < rawArticles.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n📝 Total reescrito: ${rewritten.length} de ${rawArticles.length} artigos.`);
  return rewritten;
}