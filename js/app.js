import { formatFriendlyDate, getCategoryColor } from './utils.js';

// Configurações do Supabase obtidas do usuário
const supabaseUrl = 'https://wnvpkbddmhnznybvmqam.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudnBrYmRkbWhuem55YnZtcWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjEzODgsImV4cCI6MjA5Nzg5NzM4OH0.q1OllfKvmIhjoCNTCGPKQB_5opZIVgJc0L5_8BZj7Ew';

// Inicializa o cliente do Supabase carregado globalmente no index.html
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

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
    themeToggleBtn.innerHTML = '☀️';
    themeToggleBtn.setAttribute('title', 'Mudar para o Modo Claro');
  } else {
    themeToggleBtn.innerHTML = '🌙';
    themeToggleBtn.setAttribute('title', 'Mudar para o Modo Escuro');
  }
}

// Configura ouvintes de eventos globais
function setupEventListeners() {
  themeToggleBtn.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('theme', state.theme);
    updateThemeIcon();
  });

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

  window.addEventListener('hashchange', handleRouting);
}

// Carrega as notícias diretamente da tabela do Supabase
async function loadNoticiasIndex() {
  try {
    const { data, error } = await supabaseClient
      .from('noticias')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) throw error;
    state.noticias = data || [];
  } catch (error) {
    console.error('Erro ao buscar as notícias no Supabase:', error);
    mainContent.innerHTML = renderErrorState(
      'Erro de Conexão',
      'Não foi possível carregar as notícias do banco de dados do Supabase. Verifique a tabela.'
    );
  }
}

