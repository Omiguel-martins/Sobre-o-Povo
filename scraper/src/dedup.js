/**
 * Módulo de Deduplicação Inteligente de Notícias — Sobre o Povo
 * 
 * Responsável por:
 * 1. Normalização de texto e extração de termos-chave e radicais (stemming leve em PT-BR)
 * 2. Detecção de âncoras (cidades de MT, nomes próprios, números de rodovias)
 * 3. Cálculo de similaridade híbrida (Jaccard, Overlap Coefficient e detecção de entidades)
 * 4. Deduplicação intra-lote (agrupamento de múltiplos portais cobrindo o mesmo fato)
 * 5. Deduplicação contra notícias salvas no banco de dados (últimos 3 dias)
 */

const STOP_WORDS = new Set([
  'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'nao', 'uma', 'os', 'no',
  'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'aqui',
  'sua', 'ou', 'ser', 'quando', 'muito', 'ha', 'nos', 'ja', 'esta', 'eu', 'tambem', 'so', 'pelo',
  'pela', 'ate', 'isso', 'ela', 'entre', 'era', 'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus',
  'quem', 'nas', 'me', 'esse', 'eles', 'estao', 'voce', 'tinha', 'foram', 'essa', 'num', 'nem',
  'suas', 'meu', 'as', 'minha', 'numa', 'pelos', 'elas', 'havia', 'seja', 'qual', 'sera', 'nos',
  'tenho', 'lhe', 'deles', 'essas', 'esses', 'pelas', 'este', 'fosse', 'dele', 'tu', 'te', 'voces',
  'vos', 'lhes', 'meus', 'minhas', 'teu', 'tua', 'teus', 'tuas', 'neste', 'nesta', 'nestes', 'nestas',
  'disso', 'disse', 'diz', 'apos', 'durante', 'segundo', 'sobre', 'novo', 'nova', 'novos', 'novas',
  'veja', 'confira', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo', 'feira',
  'nesta', 'neste', 'contra', 'apos', 'apos', 'dia', 'dias', 'ano', 'anos', 'mes', 'meses', 'onde',
  'quem', 'tudo', 'todos', 'todas', 'cada', 'outro', 'outra', 'outros', 'outras', 'bem', 'mal'
]);

// Cidades e regiões mato-grossenses frequentes
export const MT_CITIES = [
  'cuiaba', 'varzea grande', 'rondonopolis', 'sinop', 'sorriso', 'tangara da serra',
  'querencia', 'juscimeira', 'campo verde', 'aripuana', 'lucas do rio verde',
  'primavera do leste', 'barra do garcas', 'alta floresta', 'pontes e lacerda',
  'juina', 'caceres', 'pedra preta', 'chapada dos guimaraes', 'nova mutum',
  'pocone', 'colider', 'diamantino', 'confresa', 'vila rica', 'paranatinga'
];

// Palavras genéricas e institucionais que nunca devem ser consideradas âncoras/nomes próprios
const GENERIC_ANCHOR_WORDS = new Set([
  'mato', 'grosso', 'brasil', 'governo', 'estado', 'estadual', 'federal',
  'nacional', 'ministro', 'presidente', 'senador', 'deputado', 'prefeito',
  'prefeitura', 'secretaria', 'tribunal', 'justica', 'policia', 'militar', 'civil',
  'boletim', 'ocorrencia', 'informacoes', 'dados', 'recente', 'nesta', 'neste',
  'lula', 'bolsonaro', 'tragedia', 'encontrado', 'homicidio', 'morte', 'mortes',
  'acidente', 'acidentes', 'operacao', 'jovem', 'homem', 'mulher', 'crianca', 'criancas',
  'adolescente', 'corpo', 'caso', 'alerta', 'projeto', 'acao', 'decisao', 'pedido',
  'pesquisa', 'defesa', 'suspeito', 'vitima', 'vitimas', 'prisao', 'detido', 'preso',
  'veja', 'saiba', 'confira', 'apos', 'durante', 'frente', 'porta', 'casa', 'residencia',
  'rua', 'avenida', 'bairro', 'regiao', 'setor', 'veiculo', 'carro', 'moto', 'onibus',
  'caminhao', 'volta', 'chega', 'marca', 'revela', 'aponta', 'mostra', 'anuncia',
  'recebe', 'perde', 'ganha', 'lanca', 'morre', 'morrem', 'fatal', 'grave', 'urgente',
  'geral', 'especial', 'feira', 'domingo', 'sabado', 'segunda', 'terca', 'quarta', 'quinta', 'sexta'
]);

