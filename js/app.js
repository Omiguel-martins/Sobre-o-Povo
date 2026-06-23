import { parseFrontmatter, formatFriendlyDate, getCategoryColor } from './utils.js';

// Estado global da aplicação
const state = {
  noticias: [],
  currentCategory: null,
  searchQuery: '',
  theme: localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
};

// Seletores DOM principais
const mainContent = document.getElementById('main-content');
const searchInput = document.getElementById('search-input');
const searchForm = document.getElementById('search-form');
const themeToggleBtn = document.getElementById('theme-toggle');
const navLinks = document.querySelectorAll('.nav-link');

// Inicialização da aplicação
async function init() {
  setupTheme();
  updateHeaderDate();
  setupEventListeners();
  await loadNoticiasIndex();
  handleRouting();
}

// Exibe a data atual do portal formatada
function updateHeaderDate() {
  const dateElement = document.getElementById('current-date');
  if (dateElement) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date();
    const dateStr = today.toLocaleDateString('pt-BR', options);
    // Capitaliza a primeira letra da data
    dateElement.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  }
}

// Configuração inicial do tema
function setupTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeIcon();
}

// Atualiza o ícone do tema (sol/lua)
function updateThemeIcon() {
  if (state.theme === 'dark') {
    themeToggleBtn.innerHTML = '☀️'; // Sol para alternar para o claro
    themeToggleBtn.setAttribute('title', 'Mudar para o Modo Claro');
  } else {
    themeToggleBtn.innerHTML = '🌙'; // Lua para alternar para o escuro
    themeToggleBtn.setAttribute('title', 'Mudar para o Modo Escuro');
  }
}

// Configura ouvintes de eventos globais
function setupEventListeners() {
  // Alternar Tema
  themeToggleBtn.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('theme', state.theme);
    updateThemeIcon();
  });

  // Busca de Notícias
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    state.searchQuery = searchInput.value.trim();
    window.location.hash = '#/';
    renderHome();
  });

  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    if (state.searchQuery === '') {
      renderHome();
    }
  });

  // Roteamento ao mudar o Hash da URL
  window.addEventListener('hashchange', handleRouting);
}

// Carrega o arquivo noticias/index.json
async function loadNoticiasIndex() {
  try {
    // Vite ou qualquer servidor local serve arquivos na raiz relativa
    const response = await fetch('./noticias/index.json');
    if (!response.ok) {
      throw new Error('Falha ao carregar o índice de notícias');
    }
    state.noticias = await response.json();
  } catch (error) {
    console.error('Erro ao buscar as notícias:', error);
    mainContent.innerHTML = renderErrorState(
      'Erro de Conexão',
      'Não foi possível carregar as notícias. Por favor, verifique se executou o script de compilação ou atualize a página.'
    );
  }
}

// Lida com o roteamento simples baseado no Hash da URL
function handleRouting() {
  const hash = window.location.hash;
  
  // Limpa estados de filtro ao navegar
  if (hash === '' || hash === '#/') {
    state.currentCategory = null;
    updateActiveNavLink(null);
    renderHome();
  } else if (hash.startsWith('#/categoria/')) {
    const category = decodeURIComponent(hash.replace('#/categoria/', ''));
    state.currentCategory = category;
    updateActiveNavLink(category);
    renderHome();
  } else if (hash.startsWith('#/noticia/')) {
    const noticiaId = hash.replace('#/noticia/', '');
    renderArticle(noticiaId);
  } else if (hash === '#/manager') {
    updateActiveNavLink(null);
    renderManager();
  } else {
    // Rota padrão desconhecida
    mainContent.innerHTML = renderErrorState('Página Não Encontrada', 'A seção que você está procurando não existe.');
  }
  
  // Rola para o topo ao mudar de página
  window.scrollTo(0, 0);
}

