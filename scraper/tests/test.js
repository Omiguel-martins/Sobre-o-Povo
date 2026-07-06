/**
 * Testes do Pipeline de Scraping — Sobre o Povo
 *
 * Uso: node tests/test.js
 *
 * Testa cada módulo de forma isolada com dados simulados (sem chamar APIs externas).
 */

import { rewriteArticles } from '../src/rewrite.js';
import { publishArticles } from '../src/publish.js';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

// ─────────────────────────────────────────────
// Dados de teste simulados
// ─────────────────────────────────────────────
const MOCK_RAW_ARTICLES = [
  {
    title: 'Prefeitura de Cuiabá inaugura nova UBS no bairro Praeiro',
    summary: 'A unidade atenderá cerca de 5 mil moradores da região.',
    body: 'A Prefeitura de Cuiabá inaugurou nesta quinta-feira uma nova Unidade Básica de Saúde no bairro Praeiro. A inauguração foi acompanhada pelo prefeito e secretários municipais. A nova unidade conta com médicos, enfermeiros e dentistas. A previsão é de atender cerca de 5 mil moradores da região norte da capital. O investimento foi de R$ 2,5 milhões provenientes de recursos federais e municipais.',
    imageUrl: 'https://example.com/ubs-cuiaba.jpg',
    sourceUrl: 'https://resumomt.com.br/noticias/prefeitura-cuiaba-ubs-praeiro',
    sourceName: 'Resumo MT',
  },
  {
    title: 'MT registra queda nos índices de desemprego no segundo trimestre',
    summary: 'Dados do IBGE mostram crescimento do emprego formal em Mato Grosso.',
    body: 'Segundo dados divulgados pelo IBGE nesta semana, Mato Grosso registrou uma queda de 1,2% na taxa de desemprego no segundo trimestre de 2026 em relação ao mesmo período do ano anterior. O setor do agronegócio foi o principal responsável pela geração de novos postos de trabalho. Especialistas indicam que o crescimento é sustentado pela safra de soja e algodão acima da média. No total, foram geradas cerca de 8 mil novas vagas formais no estado.',
    imageUrl: null,
    sourceUrl: 'https://olhardireto.com.br/noticias/mt-desemprego-queda',
    sourceName: 'Olhar Direto',
  },
];

// ─────────────────────────────────────────────
// Testes do Módulo de Reescrita (Dry-Run)
// ─────────────────────────────────────────────
async function testRewriteModule() {
  console.log('\n📋 TESTE 1 — Módulo de Reescrita (dry-run)\n');

  const result = await rewriteArticles(MOCK_RAW_ARTICLES, true);

  assert(Array.isArray(result), 'rewriteArticles retorna um array');
  assert(result.length === MOCK_RAW_ARTICLES.length, 'Número de artigos retornados é igual ao de entrada');

  const first = result[0];
  assert(typeof first.slug === 'string' && first.slug.length > 0, 'Slug gerado não está vazio');
  assert(typeof first.title === 'string' && first.title.length > 0, 'Título gerado não está vazio');
  assert(typeof first.summary === 'string' && first.summary.length > 0, 'Resumo gerado não está vazio');
  assert(typeof first.category === 'string' && first.category.length > 0, 'Categoria gerada não está vazia');
  assert(typeof first.content === 'string' && first.content.length > 0, 'Conteúdo HTML gerado não está vazio');
  assert(typeof first.credits === 'string' && first.credits.length > 0, 'Créditos gerados não estão vazios');
  assert(first.sourceUrl === MOCK_RAW_ARTICLES[0].sourceUrl, 'URL de origem preservada corretamente');
}

// ─────────────────────────────────────────────
// Testes do Módulo de Publicação (Dry-Run)
// ─────────────────────────────────────────────
async function testPublishModule() {
  console.log('\n📋 TESTE 2 — Módulo de Publicação (dry-run)\n');

  const mockRewritten = [
    {
      slug: 'prefeitura-cuiaba-inaugura-nova-ubs',
      title: 'Prefeitura de Cuiabá inaugura nova unidade de saúde',
      summary: 'Nova UBS beneficiará 5 mil moradores do bairro Praeiro.',
      category: 'Cidades',
      content: '<p>Conteúdo de teste para dry-run de publicação.</p>',
      credits: 'Matéria baseada em: Resumo MT',
      originalImageUrl: null,
      sourceUrl: 'https://resumomt.com.br/noticias/ubs-praeiro',
      sourceName: 'Resumo MT',
    },
  ];

  const stats = await publishArticles(mockRewritten, true);

  assert(stats.dryRun === true, 'publishArticles retorna dryRun: true no modo de teste');
  assert(stats.published === 0, 'Nenhum artigo é publicado no banco durante dry-run');
  assert(stats.skipped === 0, 'Contador de duplicados é 0 no dry-run');
  assert(stats.errors === 0, 'Nenhum erro ocorre no dry-run');
}

// ─────────────────────────────────────────────
// Testes de validação de interface de dados
// ─────────────────────────────────────────────
async function testDataContractValidation() {
  console.log('\n📋 TESTE 3 — Validação do Contrato de Interface de Dados\n');

  const result = await rewriteArticles(MOCK_RAW_ARTICLES, true);
  const REQUIRED_FIELDS_REWRITER = ['slug', 'title', 'summary', 'category', 'content', 'credits', 'originalImageUrl', 'sourceUrl'];

  for (const field of REQUIRED_FIELDS_REWRITER) {
    assert(
      field in result[0],
      `Campo obrigatório '${field}' presente na saída do módulo de reescrita`
    );
  }

  const VALID_CATEGORIES = ['Brasil', 'Política', 'Cidades', 'Economia', 'Cultura', 'Celebridades', 'Opinião'];
  assert(
    VALID_CATEGORIES.includes(result[0].category) || result[0].category.startsWith('[SIMULADO]'),
    'Categoria retornada é válida ou está no formato esperado para dry-run'
  );
}

// ─────────────────────────────────────────────
// Executa todos os testes
// ─────────────────────────────────────────────
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🧪 Sobre o Povo — Suite de Testes do Pipeline');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    await testRewriteModule();
    await testPublishModule();
    await testDataContractValidation();
  } catch (err) {
    console.error('\n❌ Erro inesperado durante os testes:', err);
    failed++;
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Resultado: ${passed} passaram | ${failed} falharam`);
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests();