/**
 * Normaliza um texto: minúsculas, sem acentos, remove pontuação, padroniza rodovias
 */
export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\bmt\s*[-–—]?\s*(\d+)\b/g, 'mt$1') // "MT-109" -> "mt109"
    .replace(/\bbr\s*[-–—]?\s*(\d+)\b/g, 'br$1') // "BR-163" -> "br163"
    .replace(/[^\w\s]/g, ' ') // remove caracteres não-alfanuméricos
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Stemming simples para aproximar radicais comuns em português
 */
export function stemWord(word) {
  if (!word || word.length <= 3) return word;
  
  // Plurais simples
  if (word.endsWith('es') && word.length > 4) word = word.slice(0, -2);
  else if (word.endsWith('s') && !word.endsWith('ss') && word.length > 4) word = word.slice(0, -1);

  // Sufixos verbais/nominais frequentes em notícias
  if (word.endsWith('mente') && word.length > 6) return word.slice(0, -5);
  if (word.endsWith('amento') && word.length > 7) return word.slice(0, -6);
  if (word.endsWith('imento') && word.length > 7) return word.slice(0, -6);
  if (word.endsWith('acao') && word.length > 6) return word.slice(0, -4);
  if (word.endsWith('acoes') && word.length > 6) return word.slice(0, -5);
  
  // Radicais frequentes de jornalismo policial / cidades / economia
  if (/^morr/i.test(word)) return 'morr'; // morre, morrem, morreu, mortes, morto
  if (/^acident/i.test(word)) return 'acident'; // acidente, acidentes
  if (/^capot/i.test(word)) return 'capot'; // capotamento, capota, capotou
  if (/^rodovi/i.test(word)) return 'rodovi'; // rodovia, rodoviario, rodoviaria
  if (/^econom/i.test(word)) return 'econom'; // economia, economico, macroeconomica
  if (/^polic/i.test(word)) return 'polic'; // policia, policial, policiais
  if (/^assassin/i.test(word)) return 'assassin'; // assassinato, assassino
  if (/^homicid/i.test(word)) return 'homicid'; // homicidio, homicidios
  if (/^serralh/i.test(word)) return 'serralh'; // serralheiro
  if (/^profess/i.test(word)) return 'profess'; // professor
  if (/^afog/i.test(word)) return 'afog'; // afogamento, afoga

  return word;
}

/**
 * Extrai conjunto de palavras-chave normalizadas e lematizadas
 */
export function extractKeywords(text) {
  const norm = normalizeText(text);
  if (!norm) return new Set();

  const words = norm.match(/\w+/g) || [];
  const stems = words
    .filter(w => !STOP_WORDS.has(w) && w.length >= 3)
    .map(w => stemWord(w));

  return new Set(stems);
}

/**
 * Extrai âncoras (cidades de MT, rodovias e nomes próprios raros)
 */