// Atualiza a marcação visual de link ativo na navegação superior
function updateActiveNavLink(category) {
  navLinks.forEach(link => {
    const linkCategory = link.getAttribute('data-category');
    if (category === null && linkCategory === 'home') {
      link.classList.add('active');
    } else if (category && linkCategory && linkCategory.toLowerCase() === category.toLowerCase()) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Renderiza a Página Inicial (Home) com grid e sidebar
function renderHome() {
  if (state.noticias.length === 0) return;

  // Filtra as notícias com base no estado atual
  let filteredNoticias = [...state.noticias];
  
  if (state.currentCategory) {
    filteredNoticias = filteredNoticias.filter(
      n => n.category.toLowerCase() === state.currentCategory.toLowerCase()
    );
  }
  
  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    filteredNoticias = filteredNoticias.filter(
      n => n.title.toLowerCase().includes(query) || 
           n.summary.toLowerCase().includes(query)
    );
  }

  // Se nenhum resultado for encontrado
  if (filteredNoticias.length === 0) {
    mainContent.innerHTML = `
      ${renderFilterInfoBar()}
      ${renderErrorState(
        'Nenhuma Notícia Encontrada',
        'Não encontramos nenhuma matéria correspondente aos filtros selecionados. Tente termos diferentes ou mude de categoria.'
      )}
    `;
    return;
  }

  let htmlContent = '';
  
  // Renderiza a barra com informações de filtro se houver busca ou categoria ativa
  if (state.currentCategory || state.searchQuery) {
    htmlContent += renderFilterInfoBar();
  }

  // Define layout do feed
  // Se houver filtros ativos, renderiza direto um grid padrão de notícias
  if (state.currentCategory || state.searchQuery) {
    htmlContent += `<div class="news-grid">${filteredNoticias.map(renderNewsCard).join('')}</div>`;
  } else {
    // Se for a Home limpa, cria o layout Premium assimétrico (Destaque Principal + Últimas Matérias + Feed Geral)
    const featured = filteredNoticias.find(n => n.featured) || filteredNoticias[0];
    const remaining = filteredNoticias.filter(n => n.id !== featured.id);
    
    // As próximas 3 notícias vão para a sidebar "Mais Recentes"
    const latestItems = remaining.slice(0, 3);
    // As restantes vão para o grid secundário
    const gridItems = remaining.slice(3);

    htmlContent += `
      <div class="home-grid">
        <!-- Lado Esquerdo: Destaque Principal -->
        <article class="featured-card">
          <a href="#/noticia/${featured.id}" class="featured-img-container">
            <img src="${featured.image}" alt="${featured.title}" loading="lazy" />
          </a>
          <div class="featured-card-content">
            <span class="category-badge" style="background-color: ${getCategoryColor(featured.category)}">
              ${featured.category}
            </span>
            <a href="#/noticia/${featured.id}">
              <h2 class="featured-title">${featured.title}</h2>
            </a>
            <p class="featured-summary">${featured.summary}</p>
            <div class="meta-info">
              <span class="meta-author">Por ${featured.author}</span>
              <span class="meta-date">${formatFriendlyDate(featured.date)}</span>
            </div>
          </div>
        </article>

        <!-- Lado Direito: Sidebar Recentes -->
        <aside class="sidebar-section">
          <h3 class="section-title">Últimas Notícias</h3>
          <div class="latest-list">
            ${latestItems.map(renderLatestSidebarItem).join('')}
          </div>
        </aside>
      </div>
    `;

    // Se houver mais notícias, renderiza a seção secundária de grid
    if (gridItems.length > 0) {
      htmlContent += `
        <h3 class="section-title" style="margin-top: 4rem; margin-bottom: 2rem;">Leia Mais</h3>
        <div class="news-grid">
          ${gridItems.map(renderNewsCard).join('')}
        </div>
      `;
    }
  }

  mainContent.innerHTML = htmlContent;
  
  // Limpa inputs de pesquisa ao clicar em limpar filtro
  const clearFilterBtn = document.getElementById('clear-filter-btn');
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', () => {
      state.searchQuery = '';
      state.currentCategory = null;
      searchInput.value = '';
      window.location.hash = '#/';
    });
  }
}