// Lida com o roteamento simples baseado no Hash da URL
function handleRouting() {
  const hash = window.location.hash;
  
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
    const slug = hash.replace('#/noticia/', '');
    renderArticle(slug);
  } else if (hash === '#/manager') {
    updateActiveNavLink(null);
    renderManager();
  } else {
    mainContent.innerHTML = renderErrorState('Página Não Encontrada', 'A seção que você está procurando não existe.');
  }
  
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
  if (state.noticias.length === 0) {
    mainContent.innerHTML = renderErrorState(
      'Nenhuma Notícia Publicada',
      'Não encontramos nenhuma matéria cadastrada no banco de dados. Acesse o painel e publique a primeira!'
    );
    return;
  }

  let htmlContent = '';
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

  if (state.currentCategory || state.searchQuery) {
    htmlContent += renderFilterInfoBar();
  }

  if (state.currentCategory || state.searchQuery) {
    htmlContent += `<div class="news-grid">${filteredNoticias.map(renderNewsCard).join('')}</div>`;
  } else {
    // 1. Identificar o dia mais recente ativo no portal
    const latestArticleDate = new Date(filteredNoticias[0].date);
    const latestDateStr = latestArticleDate.toISOString().split('T')[0];

    // 2. Separar as notícias de "Hoje" (último dia ativo) das notícias de dias anteriores
    const todayNoticias = filteredNoticias.filter(n => {
      const itemDateStr = new Date(n.date).toISOString().split('T')[0];
      return itemDateStr === latestDateStr;
    });

    const olderNoticias = filteredNoticias.filter(n => {
      const itemDateStr = new Date(n.date).toISOString().split('T')[0];
      return itemDateStr !== latestDateStr;
    });

    // 3. A Notícia Principal é a mais recente de hoje (ou a marcada como destaque se houver uma de hoje com destaque)
    const featured = todayNoticias.find(n => n.featured) || todayNoticias[0];
    
    // 4. Outras notícias de hoje vão para o grid de destaque da direita
    const otherTodayNoticias = todayNoticias.filter(n => n.id !== featured.id);

    // Precisamos de mais 2 cards para preencher o grid de destaque (ao todo 3 no topo)
    let rightCards = [...otherTodayNoticias];
    if (rightCards.length < 2) {
      const fillCount = 2 - rightCards.length;
      const fillItems = olderNoticias.slice(0, fillCount);
      rightCards = [...rightCards, ...fillItems];
    }

    const card2 = rightCards[0];
    const card3 = rightCards[1];

    // As notícias restantes (que não estão no topo) vão para o grid "Leia Mais"
    const topIds = new Set([featured.id, card2?.id, card3?.id].filter(Boolean));
    const gridItems = filteredNoticias.filter(n => !topIds.has(n.id));

    // Monta os marcadores adicionais para a matéria principal da esquerda
    let bulletsHtml = '';
    if (card2) {
      bulletsHtml += `<li><a href="#/noticia/${card2.slug}">${card2.title}</a></li>`;
    }
    if (card3) {
      bulletsHtml += `<li><a href="#/noticia/${card3.slug}">${card3.title}</a></li>`;
    }

    htmlContent += `
      <div class="home-grid">
        <!-- Card Grande da Esquerda (Destaque Principal) -->
        <a href="#/noticia/${featured.slug}" class="home-card card-large">
          <div class="card-bg-image" style="background-image: url('${featured.image}')"></div>
          <div class="card-overlay"></div>
          <div class="card-content">
            <span class="card-category" style="color: ${getCategoryColor(featured.category)}">
              ${featured.category}
            </span>
            <h2 class="card-title">${featured.title}</h2>
            <p class="card-summary">${featured.summary}</p>
            ${bulletsHtml ? `<ul class="card-bullets">${bulletsHtml}</ul>` : ''}
          </div>
        </a>

        <!-- Coluna da Direita (Dois Cards Menores) -->
        <div class="home-grid-right">
          ${card2 ? `
            <a href="#/noticia/${card2.slug}" class="home-card card-small">
              <div class="card-bg-image" style="background-image: url('${card2.image}')"></div>
              <div class="card-overlay"></div>
              <div class="card-content">
                <span class="card-category" style="color: ${getCategoryColor(card2.category)}">
                  ${card2.category}
                </span>
                <h3 class="card-title">${card2.title}</h3>
                <p class="card-summary">${card2.summary}</p>
              </div>
            </a>
          ` : ''}
          ${card3 ? `
            <a href="#/noticia/${card3.slug}" class="home-card card-small">
              <div class="card-bg-image" style="background-image: url('${card3.image}')"></div>
              <div class="card-overlay"></div>
              <div class="card-content">
                <span class="card-category" style="color: ${getCategoryColor(card3.category)}">
                  ${card3.category}
                </span>
                <h3 class="card-title">${card3.title}</h3>
                <p class="card-summary">${card3.summary}</p>
              </div>
            </a>
          ` : ''}
        </div>
      </div>
    `;

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
      <a href="#/noticia/${noticia.slug}">
        <h4 class="latest-title">${noticia.title}</h4>
      </a>
    </div>
  `;
}

// Template de Card de Notícia Padrão (Feed Secundário)
function renderNewsCard(noticia) {
  return `
    <article class="news-card">
      <a href="#/noticia/${noticia.slug}" class="news-img-container">
        <img src="${noticia.image}" alt="${noticia.title}" loading="lazy" />
      </a>
      <div class="news-card-content">
        <span class="category-badge" style="background-color: ${getCategoryColor(noticia.category)}">
          ${noticia.category}
        </span>
        <a href="#/noticia/${noticia.slug}">
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

// Renderiza a Página de Artigo Detalhado (Leitura Editorial via Supabase)
async function renderArticle(slug) {
  mainContent.innerHTML = renderSkeletonLoader();

  try {
    const { data: meta, error } = await supabaseClient
      .from('noticias')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !meta) {
      mainContent.innerHTML = renderErrorState(
        'Notícia Não Encontrada',
        'Desculpe, o conteúdo que você está tentando acessar não existe ou foi removido do portal.'
      );
      return;
    }

    // Se o conteúdo começar com tag HTML, assumimos que é rich text, senão tentamos Markdown como fallback
    let bodyHtml = meta.content;
    const isHtml = /<[a-z][\s\S]*>/i.test(meta.content);
    if (!isHtml && typeof marked !== 'undefined' && marked.parse) {
      bodyHtml = marked.parse(meta.content);
    } else if (!isHtml) {
      bodyHtml = `<p>${meta.content.replace(/\n\n/g, '</p><p>')}</p>`;
    }

    // Estrutura de exibição dos créditos no rodapé da página
    let creditsHtml = '';
    if (meta.credits) {
      creditsHtml = `
        <footer class="article-credits-box">
          <div class="article-credits-title">Envolvidos e Ficha Técnica</div>
          <p>${meta.credits.replace(/\n/g, '<br>')}</p>
        </footer>
      `;
    }

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
        
        ${creditsHtml}
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
    </div>
  `;
}

// Template de Mensagem de Erro amigável
function renderErrorState(title, message) {
  return `
    <div class="error-state">
      <h2 class="error-title">${title}</h2>
      <p class="error-message">${message}</p>
    </div>
  `;
}

// Renderiza a Área Administrativa (CMS / Manager com Supabase Auth)
async function renderManager() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    renderLoginForm();
  } else {
    renderAdminDashboard(session.user);
  }
}

// Exibe formulário de Login do Administrador/Redator
function renderLoginForm() {
  mainContent.innerHTML = `
    <div class="admin-panel-container" style="display: flex; justify-content: center; align-items: center; min-height: 50vh;">
      <div class="admin-form-card" style="width: 100%; max-width: 450px;">
        <h2 class="admin-form-title" style="text-align: center; margin-bottom: 2rem;">Acesso Administrativo</h2>
        
        <div id="login-alert-container"></div>
        
        <form id="login-form">
          <div class="form-group">
            <label class="form-label" for="login-email">Email</label>
            <input type="email" class="form-control" id="login-email" required placeholder="seu-email@dominio.com" />
          </div>
          
          <div class="form-group">
            <label class="form-label" for="login-password">Senha</label>
            <input type="password" class="form-control" id="login-password" required placeholder="Digite sua senha" />
          </div>
          
          <button type="submit" class="btn-publish" id="login-submit-btn" style="width: 100%; margin-top: 1rem;">
            Fazer Login
          </button>
        </form>
      </div>
    </div>
  `;

  const loginForm = document.getElementById('login-form');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const loginBtn = document.getElementById('login-submit-btn');
  const alertContainer = document.getElementById('login-alert-container');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginBtn.disabled = true;
    loginBtn.textContent = 'Autenticando...';
    alertContainer.innerHTML = '';

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: loginEmail.value.trim(),
        password: loginPassword.value
      });

      if (error) throw error;

      renderAdminDashboard(data.user);
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      alertContainer.innerHTML = `
        <div class="alert alert-error">
          ❌ Erro ao autenticar: ${error.message || 'Verifique seus dados e tente novamente.'}
        </div>
      `;
      loginBtn.disabled = false;
      loginBtn.textContent = 'Fazer Login';
    }
  });
}

// Exibe o painel administrativo completo para o usuário autenticado
function renderAdminDashboard(user) {
  mainContent.innerHTML = `
    <!-- Menu Flutuante de Formatação de Texto Rico -->
    <div class="floating-toolbar" id="floating-toolbar">
      <button type="button" id="btn-bold" title="Negrito"><b>B</b></button>
      <button type="button" id="btn-italic" title="Itálico"><i>I</i></button>
      <button type="button" id="btn-underline" title="Sublinhado"><u>U</u></button>
      <div class="divider"></div>
      <button type="button" id="btn-h3" title="Subtítulo">H3</button>
      <button type="button" id="btn-ul" title="Lista Comum">• Lista</button>
      <div class="divider"></div>
      <button type="button" id="btn-link" title="Inserir Link">🔗 Link</button>
    </div>

    <div class="admin-panel-container">
      <!-- Coluna Esquerda: Formulário e Lista de Matérias -->
      <div style="display: flex; flex-direction: column; gap: 2rem;">
        
        <!-- Breve Tutorial de Publicação -->
        <div class="tutorial-card">
          <div class="tutorial-title">📖 Como Publicar Matérias no Novo Painel</div>
          <ol class="tutorial-list">
            <li>Insira as informações básicas (Autor, Editoria, Título e Resumo).</li>
            <li>No campo **Corpo da Matéria**, digite o texto livremente como no Word ou Notion.</li>
            <li>**Para formatar o texto:** Use o mouse ou teclado para selecionar qualquer palavra ou trecho do texto. Um menu flutuante aparecerá na hora com opções de **Negrito, Itálico, Sublinhado, Subtítulo, Listas e Links**!</li>
            <li>Escolha se deseja colocar créditos no rodapé e clique em **Publicar Matéria**.</li>
          </ol>
        </div>

        <div class="admin-form-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid var(--color-border); padding-bottom: 1rem;">
            <h2 class="admin-form-title" style="margin: 0;">Painel de Publicação (Supabase)</h2>
            <button id="btn-logout" style="background-color: transparent; border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; transition: all 0.2s;">
              Sair (Logout)
            </button>
          </div>
          
          <div id="manager-alert-container"></div>
          
          <form id="manager-form">
            <div class="form-group row-flex">
              <div>
                <label class="form-label" for="m-author">Autor / Repórter</label>
                <input type="text" class="form-control" id="m-author" required placeholder="Ex: Redação" value="Redação" />
              </div>
              <div>
                <label class="form-label" for="m-category">Editoria / Categoria</label>
                <select class="form-control" id="m-category">
                  <option value="Brasil">Brasil</option>
                  <option value="Política">Política</option>
                  <option value="Economia">Economia</option>
                  <option value="Cultura">Cultura</option>
                  <option value="Opinião">Opinião</option>
                </select>
              </div>
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
              <label class="form-label" for="m-image-file">Foto de Capa (Upload Direto do Computador - Opcional)</label>
              <input type="file" class="form-control" id="m-image-file" accept="image/*" style="padding: 0.5rem;" />
              <p style="font-size: 0.75rem; color: var(--color-text-light); margin-top: 0.35rem;">Você também pode colar um link de imagem no campo abaixo se preferir.</p>
            </div>

            <div class="form-group">
              <label class="form-label" for="m-image-url">Ou URL da Imagem Externa (Opcional)</label>
              <input type="text" class="form-control" id="m-image-url" placeholder="Ex: https://images.unsplash.com/photo-..." />
            </div>

            <div class="form-group" style="position: relative;">
              <label class="form-label" for="m-content">Corpo da Matéria (Escreva e selecione palavras para formatar)</label>
              <div contenteditable="true" class="rich-text-editor" id="m-content" placeholder="Escreva o corpo da notícia aqui..."></div>
            </div>

            <!-- Área de Escolha de Créditos -->
            <div class="form-group">
              <label class="form-label">Deseja exibir área de créditos no rodapé da matéria?</label>
              <div class="credits-toggle-container">
                <button type="button" class="btn-toggle-option" id="btn-credits-no">Não</button>
                <button type="button" class="btn-toggle-option" id="btn-credits-yes">Sim</button>
              </div>
            </div>

            <!-- Campo de Créditos Oculto por padrão -->
            <div class="form-group" id="credits-input-group" style="display: none;">
              <label class="form-label" for="m-credits">Ficha Técnica e Créditos (Envolvidos, links, perfis do Instagram...)</label>
              <textarea class="form-control" id="m-credits" placeholder="Ex:\nReportagem: João Silva (@joaosilva)\nFotos: Maria Souza\nSaiba mais em: link-da-fonte.com" style="min-height: 100px;"></textarea>
            </div>

            <div class="form-group">
              <label class="form-checkbox-label">
                <input type="checkbox" class="form-checkbox" id="m-featured" />
                Destacar como Notícia Principal no topo da Home
              </label>
            </div>

            <button type="submit" class="btn-publish" id="m-submit-btn">
              Publicar Matéria no Portal
            </button>
          </form>
        </div>

        <div class="admin-form-card">
          <h2 class="admin-form-title" style="font-size: 1.5rem; margin-bottom: 1.5rem;">Gerenciar Matérias Existentes</h2>
          <div id="manager-list-container"></div>
        </div>
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
                Brasil
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
            
            <footer class="article-credits-box" id="prev-credits-box" style="display: none; margin-top: 2rem;">
              <div class="article-credits-title">Envolvidos e Ficha Técnica</div>
              <p id="prev-credits-content"></p>
            </footer>
          </article>
        </div>
      </div>
    </div>
  `;

  // Ouvinte do botão de Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    if (confirm('Tem certeza que deseja sair do painel administrativo?')) {
      await supabaseClient.auth.signOut();
      renderLoginForm();
    }
  });

  // Elementos do Formulário
  const form = document.getElementById('manager-form');
  const inAuthor = document.getElementById('m-author');
  const inCategory = document.getElementById('m-category');
  const inTitle = document.getElementById('m-title');
  const inSummary = document.getElementById('m-summary');
  const inImageFile = document.getElementById('m-image-file');
  const inImageUrl = document.getElementById('m-image-url');
  const inContent = document.getElementById('m-content');
  const inFeatured = document.getElementById('m-featured');
  const inCredits = document.getElementById('m-credits');
  const btnSubmit = document.getElementById('m-submit-btn');
  const alertContainer = document.getElementById('manager-alert-container');

  // Elementos de Créditos
  const btnCreditsYes = document.getElementById('btn-credits-yes');
  const btnCreditsNo = document.getElementById('btn-credits-no');
  const creditsInputGroup = document.getElementById('credits-input-group');
  let hasCredits = false;

  // Define padrão do botão de créditos
  btnCreditsNo.classList.add('active');

  btnCreditsYes.addEventListener('click', () => {
    hasCredits = true;
    btnCreditsYes.classList.add('active');
    btnCreditsNo.classList.remove('active');
    creditsInputGroup.style.display = 'block';
    updatePreview();
  });

  btnCreditsNo.addEventListener('click', () => {
    hasCredits = false;
    btnCreditsNo.classList.add('active');
    btnCreditsYes.classList.remove('active');
    creditsInputGroup.style.display = 'none';
    inCredits.value = '';
    updatePreview();
  });

  // Elementos do Preview
  const prevBadge = document.getElementById('prev-badge');
  const prevTitle = document.getElementById('prev-title');
  const prevSummary = document.getElementById('prev-summary');
  const prevAuthor = document.getElementById('prev-author');
  const prevImage = document.getElementById('prev-image');
  const prevBody = document.getElementById('prev-body');
  const prevCreditsBox = document.getElementById('prev-credits-box');
  const prevCreditsContent = document.getElementById('prev-credits-content');

  // Recupera autor persistido
  if (localStorage.getItem('git_author')) inAuthor.value = localStorage.getItem('git_author');

  // Logic do Menu Flutuante de Formatação (Estilo Medium/Notion)
  const toolbar = document.getElementById('floating-toolbar');
  
  function checkTextSelection() {
    const selection = window.getSelection();
    
    // Mostra a barra flutuante apenas se houver texto selecionado dentro do editor de texto rico
    if (!selection.isCollapsed && selection.toString().trim().length > 0 && inContent.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      toolbar.style.display = 'flex';
      // Ajusta posicionamento acima da seleção do texto
      toolbar.style.top = `${rect.top + window.scrollY - toolbar.offsetHeight - 8}px`;
      toolbar.style.left = `${rect.left + window.scrollX + (rect.width / 2) - (toolbar.offsetWidth / 2)}px`;
    } else {
      toolbar.style.display = 'none';
    }
  }

  // Verifica a seleção ao mexer o mouse ou soltar teclas no editor
  document.addEventListener('selectionchange', checkTextSelection);
  window.addEventListener('resize', () => toolbar.style.display = 'none');

  // Comandos de formatação ricos (Importante: mousedown com preventDefault evita a perda do foco no texto)
  function registerFormatCommand(btnId, command, arg = null) {
    document.getElementById(btnId).addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.execCommand(command, false, arg);
      updatePreview();
    });
  }

  registerFormatCommand('btn-bold', 'bold');
  registerFormatCommand('btn-italic', 'italic');
  registerFormatCommand('btn-underline', 'underline');
  registerFormatCommand('btn-h3', 'formatBlock', '<h3>');
  registerFormatCommand('btn-ul', 'insertUnorderedList');

  document.getElementById('btn-link').addEventListener('mousedown', (e) => {
    e.preventDefault();
    const url = prompt('Digite a URL do link (ex: https://...):');
    if (url) {
      document.execCommand('createLink', false, url);
      updatePreview();
    }
  });

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
    
    const category = inCategory.value;
    prevBadge.textContent = category;
    prevBadge.style.backgroundColor = getCategoryColor(category);

    const defaultImg = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200&q=80';
    
    if (inImageFile.files && inImageFile.files[0]) {
      prevImage.src = URL.createObjectURL(inImageFile.files[0]);
    } else {
      prevImage.src = inImageUrl.value || defaultImg;
    }

    // Renderiza o HTML gerado pelo editor de texto rico no corpo do preview
    const richTextHtml = inContent.innerHTML.trim();
    if (richTextHtml && richTextHtml !== '<br>') {
      prevBody.innerHTML = richTextHtml;
    } else {
      prevBody.innerHTML = '<p>O corpo da notícia redigido no editor aparecerá formatado aqui em tempo real.</p>';
    }

    // Preview dos créditos
    if (hasCredits && inCredits.value.trim()) {
      prevCreditsBox.style.display = 'block';
      prevCreditsContent.innerHTML = inCredits.value.trim().replace(/\n/g, '<br>');
    } else {
      prevCreditsBox.style.display = 'none';
    }
  }

  // Ouvintes de alteração para Preview
  inTitle.addEventListener('input', updatePreview);
  inSummary.addEventListener('input', updatePreview);
  inAuthor.addEventListener('input', updatePreview);
  inCategory.addEventListener('change', updatePreview);
  inImageUrl.addEventListener('input', updatePreview);
  inContent.addEventListener('input', updatePreview);
  inContent.addEventListener('blur', updatePreview);
  inImageFile.addEventListener('change', updatePreview);
  inCredits.addEventListener('input', updatePreview);

  // Submissão do Formulário de Publicação via Supabase
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    alertContainer.innerHTML = '';
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Enviando dados...';

    const author = inAuthor.value.trim();
    const category = inCategory.value;
    const title = inTitle.value.trim();
    const summary = inSummary.value.trim();
    const contentHtml = inContent.innerHTML.trim(); // Pega a marcação HTML do editor
    const featured = inFeatured.checked;
    const slug = slugify(title);
    const credits = hasCredits ? inCredits.value.trim() : null;

    if (!contentHtml || contentHtml === '<br>') {
      alert('Por favor, escreva o conteúdo do corpo da matéria.');
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Publicar Matéria no Portal';
      return;
    }

    try {
      let finalImageUrl = inImageUrl.value.trim();
      
      // 1. Processar Upload de Foto para o Supabase Storage se houver arquivo local selecionado
      if (inImageFile.files && inImageFile.files[0]) {
        btnSubmit.textContent = 'Fazendo upload da imagem...';
        const file = inImageFile.files[0];
        const fileExt = file.name.split('.').pop();
        const uniqueFileName = `${slug}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabaseClient.storage
          .from('imagens-noticias')
          .upload(uniqueFileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabaseClient.storage
          .from('imagens-noticias')
          .getPublicUrl(uniqueFileName);
          
        finalImageUrl = publicUrl;
      }

      if (!finalImageUrl) {
        finalImageUrl = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200&q=80';
      }

      btnSubmit.textContent = 'Salvando no banco de dados...';

      if (featured) {
        await supabaseClient
          .from('noticias')
          .update({ featured: false })
          .eq('featured', true);
      }

      // 2. Inserir a nova notícia na tabela `noticias` do Supabase
      const { error: insertError } = await supabaseClient
        .from('noticias')
        .insert([{
          slug,
          title,
          summary,
          category,
          author,
          image: finalImageUrl,
          content: contentHtml, // Salva o HTML estruturado do texto
          featured,
          credits: credits // Salva a ficha técnica dos envolvidos
        }]);

      if (insertError) throw insertError;

      alertContainer.innerHTML = `
        <div class="alert alert-success">
          ✅ Matéria publicada e disponível no portal instantaneamente!
        </div>
      `;

      localStorage.setItem('git_author', author);

      // Limpa os campos
      inTitle.value = '';
      inSummary.value = '';
      inImageUrl.value = '';
      inImageFile.value = '';
      inContent.innerHTML = '';
      inFeatured.checked = false;
      inCredits.value = '';
      btnCreditsNo.click(); // Volta a opção de créditos para não
      
      updatePreview();
      
      await loadNoticiasIndex();
      renderManagerArticlesList();

      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
      console.error('Erro ao salvar notícia no Supabase:', error);
      alertContainer.innerHTML = `
        <div class="alert alert-error">
          ❌ Erro ao Publicar: ${error.message || 'Falha de comunicação com o Supabase.'}
        </div>
      `;
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Publicar Matéria no Portal';
    }
  });

  // Renderiza a lista de notícias publicadas no banco para gerenciamento
  function renderManagerArticlesList() {
    const listContainer = document.getElementById('manager-list-container');
    if (!listContainer) return;
    
    if (state.noticias.length === 0) {
      listContainer.innerHTML = '<p style="color: var(--color-text-light);">Nenhuma notícia publicada no banco de dados.</p>';
      return;
    }
    
    listContainer.innerHTML = `
      <ul class="admin-articles-list" style="list-style: none; padding: 0; margin: 0;">
        ${state.noticias.map(noticia => `
          <li style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--color-border); gap: 1rem;">
            <div style="flex: 1; min-width: 0;">
              <strong style="display: block; font-family: var(--font-headings); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${noticia.title}</strong>
              <span style="font-size: 0.8rem; color: var(--color-text-light);">${noticia.category} &bull; ${formatFriendlyDate(noticia.date)}</span>
            </div>
            <button class="btn-delete-article" data-id="${noticia.id}" data-title="${noticia.title}" style="background-color: #e74c3c; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; font-weight: bold; transition: background-color 0.2s;">
              Excluir
            </button>
          </li>
        `).join('')}
      </ul>
    `;
    
    const deleteButtons = listContainer.querySelectorAll('.btn-delete-article');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.getAttribute('data-id');
        const title = btn.getAttribute('data-title');
        
        if (confirm(`Tem certeza que deseja excluir permanentemente a notícia "${title}" do banco de dados?`)) {
          const originalText = btn.textContent;
          btn.disabled = true;
          btn.textContent = 'Excluindo...';
          
          try {
            const { error: deleteError } = await supabaseClient
              .from('noticias')
              .delete()
              .eq('id', id);

            if (deleteError) throw deleteError;

            await loadNoticiasIndex();
            renderManagerArticlesList();

            alertContainer.innerHTML = `
              <div class="alert alert-success">
                ✅ Matéria "${title}" excluída com sucesso!
              </div>
            `;
            window.scrollTo({ top: 0, behavior: 'smooth' });

          } catch (error) {
            console.error('Erro ao deletar matéria:', error);
            alert(`Erro ao Excluir: ${error.message || 'Falha de comunicação com o Supabase.'}`);
            btn.disabled = false;
            btn.textContent = originalText;
          }
        }
      });
    });
  }

  updatePreview();
  renderManagerArticlesList();
}

// Inicializa o app
init();
