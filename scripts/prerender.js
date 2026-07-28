import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configurações do Supabase obtidas do portal
const supabaseUrl = 'https://wnvpkbddmhnznybvmqam.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudnBrYmRkbWhuem55YnZtcWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjEzODgsImV4cCI6MjA5Nzg5NzM4OH0.q1OllfKvmIhjoCNTCGPKQB_5opZIVgJc0L5_8BZj7Ew';
const BASE_URL = 'https://sobreopovo.com.br';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const INDEX_TEMPLATE_PATH = path.join(ROOT_DIR, 'index.html');

function getCategoryColor(category) {
  const colors = {
    'Brasil': '#27ae60',
    'Política': '#27ae60',
    'Cidades': '#e74c3c',
    'Economia': '#2980b9',
    'Cultura': '#8e44ad',
    'Celebridades': '#e84393',
    'Opinião': '#e67e22'
  };
  return colors[category] || '#e67e22';
}

function formatFriendlyDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return date.toLocaleDateString('pt-BR', options);
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function prerender() {
  console.log('🚀 Iniciando pré-renderização estática (SSG)...');

  if (!fs.existsSync(INDEX_TEMPLATE_PATH)) {
    console.error('Template index.html não encontrado.');
    process.exit(1);
  }

  const rawTemplate = fs.readFileSync(INDEX_TEMPLATE_PATH, 'utf-8');

  // Ajusta caminhos de assets para absolutos no template base
  const template = rawTemplate
    .replace(/href="\.\/css\/style\.css"/g, 'href="/css/style.css"')
    .replace(/href="\.\/assets\//g, 'href="/assets/')
    .replace(/src="\.\/assets\//g, 'src="/assets/')
    .replace(/src="\.\/js\/app\.js"/g, 'src="/js/app.js"');

  try {
    // 1. Consultar notícias completas do Supabase
    const response = await fetch(`${supabaseUrl}/rest/v1/noticias?select=*&order=date.desc`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Falha na requisição Supabase: ${response.statusText}`);
    }

    const noticias = await response.json();
    console.log(`Encontradas ${noticias.length} notícias para pré-renderização.`);

    // 2. Gerar páginas de notícias estáticas em noticia/[slug]/index.html
    for (const article of noticias) {
      const articleDir = path.join(ROOT_DIR, 'noticia', article.slug);
      fs.mkdirSync(articleDir, { recursive: true });

      const fullTitle = `${article.title} | Sobre o Povo`;
      const description = escapeHtml(article.summary || article.title);
      const articleUrl = `${BASE_URL}/noticia/${article.slug}`;
      const imageUrl = article.image || `${BASE_URL}/assets/logosemfundo.png`;
      const categoryColor = getCategoryColor(article.category);
      const formattedDate = formatFriendlyDate(article.date);

      // Converte corpo se necessário
      const bodyHtml = article.content || '';

      const articleMainHtml = `
      <div class="article-layout">
        <main class="article-main-content">
          <a href="/" class="back-link">&larr; Voltar para a Página Inicial</a>
          
          <header class="article-header">
            <span class="category-badge" style="background-color: ${categoryColor}">
              ${escapeHtml(article.category)}
            </span>
            <h1 class="article-headline">${escapeHtml(article.title)}</h1>
            ${article.summary ? `<p class="article-subtitle">${escapeHtml(article.summary)}</p>` : ''}
            
            <div class="article-meta-bar">
              <div class="author-info">
                <span>Por <strong>${escapeHtml(article.author || 'Redação')}</strong></span>
                <span class="meta-dot">&bull;</span>
                <time>${formattedDate}</time>
              </div>
            </div>
          </header>

          ${article.image ? `
            <figure class="article-hero-image">
              <img src="${escapeHtml(article.image)}" alt="${escapeHtml(article.title)}" />
            </figure>
          ` : ''}

          <div class="article-body">
            ${bodyHtml}
          </div>

          <div class="article-credits-box" style="margin-top: 2rem; padding: 1rem 1.2rem; background: var(--color-bg-secondary); border-left: 4px solid var(--color-accent-orange); border-radius: 6px; font-size: 0.9rem; color: var(--color-text-muted);">
            <p style="margin: 0; font-weight: 600; color: var(--color-text-main);">📋 Ficha Técnica e Créditos:</p>
            <p style="margin: 0.3rem 0 0 0; line-height: 1.5;">${escapeHtml(article.credits || 'Informações e dados apurados com fontes públicas e oficiais de Mato Grosso.')}</p>
          </div>
        </main>
      </div>
      `;

      // Dados estruturados JSON-LD estáticos
      const ldData = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": article.title,
        "description": article.summary || article.title,
        "image": [imageUrl],
        "datePublished": article.date,
        "dateModified": article.date,
        "author": [{
          "@type": "Person",
          "name": article.author || "Sobre o Povo",
          "url": BASE_URL
        }],
        "publisher": {
          "@type": "Organization",
          "name": "Sobre o Povo",
          "logo": {
            "@type": "ImageObject",
            "url": `${BASE_URL}/assets/logosemfundo.png`
          }
        }
      };

      let html = template;

      // Substituição de metadados na HEAD
      html = html.replace(/<title id="page-title">.*?<\/title>/s, `<title id="page-title">${escapeHtml(fullTitle)}</title>`);
      html = html.replace(/<meta[^>]*id="meta-description"[^>]*>/s, `<meta name="description" content="${description}" id="meta-description">`);
      html = html.replace(/<link[^>]*id="canonical-link"[^>]*>/s, `<link rel="canonical" href="${articleUrl}" id="canonical-link">`);

      // Open Graph
      html = html.replace(/<meta[^>]*id="meta-og-type"[^>]*>/s, `<meta property="og:type" content="article" id="meta-og-type">`);
      html = html.replace(/<meta[^>]*id="meta-og-url"[^>]*>/s, `<meta property="og:url" content="${articleUrl}" id="meta-og-url">`);
      html = html.replace(/<meta[^>]*id="meta-og-title"[^>]*>/s, `<meta property="og:title" content="${escapeHtml(fullTitle)}" id="meta-og-title">`);
      html = html.replace(/<meta[^>]*id="meta-og-desc"[^>]*>/s, `<meta property="og:description" content="${description}" id="meta-og-desc">`);
      html = html.replace(/<meta[^>]*id="meta-og-image"[^>]*>/s, `<meta property="og:image" content="${escapeHtml(imageUrl)}" id="meta-og-image">`);

      // Twitter Cards
      html = html.replace(/<meta[^>]*id="meta-tw-url"[^>]*>/s, `<meta property="twitter:url" content="${articleUrl}" id="meta-tw-url">`);
      html = html.replace(/<meta[^>]*id="meta-tw-title"[^>]*>/s, `<meta property="twitter:title" content="${escapeHtml(fullTitle)}" id="meta-tw-title">`);
      html = html.replace(/<meta[^>]*id="meta-tw-desc"[^>]*>/s, `<meta property="twitter:description" content="${description}" id="meta-tw-desc">`);
      html = html.replace(/<meta[^>]*id="meta-tw-image"[^>]*>/s, `<meta property="twitter:image" content="${escapeHtml(imageUrl)}" id="meta-tw-image">`);

      // Injeta JSON-LD estático
      const ldJsonHtml = `<script type="application/ld+json" id="ld-seo">${JSON.stringify(ldData, null, 2)}</script>`;
      html = html.replace('</head>', `${ldJsonHtml}\n</head>`);

      // Injeta o conteúdo HTML pré-renderizado no main-content
      html = html.replace(
        /<main class="main-content" id="main-content">.*?<\/main>/s,
        `<main class="main-content" id="main-content">${articleMainHtml}</main>`
      );

      fs.writeFileSync(path.join(articleDir, 'index.html'), html, 'utf-8');
    }

    // 3. Gerar páginas estáticas de Categorias sob categoria/[cat]/index.html
    const categorias = ['Brasil', 'Política', 'Cidades', 'Economia', 'Cultura', 'Celebridades', 'Opinião'];
    for (const cat of categorias) {
      const catDir = path.join(ROOT_DIR, 'categoria', cat);
      fs.mkdirSync(catDir, { recursive: true });

      const catTitle = `Notícias de ${cat} | Sobre o Povo`;
      const catDesc = escapeHtml(`Acompanhe as últimas notícias sobre ${cat} em Mato Grosso no portal Sobre o Povo.`);
      const catUrl = `${BASE_URL}/categoria/${encodeURIComponent(cat)}`;

      let html = template;
      html = html.replace(/<title id="page-title">.*?<\/title>/s, `<title id="page-title">${escapeHtml(catTitle)}</title>`);
      html = html.replace(/<meta[^>]*id="meta-description"[^>]*>/s, `<meta name="description" content="${catDesc}" id="meta-description">`);
      html = html.replace(/<link[^>]*id="canonical-link"[^>]*>/s, `<link rel="canonical" href="${catUrl}" id="canonical-link">`);

      html = html.replace(/<meta[^>]*id="meta-og-url"[^>]*>/s, `<meta property="og:url" content="${catUrl}" id="meta-og-url">`);
      html = html.replace(/<meta[^>]*id="meta-og-title"[^>]*>/s, `<meta property="og:title" content="${escapeHtml(catTitle)}" id="meta-og-title">`);
      html = html.replace(/<meta[^>]*id="meta-og-desc"[^>]*>/s, `<meta property="og:description" content="${catDesc}" id="meta-og-desc">`);

      fs.writeFileSync(path.join(catDir, 'index.html'), html, 'utf-8');
    }

    console.log(`✨ Sucesso! Pré-renderizados ${noticias.length} artigos e ${categorias.length} categorias.`);

  } catch (error) {
    console.error('Erro na pré-renderização estática:', error);
    process.exit(1);
  }
}

prerender();