// Template da Barra de Informações do Filtro Ativo
function renderFilterInfoBar() {
  let titleStr = '';
  if (state.currentCategory) {
    titleStr += `Categoria: <span>${state.currentCategory}</span>`;
  }
  if (state.searchQuery) {
    titleStr += titleStr ? ` &bull; Busca: "<span>${state.searchQuery}</span>"` : `Busca por: "<span>${state.searchQuery}</span>"`;
  }
  
  return `
    <div class="filter-info-bar">
      <div class="filter-title">${titleStr}</div>
      <button class="clear-filter-btn" id="clear-filter-btn">Limpar Filtros</button>
    </div>
  `;
}

// Template de Item da Sidebar "Mais Recentes"
function renderLatestSidebarItem(noticia) {
  return `
    <div class="latest-item">
      <div class="latest-meta">
        <span class="latest-category" style="color: ${getCategoryColor(noticia.category)}">${noticia.category}</span>
        <span class="latest-time">${formatFriendlyDate(noticia.date)}</span>
      </div>
      <a href="#/noticia/${noticia.id}">
        <h4 class="latest-title">${noticia.title}</h4>
      </a>
    </div>
  `;
}

// Template de Card de Notícia Padrão (Feed Secundário)
function renderNewsCard(noticia) {
  return `
    <article class="news-card">
      <a href="#/noticia/${noticia.id}" class="news-img-container">
        <img src="${noticia.image}" alt="${noticia.title}" loading="lazy" />
      </a>
      <div class="news-card-content">
        <span class="category-badge" style="background-color: ${getCategoryColor(noticia.category)}">
          ${noticia.category}
        </span>
        <a href="#/noticia/${noticia.id}">
          <h3 class="news-title">${noticia.title}</h3>
        </a>
        <p class="news-summary">${noticia.summary}</p>
        <div class="meta-info">
          <span class="meta-author">Por ${noticia.author}</span>
          <span class="meta-date">${formatFriendlyDate(noticia.date)}</span>
        </div>
      </div>
    </article>
  `;
}

// Renderiza a Página de Artigo Detalhado (Leitura Editorial)
async function renderArticle(id) {
  // Renderiza Skeleton Loader enquanto carrega o conteúdo
  mainContent.innerHTML = renderSkeletonLoader();

  // Encontra a notícia correspondente no índice carregado
  const meta = state.noticias.find(n => n.id === id);
  if (!meta) {
    mainContent.innerHTML = renderErrorState(
      'Notícia Não Encontrada',
      'Desculpe, o conteúdo que você está tentando acessar não existe ou foi removido do portal.'
    );
    return;
  }

  try {
    // Carrega o arquivo Markdown bruto do servidor
    const response = await fetch(`./noticias/${meta.fileName}`);
    if (!response.ok) {
      throw new Error('Falha ao carregar o conteúdo do arquivo .md');
    }
    const rawText = await response.text();
    
    // Faz o parse do frontmatter para separar o conteúdo markdown real
    const { body } = parseFrontmatter(rawText);
    
    // Converte o Markdown em HTML usando marked.parse (disponível via CDN globalmente no index.html)
    // Se o marked não tiver carregado por falha de CDN, usamos um fallback básico de quebra de parágrafo
    let bodyHtml = '';
    if (typeof marked !== 'undefined' && marked.parse) {
      bodyHtml = marked.parse(body);
    } else {
      console.warn('Marked.js não está carregado. Usando fallback de rendering de texto plano.');
      bodyHtml = body
        .split('\n\n')
        .map(p => p.startsWith('#') ? `<h3>${p.replace(/#/g, '').trim()}</h3>` : `<p>${p.trim()}</p>`)
        .join('');
    }

    // Renderiza a página final do artigo estilo Folha de S.Paulo
    mainContent.innerHTML = `
      <article class="article-page">
        <a href="#/" class="article-back-link">
          ← Voltar para a Página Inicial
        </a>
        
        <header class="article-header">
          <span class="category-badge" style="background-color: ${getCategoryColor(meta.category)}">
            ${meta.category}
          </span>
          <h1 class="article-title">${meta.title}</h1>
          <p class="article-subtitle">${meta.summary}</p>
          <div class="article-meta">
            <span class="meta-author">Por <strong>${meta.author}</strong></span>
            <span>&bull;</span>
            <span class="meta-date">Publicado em ${formatFriendlyDate(meta.date)}</span>
          </div>
        </header>

        ${meta.image ? `<img class="article-hero-img" src="${meta.image}" alt="${meta.title}" />` : ''}

        <div class="article-body">
          ${bodyHtml}
        </div>
      </article>
    `;
  } catch (error) {
    console.error('Erro ao renderizar artigo:', error);
    mainContent.innerHTML = renderErrorState(
      'Erro de Leitura',
      'Não foi possível carregar os detalhes desta notícia no momento. Tente novamente mais tarde.'
    );
  }
}

