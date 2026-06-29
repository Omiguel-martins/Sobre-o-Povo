import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configurações do Supabase obtidas do portal
const supabaseUrl = 'https://wnvpkbddmhnznybvmqam.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudnBrYmRkbWhuem55YnZtcWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjEzODgsImV4cCI6MjA5Nzg5NzM4OH0.q1OllfKvmIhjoCNTCGPKQB_5opZIVgJc0L5_8BZj7Ew';
const BASE_URL = 'https://sobreopovo.com.br';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SITEMAP_PATH = path.join(__dirname, '..', 'sitemap.xml');

async function generateSitemap() {
  console.log('Gerando sitemap.xml...');

  try {
    // 1. Consultar as notícias do Supabase usando API REST direta (fetch) para evitar dependências adicionais no Node.js
    const response = await fetch(`${supabaseUrl}/rest/v1/noticias?select=slug,date&order=date.desc`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Falha na requisição Supabase: ${response.statusText}`);
    }

    const noticias = await response.json();
    const today = new Date().toISOString().split('T')[0];

    // 2. Montar cabeçalho do Sitemap
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // 3. Adicionar URL principal (Home)
    xml += `  <url>\n`;
    xml += `    <loc>${BASE_URL}/</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>1.0</priority>\n`;
    xml += `  </url>\n`;

    // 4. Adicionar as URLs das Categorias do Portal
    const categorias = ['Brasil', 'Política', 'Cidades', 'Economia', 'Cultura', 'Celebridades', 'Opinião'];
    categorias.forEach(cat => {
      xml += `  <url>\n`;
      xml += `    <loc>${BASE_URL}/#/categoria/${encodeURIComponent(cat)}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    });

    // 5. Adicionar URLs dinâmicas de cada notícia do Supabase
    noticias.forEach(noticia => {
      const itemDate = new Date(noticia.date).toISOString().split('T')[0];
      xml += `  <url>\n`;
      xml += `    <loc>${BASE_URL}/#/noticia/${noticia.slug}</loc>\n`;
      xml += `    <lastmod>${itemDate}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.6</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += '</urlset>\n';

    // 6. Gravar fisicamente o arquivo sitemap.xml na raiz do projeto
    fs.writeFileSync(SITEMAP_PATH, xml, 'utf-8');
    console.log(`Sucesso: sitemap.xml gerado e salvo em ${SITEMAP_PATH}`);

  } catch (error) {
    console.error('Erro ao gerar o sitemap.xml:', error);
    process.exit(1);
  }
}

generateSitemap();