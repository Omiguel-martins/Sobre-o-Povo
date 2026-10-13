import { areNewsDuplicates, deduplicateBatch } from '../src/dedup.js';

console.log('🧪 Iniciando testes de validação da deduplicação inteligente...\n');

// Caso 1: As notícias de Querência que o usuário mostrou no print
const querencia1 = {
  title: 'Vereador de Querência e Mais Duas Pessoas Morrem em Acidente Grave na MT-109',
  summary: 'O parlamentar Andreilson da Silva de Souza, conhecido como André Silva, de 40 anos, faleceu...',
  body: 'Um grave acidente na MT-109 em Querência causou a morte do vereador Andreilson...',
  sourceUrl: 'https://olhardireto.com.br/noticias/querencia-1',
  sourceName: 'Olhar Direto',
  imageUrl: 'https://foto.com/1.jpg'
};

const querencia2 = {
  title: 'Tragédia em Querência: Vereador e Duas Mulheres Perdem a Vida em Capotamento na Rodovia',
  summary: 'Um grave acidente automobilístico na tarde deste sábado (10) em Querência, Mato Grosso...',
  body: 'O capotamento na rodovia MT-109 tirou a vida do vereador de Querência e duas mulheres...',
  sourceUrl: 'https://midianews.com.br/noticias/querencia-2',
  sourceName: 'MidiaNews',
  imageUrl: 'https://foto.com/2.jpg'
};

const querencia3 = {
  title: 'Querência Chora: Vereador e Duas Mulheres Morrem em Fatal Acidente Rodoviário',
  summary: 'Um grave acidente de carro na tarde de sábado (10) em Querência, Mato Grosso...',
  body: 'O vereador de Querência e duas passageiras não resistiram ao acidente na rodovia...',
  sourceUrl: 'https://resumomt.com.br/noticias/querencia-3',
  sourceName: 'Resumo MT',
  imageUrl: 'https://foto.com/3.jpg'
};

// Caso 2: Notícias de Juscimeira
const juscimeira1 = {
  title: 'Homicídio Choca Juscimeira: Homem é Encontrado Morto com Marcas de Tiro à Frente de Sua Residência',
  summary: 'Genivaldo Anacleto do Nascimento, de 41 anos, foi descoberto sem vida...',
  sourceUrl: 'https://g1.globo.com/mt/juscimeira-1',
  sourceName: 'G1 MT'
};

const juscimeira2 = {
  title: 'Tragédia em Juscimeira: Homem é Encontrado Morto com Ferimentos à Bala na Porta de Casa',
  summary: 'Um homem de 41 anos identificado como Genivaldo Anacleto do Nascimento foi morto a tiros...',
  sourceUrl: 'https://olhardireto.com.br/juscimeira-2',
  sourceName: 'Olhar Direto'
};

// Caso 3: Prêmio Nobel de Economia
const nobel1 = {
  title: 'Nobel de Economia de 2026: Robert E. Hall e Michael Woodford Recebem Prêmio por Contribuições à Estabilização Macroeconômica',
  sourceUrl: 'https://g1.globo.com/economia/nobel-1',
  sourceName: 'G1 Economia'
};

const nobel2 = {
  title: 'Nobel de Economia 2026: Americanos Robert Hall e Michael Woodford Premiados por Contribuições à Estabilização Econômica',
  sourceUrl: 'https://olhardireto.com.br/agro/nobel-2',
  sourceName: 'Olhar Direto'
};

// Caso 4: Notícias que NÃO devem ser consideradas duplicadas
const noticiaDiferenteA = {
  title: 'Cuiabá: Jovem de 21 anos morre após acidente de moto na Avenida Miguel Sutil',
  sourceUrl: 'https://g1.globo.com/cuiaba-acidente',
  sourceName: 'G1 MT'
};

const noticiaDiferenteB = {
  title: 'Acidente na Serra da Petrovina: Ônibus de viagem tomba em Pedra Preta e deixa feridos em MT',
  sourceUrl: 'https://olhardireto.com.br/pedra-preta-onibus',
  sourceName: 'Olhar Direto'
};

let errors = 0;

function check(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅ [PASS] ${label}`);
  } else {
    console.error(`  ❌ [FAIL] ${label} — Esperado: ${expected}, Obtido: ${actual}`);
    errors++;
  }
}

console.log('--- Testando Detecção de Duplicatas Reais ---');
const resQ1_Q2 = areNewsDuplicates(querencia1, querencia2);
console.log('Querência 1 vs Querência 2:', resQ1_Q2.reason);
check('Querência 1 vs Querência 2 detectada como duplicata', resQ1_Q2.isDuplicate, true);

const resQ1_Q3 = areNewsDuplicates(querencia1, querencia3);
console.log('Querência 1 vs Querência 3:', resQ1_Q3.reason);
check('Querência 1 vs Querência 3 detectada como duplicata', resQ1_Q3.isDuplicate, true);

const resJusc = areNewsDuplicates(juscimeira1, juscimeira2);
console.log('Juscimeira 1 vs Juscimeira 2:', resJusc.reason);
check('Juscimeira detectada como duplicata', resJusc.isDuplicate, true);

const resNobel = areNewsDuplicates(nobel1, nobel2);
console.log('Nobel 1 vs Nobel 2:', resNobel.reason);
check('Nobel de Economia detectado como duplicata', resNobel.isDuplicate, true);

console.log('\n--- Testando Falso-Positivo em Notícias Distintas ---');
const resDiff = areNewsDuplicates(noticiaDiferenteA, noticiaDiferenteB);
console.log('Cuiabá vs Pedra Preta:', resDiff.reason);
check('Notícias diferentes NÃO são consideradas duplicadas', resDiff.isDuplicate, false);

console.log('\n--- Testando Deduplicação Intra-Lote ---');
const batch = [querencia1, nobel1, querencia2, noticiaDiferenteA, querencia3, nobel2];
const deduped = deduplicateBatch(batch);
check('Batch original de 6 notícias reduzido para 3 notícias únicas', deduped.length, 3);

if (errors > 0) {
  console.error(`\n❌ Falhas: ${errors}`);
  process.exit(1);
} else {
  console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
  process.exit(0);
}