// Template de Skeleton Loader para carregamento premium
function renderSkeletonLoader() {
  return `
    <div class="article-page" style="opacity: 0.7;">
      <div style="width: 100px; height: 16px; margin-bottom: 2rem;" class="skeleton"></div>
      <div class="skeleton-text title skeleton"></div>
      <div class="skeleton-text body-line skeleton"></div>
      <div class="skeleton-text body-line skeleton" style="width: 90%;"></div>
      <div style="width: 250px; height: 16px; margin: 1.5rem 0;" class="skeleton"></div>
      <div class="skeleton-image skeleton" style="height: 350px;"></div>
      <div class="skeleton-text body-line skeleton"></div>
      <div class="skeleton-text body-line skeleton"></div>
      <div class="skeleton-text body-line skeleton" style="width: 92%;"></div>
      <div class="skeleton-text body-line skeleton" style="width: 85%;"></div>
    </div>
  `;
}

// Template de Mensagem de Erro amigável
function renderErrorState(title, message) {
  return `
    <div class="error-state">
      <h2 class="error-title">${title}</h2>
      <p class="error-m// Renderiza a Área Administrativa (CMS / Manager)
function renderManager() {
  mainContent.innerHTML = `
    <div class="admin-panel-container">
      <!-- Coluna Esquerda: Formulário -->
      <div class="admin-form-card">
        <h2 class="admin-form-title">Painel de Publicação (Git CMS)</h2>
        
        <div id="manager-alert-container"></div>
        
        <form id="manager-form">
          <div class="form-group">
            <label class="form-label" for="m-token">Token de Acesso do GitHub (PAT)</label>
            <input type="password" class="form-control" id="m-token" required placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
          </div>

          <div class="form-group row-flex">
            <div>
              <label class="form-label" for="m-owner">Usuário do GitHub</label>
              <input type="text" class="form-control" id="m-owner" required placeholder="Ex: carlos-silva" />
            </div>
            <div>
              <label class="form-label" for="m-repo">Nome do Repositório</label>
              <input type="text" class="form-control" id="m-repo" required placeholder="Ex: sobre-o-povo" />
            </div>
          </div>

          <div class="form-group row-flex">
            <div>
              <label class="form-label" for="m-branch">Branch</label>
              <input type="text" class="form-control" id="m-branch" required placeholder="Ex: main" value="main" />
            </div>
            <div>
              <label class="form-label" for="m-author">Autor / Repórter</label>
              <input type="text" class="form-control" id="m-author" required placeholder="Ex: Redação" value="Redação" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="m-category">Editoria / Categoria</label>
            <select class="form-control" id="m-category">
              <option value="Brasil & Política">Brasil & Política</option>
              <option value="Economia">Economia</option>
              <option value="Cultura">Cultura</option>
              <option value="Opinião">Opinião</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="m-title">Título da Notícia</label>
            <input type="text" class="form-control" id="m-title" required placeholder="Digite um título impactante" />
          </div>

          <div class="form-group">
            <label class="form-label" for="m-summary">Linha Fina (Resumo)</label>
            <input type="text" class="form-control" id="m-summary" required placeholder="Um breve resumo que aparece no feed" />
          </div>

          <div class="form-group">
            <label class="form-label" for="m-image">URL da Imagem de Capa (Opcional)</label>
            <input type="text" class="form-control" id="m-image" placeholder="Ex: https://images.unsplash.com/photo-..." />
          </div>

          <div class="form-group">
            <label class="form-label" for="m-content">Conteúdo da Notícia (Markdown)</label>
            <textarea class="form-control" id="m-content" required placeholder="Redija a sua matéria aqui utilizando Markdown. Ex:\n\n### Subtítulo\nO text da notícia **em negrito** ou *itálico*...\n\n> Citação importante."></textarea>
          </div>

          <div class="form-group">
            <label class="form-checkbox-label">
              <input type="checkbox" class="form-checkbox" id="m-featured" />
              Destacar como Notícia Principal no topo da Home
            </label>
          </div>

          <button type="submit" class="btn-publish" id="m-submit-btn">
            Publicar Matéria no GitHub
          </button>
        </form>
      </div>

      <!-- Coluna Direita: Preview Visual -->
      <div class="admin-preview-column">
        <h3 class="admin-preview-title">
          <span></span> Visualização em Tempo Real (Desktop)
        </h3>
        <div class="admin-preview-frame">
          <article class="article-page" style="box-shadow: none; border: none; padding: 1.5rem; border-radius: 0; min-height: 100%;">
            <header class="article-header">
              <span class="category-badge" id="prev-badge" style="background-color: var(--color-accent-orange)">
                Brasil & Política
              </span>
              <h1 class="article-title" id="prev-title" style="font-size: 2.2rem; margin: 0.5rem 0;">
                Título da Matéria
              </h1>
              <p class="article-subtitle" id="prev-summary">
                Resumo da notícia que você está redigindo aparecerá aqui.
              </p>
              <div class="article-meta" style="font-size: 0.85rem;">
                <span class="meta-author">Por <strong id="prev-author">Redação</strong></span>
                <span>&bull;</span>
                <span class="meta-date">Publicado em Hoje</span>
              </div>
            </header>

            <img class="article-hero-img" id="prev-image" src="https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200&q=80" alt="Capa" style="margin-bottom: 1.5rem;" />

            <div class="article-body" id="prev-body">
              <p>O corpo da notícia redigido no editor aparecerá formatado aqui em tempo real.</p>
            </div>
          </article>
        </div>
      </div>
    </div>
  `;

  // Elementos do Formulário
  const form = document.getElementById('manager-form');
  const inToken = document.getElementById('m-token');
  const inOwner = document.getElementById('m-owner');
  const inRepo = document.getElementById('m-repo');
  const inBranch = document.getElementById('m-branch');
  const inAuthor = document.getElementById('m-author');
  const inCategory = document.getElementById('m-category');
  const inTitle = document.getElementById('m-title');
  const inSummary = document.getElementById('m-summary');
  const inImage = document.getElementById('m-image');
  const inContent = document.getElementById('m-content');
  const inFeatured = document.getElementById('m-featured');
  const btnSubmit = document.getElementById('m-submit-btn');
  const alertContainer = document.getElementById('manager-alert-container');

  // Elementos do Preview
  const prevBadge = document.getElementById('prev-badge');
  const prevTitle = document.getElementById('prev-title');
  const prevSummary = document.getElementById('prev-summary');
  const prevAuthor = document.getElementById('prev-author');
  const prevImage = document.getElementById('prev-image');
  const prevBody = document.getElementById('prev-body');

  // Recupera configurações salvas do localStorage se houverem
  if (localStorage.getItem('git_token')) inToken.value = localStorage.getItem('git_token');
  if (localStorage.getItem('git_owner')) inOwner.value = localStorage.getItem('git_owner');
  if (localStorage.getItem('git_repo')) inRepo.value = localStorage.getItem('git_repo');
  if (localStorage.getItem('git_branch')) inBranch.value = localStorage.getItem('git_branch');
  if (localStorage.getItem('git_author')) inAuthor.value = localStorage.getItem('git_author');

  // Helpers auxiliares para codificar e decodificar Base64 com suporte a UTF-8 (acentos em PT-BR)
  function utob(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function btou(str) {
    return decodeURIComponent(escape(atob(str)));
  }

  // Função para sanitizar títulos em Slugs para URL
  function slugify(text) {
    const utf8 = {
      'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'å': 'a',
      'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
      'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
      'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o',
      'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
      'ç': 'c', 'ñ': 'n'
    };
    let processed = text.toLowerCase();
    for (let char in utf8) {
      processed = processed.replace(new RegExp(char, 'g'), utf8[char]);
    }
    processed = processed.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return processed || 'noticia';
  }

  // Função para atualizar o preview dinamicamente
  function updatePreview() {
    prevTitle.textContent = inTitle.value || 'Título da Matéria';
    prevSummary.textContent = inSummary.value || 'Resumo da notícia que você está redigindo aparecerá aqui.';
    prevAuthor.textContent = inAuthor.value || 'Redação';
    
    // Atualiza categoria e cor
    const category = inCategory.value;
    prevBadge.textContent = category;
    prevBadge.style.backgroundColor = getCategoryColor(category);

    // Imagem de capa
    const defaultImg = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200&q=80';
    prevImage.src = inImage.value || defaultImg;

    // Conteúdo em Markdown
    const markdownText = inContent.value;
    if (markdownText) {
      if (typeof marked !== 'undefined' && marked.parse) {
        prevBody.innerHTML = marked.parse(markdownText);
      } else {
        prevBody.innerHTML = `<p>${markdownText.replace(/\n\n/g, '</p><p>')}</p>`;
      }
    } else {
      prevBody.innerHTML = '<p>O corpo da notícia redigido no editor aparecerá formatado aqui em tempo real.</p>';
    }
  }

  // Registra os escutadores para o preview em tempo real
  inTitle.addEventListener('input', updatePreview);
  inSummary.addEventListener('input', updatePreview);
  inAuthor.addEventListener('input', updatePreview);
  inCategory.addEventListener('change', updatePreview);
  inImage.addEventListener('input', updatePreview);
  inContent.addEventListener('input', updatePreview);

  // Submissão do Formulário de Publicação via REST API do GitHub
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    alertContainer.innerHTML = '';
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Autenticando e Indexando...';

    // Parâmetros de Configuração do GitHub
    const token = inToken.value.trim();
    const owner = inOwner.value.trim();
    const repo = inRepo.value.trim();
    const branch = inBranch.value.trim();
    const author = inAuthor.value.trim();
    const category = inCategory.value;
    const title = inTitle.value.trim();
    const summary = inSummary.value.trim();
    const image = inImage.value.trim();
    const content = inContent.value;
    const featured = inFeatured.checked;

    const headers = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    try {
      // Passo 1: Buscar o index.json existente do repositório para ler o conteúdo atual e o SHA
      btnSubmit.textContent = 'Buscando índice de notícias atual...';
      const indexUrl = `https://api.github.com/repos/${owner}/${repo}/contents/noticias/index.json?ref=${branch}`;
      
      let indexSha = null;
      let noticiasList = [];

      const indexResponse = await fetch(indexUrl, { headers });
      
      if (indexResponse.ok) {
        const indexData = await indexResponse.json();
        indexSha = indexData.sha;
        const decodedContent = btou(indexData.content.replace(/\s/g, ''));
        noticiasList = JSON.parse(decodedContent);
      } else if (indexResponse.status !== 404) {
        throw new Error(`Falha ao ler o index.json do GitHub. Código HTTP: ${indexResponse.status}`);
      }

      // Passo 2: Preparar a nova matéria e o novo index.json
      btnSubmit.textContent = 'Preparando arquivos da matéria...';
      const slug = slugify(title);
      const dateNow = new Date().toISOString().split('T')[0];
      const fileName = `${dateNow}-${slug}.md`;
      const fileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/noticias/${fileName}`;
      
      // Formatação da data ISO local simples
      const isoDate = new Date().toISOString().replace(/\.\d+Z$/, '-03:00');
      const imageUrl = image || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200&q=80';

      const mdContent = `---
id: "${slug}"
title: "${title}"
summary: "${summary}"
category: "${category}"
date: "${isoDate}"
author: "${author}"
image: "${imageUrl}"
featured: ${featured ? 'true' : 'false'}
---

${content}`;

      // Monta metadados da nova notícia no topo do feed
      const newArticleMeta = {
        id: slug,
        title: title,
        summary: summary,
        category: category,
        date: isoDate,
        author: author,
        image: imageUrl,
        featured: featured,
        fileName: fileName
      };

      // Adiciona no início da lista e reordena
      noticiasList.unshift(newArticleMeta);
      noticiasList.sort((a, b) => new Date(b.date) - new Date(a.date));
      const updatedJsonString = JSON.stringify(noticiasList, null, 2);

      // Passo 3: Enviar o arquivo .md da notícia para o repositório
      btnSubmit.textContent = 'Enviando arquivo Markdown (.md)...';
      const mdPayload = {
        message: `Publicar noticia: ${title}`,
        content: utob(mdContent),
        branch: branch
      };

      const mdResponse = await fetch(fileUrl, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(mdPayload)
      });

      if (!mdResponse.ok) {
        const errData = await mdResponse.json();
        throw new Error(`Erro ao enviar arquivo .md: ${errData.message || mdResponse.statusText}`);
      }

      // Passo 4: Enviar o index.json atualizado para o repositório
      btnSubmit.textContent = 'Atualizando o índice de notícias...';
      const jsonPayload = {
        message: 'Atualizar indice de noticias',
        content: utob(updatedJsonString),
        branch: branch
      };
      
      // Se o arquivo index.json já existia no GitHub, precisamos enviar o SHA para o Git aceitar o update
      if (indexSha) {
        jsonPayload.sha = indexSha;
      }

      const jsonResponse = await fetch(indexUrl, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(jsonPayload)
      });

      if (!jsonResponse.ok) {
        const errData = await jsonResponse.json();
        throw new Error(`Erro ao atualizar index.json: ${errData.message || jsonResponse.statusText}`);
      }

      // Sucesso na publicação
      alertContainer.innerHTML = `
        <div class="alert alert-success">
          ✅ Matéria publicada e comitada no GitHub! A Vercel reconstruirá o site em aproximadamente 30 segundos.
        </div>
      `;

      // Persiste as configurações no localStorage para facilitar futuros posts
      localStorage.setItem('git_token', token);
      localStorage.setItem('git_owner', owner);
      localStorage.setItem('git_repo', repo);
      localStorage.setItem('git_branch', branch);
      localStorage.setItem('git_author', author);

      // Limpa os campos do formulário de conteúdo
      inTitle.value = '';
      inSummary.value = '';
      inImage.value = '';
      inContent.value = '';
      inFeatured.checked = false;
      
      updatePreview();
      
      // Atualiza o estado das notícias em memória local do navegador para exibição imediata
      state.noticias = noticiasList;

      // Rola o painel do formulário para o topo para ver o alerta de sucesso
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
      console.error('Erro na integração com GitHub API:', error);
      alertContainer.innerHTML = `
        <div class="alert alert-error">
          ❌ Erro ao Publicar: ${error.message || 'Falha de comunicação com a API do GitHub.'}
        </div>
      `;
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Publicar Matéria no GitHub';
    }
  });

  // Atualiza o preview inicialmente
  updatePreview();
}

// Executa a inicialização diretamente (módulos ES já rodam com o DOM pronto)
init();
