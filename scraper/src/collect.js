import axios from 'axios';
import * as cheerio from 'cheerio';

// ─────────────────────────────────────────────
// Configuração dos portais monitorados
// ─────────────────────────────────────────────
const PORTALS = [
  {
    name: 'Resumo MT',
    url: 'https://resumomt.com.br/',
    articleSelector: 'article a, .post-title a, h2 a, h3 a',
    requiresBrowser: false,
  },
  {
    name: 'Olhar Direto',
    url: 'https://www.olhardireto.com.br/',
    articleSelector: '.noticia-title a, .titulo-noticia a, h2 a, .news-title a',
    requiresBrowser: false,
  },
  {
    name: 'MidiaNews',
    url: 'https://www.midianews.com.br/',
    articleSelector: 'article a, .entry-title a, h2 a',
    requiresBrowser: false,
  },
  {
    name: 'G1 MT',
    url: 'https://g1.globo.com/mt/',
    articleSelector: '.feed-post-link, .bastian-feed-item a, ._3DNx- a',
    requiresBrowser: true, // G1 usa JavaScript pesado
  },
];

const MAX_ARTICLES_PER_PORTAL = 5;

// ─────────────────────────────────────────────
// Scraper com Axios + Cheerio (portais simples)
// ─────────────────────────────────────────────
async function scrapeWithAxios(portal) {
  console.log(`  ⚙️  [Axios] Acessando ${portal.name}...`);
  const results = [];

  try {
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    const { data: html } = await axios.get(portal.url, { headers, timeout: 15000 });
    const $ = cheerio.load(html);

    const links = new Set();
    $(portal.articleSelector).each((_, el) => {
      const href = $(el).attr('href');
      if (href && links.size < MAX_ARTICLES_PER_PORTAL) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, portal.url).href;
        // Filtrar apenas URLs de matérias (com mais de 2 segmentos de caminho)
        if (new URL(fullUrl).pathname.split('/').filter(Boolean).length >= 2) {
          links.add(fullUrl);
        }
      }
    });

    for (const articleUrl of links) {
      const article = await extractArticleWithAxios(articleUrl, portal.name, headers);
      if (article) results.push(article);
    }
  } catch (err) {
    console.error(`  ⚠️  Erro ao acessar ${portal.name} com Axios: ${err.message}`);
  }

  return results;
}

// ─────────────────────────────────────────────
// Extração do conteúdo de um artigo individual
// ─────────────────────────────────────────────
async function extractArticleWithAxios(url, sourceName, headers) {
  try {
    const { data: html } = await axios.get(url, { headers, timeout: 15000 });
    const $ = cheerio.load(html);

    // Extrai a URL canônica (prioridade absoluta para evitar 404s)
    const canonical =
      $('link[rel="canonical"]').attr('href') || url;

    // Extrai metadados via Open Graph (mais confiável)
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text().trim();

    const summary =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('p').first().text().trim().slice(0, 300);

    const imageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('article img').first().attr('src') ||
      null;

    // Extrai o corpo da matéria
    const bodySelectors = [
      'article .entry-content',
      'article .post-content',
      '.article-body',
      '.materia-content',
      '.conteudo-materia',
      'article p',
      '.content p',
    ];

    let body = '';
    for (const sel of bodySelectors) {
      const found = $(sel);
      if (found.length > 0) {
        body = found
          .find('p')
          .map((_, el) => $(el).text().trim())
          .get()
          .filter((t) => t.length > 40)
          .join('\n\n');
        if (body.length > 200) break;
      }
    }

    // Fallback: todos os parágrafos do artigo
    if (body.length < 200) {
      body = $('p')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter((t) => t.length > 40)
        .slice(0, 20)
        .join('\n\n');
    }

    if (!title || body.length < 100) return null;

    return {
      title: title.trim(),
      summary: summary ? summary.trim().slice(0, 500) : '',
      body: body.trim(),
      imageUrl: imageUrl || null,
      sourceUrl: canonical,
      sourceName,
    };
  } catch (err) {
    console.error(`  ⚠️  Falha ao extrair artigo ${url}: ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────
// Scraper com Puppeteer (portais com JS pesado)
// ─────────────────────────────────────────────
async function scrapeWithBrowser(portal) {
  console.log(`  🌐 [Puppeteer] Acessando ${portal.name} (modo headless)...`);
  const results = [];
  let browser = null;

  try {
    // Importação dinâmica para não quebrar se Puppeteer não estiver instalado
    const puppeteer = await import('puppeteer').then((m) => m.default);
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36'
    );
    await page.goto(portal.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Aguarda o conteúdo dinâmico carregar
    await new Promise((r) => setTimeout(r, 2000));

    const links = await page.evaluate((selector) => {
      const anchors = document.querySelectorAll(selector);
      const found = new Set();
      for (const a of anchors) {
        const href = a.href;
        if (href && new URL(href).pathname.split('/').filter(Boolean).length >= 2) {
          found.add(href);
          if (found.size >= 5) break;
        }
      }
      return [...found];
    }, portal.articleSelector);

    for (const articleUrl of links) {
      const article = await extractArticleWithBrowser(page, articleUrl, portal.name);
      if (article) results.push(article);
    }
  } catch (err) {
    console.error(`  ⚠️  Puppeteer falhou em ${portal.name}: ${err.message}`);
    // Fallback para Axios
    console.log(`  🔄 Tentando fallback com Axios para ${portal.name}...`);
    return scrapeWithAxios({ ...portal, requiresBrowser: false });
  } finally {
    if (browser) await browser.close();
  }

  return results;
}

// ─────────────────────────────────────────────
// Extração de artigo com Puppeteer
// ─────────────────────────────────────────────
async function extractArticleWithBrowser(page, url, sourceName) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1500));

    return await page.evaluate((srcName) => {
      const canonical =
        document.querySelector('link[rel="canonical"]')?.href || document.URL;
      const title =
        document.querySelector('meta[property="og:title"]')?.content ||
        document.querySelector('h1')?.textContent?.trim() || '';
      const summary =
        document.querySelector('meta[property="og:description"]')?.content ||
        document.querySelector('meta[name="description"]')?.content || '';
      const imageUrl =
        document.querySelector('meta[property="og:image"]')?.content || null;

      const paragraphs = [...document.querySelectorAll('article p, .content p, .entry-content p')]
        .map((p) => p.textContent.trim())
        .filter((t) => t.length > 40)
        .slice(0, 20);

      const body = paragraphs.join('\n\n');

      if (!title || body.length < 100) return null;

      return {
        title: title.trim(),
        summary: summary.trim().slice(0, 500),
        body,
        imageUrl,
        sourceUrl: canonical,
        sourceName: srcName,
      };
    }, sourceName);
  } catch (err) {
    console.error(`  ⚠️  Falha ao extrair artigo com browser: ${url} — ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────
// Função principal de coleta
// ─────────────────────────────────────────────
export async function collectNews() {
  console.log('\n📡 MÓDULO DE COLETA — Iniciando raspagem dos portais...\n');
  const allArticles = [];

  for (const portal of PORTALS) {
    console.log(`\n🔍 Portal: ${portal.name}`);
    const articles = portal.requiresBrowser
      ? await scrapeWithBrowser(portal)
      : await scrapeWithAxios(portal);

    const valid = articles.filter(Boolean);
    console.log(`  ✅ ${valid.length} artigos coletados.`);
    allArticles.push(...valid);
  }

  console.log(`\n📦 Total coletado: ${allArticles.length} artigos de ${PORTALS.length} portais.`);
  return allArticles;
}