export function extractAnchors(text) {
  const norm = normalizeText(text);
  const anchors = new Set();

  // Verifica cidades conhecidas de MT
  for (const city of MT_CITIES) {
    if (norm.includes(city)) {
      anchors.add(city);
    }
  }

  // Verifica códigos de rodovias (ex: mt109, br163)
  const highways = norm.match(/\b(mt\d+|br\d+)\b/g);
  if (highways) {
    highways.forEach(h => anchors.add(h));
  }

  // Extrai nomes próprios (palavras com inicial maiúscula com 4+ letras não genéricas)
  if (text) {
    const capitalizedWords = text.match(/\b[A-ZÀ-Ú][a-zà-ú]{3,}\b/g) || [];
    for (const cap of capitalizedWords) {
      const normCap = normalizeText(cap);
      if (!STOP_WORDS.has(normCap) && !GENERIC_ANCHOR_WORDS.has(normCap) && normCap.length >= 4) {
        anchors.add(normCap);
      }
    }
  }

  return anchors;
}

/**
 * Calcula similaridade entre dois artigos e determina se tratam do MESMO fato
 */
export function areNewsDuplicates(art1, art2) {
  // 1. Se possuírem a mesma URL de origem, são 100% duplicados
  if (art1.sourceUrl && art2.sourceUrl && art1.sourceUrl.trim() === art2.sourceUrl.trim()) {
    return { isDuplicate: true, reason: 'URL de origem idêntica', score: 1.0 };
  }

  const title1 = art1.title || '';
  const title2 = art2.title || '';

  const kw1 = extractKeywords(title1);
  const kw2 = extractKeywords(title2);

  if (kw1.size === 0 || kw2.size === 0) {
    return { isDuplicate: false, reason: 'Títulos vazios', score: 0 };
  }

  // Interseção e união de palavras-chave dos títulos
  const intersection = new Set([...kw1].filter(x => kw2.has(x)));
  const union = new Set([...kw1, ...kw2]);

  const jaccard = intersection.size / union.size;
  const minSize = Math.min(kw1.size, kw2.size);
  const overlap = minSize > 0 ? (intersection.size / minSize) : 0;

  // 2. Coeficiente de Sobreposição (Overlap) alto: mais de 45% das palavras do título menor coincidem
  if (overlap >= 0.45 && intersection.size >= 3) {
    return {
      isDuplicate: true,
      reason: `Alto Overlap de palavras-chave (${Math.round(overlap * 100)}%, ${intersection.size} termos em comum: ${[...intersection].join(', ')})`,
      score: overlap
    };
  }

  // 3. Similaridade Jaccard moderada (>= 32%) com pelo menos 3 termos em comum
  if (jaccard >= 0.32 && intersection.size >= 3) {
    return {
      isDuplicate: true,
      reason: `Jaccard relevante (${Math.round(jaccard * 100)}%, termos: ${[...intersection].join(', ')})`,
      score: jaccard
    };
  }

  // 4. Detecção por Âncoras Fortes (Cidades de MT + Rodovias + Nomes Específicos)
  const anchors1 = extractAnchors(title1);
  const anchors2 = extractAnchors(title2);
  const commonAnchors = new Set([...anchors1].filter(x => anchors2.has(x)));

  // Cidades do interior de MT (não-capital) que compartilham pelo menos 2 termos substantivos do fato
  const interiorCities = MT_CITIES.filter(c => c !== 'cuiaba' && c !== 'varzea grande');
  const hasCommonInteriorCity = interiorCities.some(c => commonAnchors.has(c));
  if (hasCommonInteriorCity && intersection.size >= 2) {
    return {
      isDuplicate: true,
      reason: `Mesma cidade (${[...commonAnchors].filter(c => interiorCities.includes(c)).join(', ')}) e assunto compartilhado (${[...intersection].join(', ')})`,
      score: 0.85
    };
  }

  // Nomes próprios específicos raros compartilhados (ex: 'woodford' + 'hall', 'sarraff' + 'joelma', 'andreilson')
  const specificNameAnchors = [...commonAnchors].filter(a => !MT_CITIES.includes(a));
  if ((specificNameAnchors.length >= 2 && intersection.size >= 3) || (specificNameAnchors.length >= 1 && intersection.size >= 4)) {
    return {
      isDuplicate: true,
      reason: `Entidades específicas compartilhadas: ${specificNameAnchors.join(', ')} (${intersection.size} termos em comum: ${[...intersection].join(', ')})`,
      score: 0.90
    };
  }

  // 5. Verificação de apoio com o Resumo / Conteúdo (se os títulos tiveram overlap moderado >= 28%)
  if (overlap >= 0.28 || intersection.size >= 2) {
    const summary1 = art1.summary || art1.body || '';
    const summary2 = art2.summary || art2.body || '';

    if (summary1 && summary2) {
      const kwSum1 = extractKeywords(summary1.slice(0, 400));
      const kwSum2 = extractKeywords(summary2.slice(0, 400));
      const sumIntersection = new Set([...kwSum1].filter(x => kwSum2.has(x)));
      const sumMinSize = Math.min(kwSum1.size, kwSum2.size);
      const sumOverlap = sumMinSize > 0 ? (sumIntersection.size / sumMinSize) : 0;

      // Se o resumo tiver pelo menos 5 termos substantivos do fato compartilhados e overlap >= 38%
      if (sumOverlap >= 0.38 && sumIntersection.size >= 5) {
        return {
          isDuplicate: true,
          reason: `Título similar (${Math.round(overlap * 100)}%) com confirmação de resumo (${Math.round(sumOverlap * 100)}% em comum: ${[...sumIntersection].slice(0, 5).join(', ')})`,
          score: sumOverlap
        };
      }
    }
  }

  return { isDuplicate: false, reason: 'Diferente', score: jaccard };
}

/**
 * Deduplica um lote de notícias brutas coletadas (Intra-Lote),
 * mantendo apenas 1 versão consolidada (a mais completa) para notícias do mesmo fato.
 */
export function deduplicateBatch(rawArticles) {
  console.log(`\n🧹 DEDUPLICAÇÃO INTRA-LOTE — Analisando ${rawArticles.length} notícias coletadas...`);

  const uniqueList = [];
  let duplicatesFound = 0;

  for (const article of rawArticles) {
    // Procura se já existe no lote uma notícia sobre o mesmo fato
    let duplicateIndex = -1;
    let matchDetails = null;

    for (let i = 0; i < uniqueList.length; i++) {
      const check = areNewsDuplicates(article, uniqueList[i]);
      if (check.isDuplicate) {
        duplicateIndex = i;
        matchDetails = check;
        break;
      }
    }

    if (duplicateIndex === -1) {
      // Matéria inédita no lote
      uniqueList.push(article);
    } else {
      duplicatesFound++;
      const existing = uniqueList[duplicateIndex];
      console.log(`  🔗 Fato duplicado entre portais:`);
      console.log(`     Novo:      [${article.sourceName}] "${article.title}"`);
      console.log(`     Existente: [${existing.sourceName}] "${existing.title}"`);
      console.log(`     Motivo:    ${matchDetails.reason}`);

      // Decide qual versão manter: prioriza quem tem imagem válida e maior corpo de texto
      const newHasImage = Boolean(article.imageUrl && article.imageUrl.startsWith('http'));
      const oldHasImage = Boolean(existing.imageUrl && existing.imageUrl.startsWith('http'));

      const newLength = (article.body || '').length;
      const oldLength = (existing.body || '').length;

      let replace = false;
      if (newHasImage && !oldHasImage) {
        replace = true;
      } else if (newHasImage === oldHasImage && newLength > oldLength * 1.2) {
        replace = true; // Novo texto é 20% mais completo
      }

      if (replace) {
        console.log(`     🔄 Substituindo pela versão mais completa de ${article.sourceName} (${newLength} chars).`);
        uniqueList[duplicateIndex] = article;
      } else {
        console.log(`     ✅ Mantendo versão atual de ${existing.sourceName} (${oldLength} chars).`);
      }
    }
  }

  console.log(`✨ Deduplicação intra-lote concluída: ${duplicatesFound} matérias redundantes consolidadas. Restaram ${uniqueList.length} notícias únicas.\n`);
  return uniqueList;
}
