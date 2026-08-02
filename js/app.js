import { supabaseClient } from './supabase-client.js';

// Estado global da aplicação
const state = {
  noticias: [],
  rawAnuncios: [],
  currentCategory: null,
  searchQuery: '',
  theme: localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  editingId: null,
  editingSlug: null,
  editingAdId: null
};

// Elementos do DOM
const appContainer = document.getElementById('app');
const mainContent = document.getElementById('main-content');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeIcon = document.getElementById('theme-icon');
const themeText = document.getElementById('theme-text');
const navLinks = document.querySelectorAll('.nav-link');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');

// Mapeamento dinâmico de cores por Categoria
function getCategoryColor(category) {
  const colors = {
    'Economia': 'var(--cat-economia)',
    'Política': 'var(--cat-politica)',
    'Cidades': 'var(--cat-cidades)',
    'Celebridades': 'var(--cat-celebridades)',
    'Opinião': 'var(--cat-opiniao)',
    'Cultura': 'var(--cat-cultura)',
    'Brasil': 'var(--cat-politica)'
  };
  return colors[category] || 'var(--color-accent-orange)';
}

const adConfig = {
  megaTopo: [],
  intermediario: [],
  quadradoLateral: [],
  arranhaceu: []
};

// Busca TODOS os anúncios ativos ou gerenciáveis diretamente da tabela 'anuncios' do Supabase
async function loadAnunciosFromSupabase() {
  try {
    const { data: anuncios, error } = await supabaseClient
      .from('anuncios')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Aviso: Não foi possível carregar os anúncios do Supabase:', error);
      return;
    }

    state.rawAnuncios = anuncios || [];

    // Limpa os arrays de adConfig
    adConfig.megaTopo = [];
    adConfig.intermediario = [];
    adConfig.quadradoLateral = [];
    adConfig.arranhaceu = [];

    if (anuncios && anuncios.length > 0) {
      const activeAds = anuncios.filter(a => a.active);
      activeAds.forEach(ad => {
        if (adConfig[ad.slot]) {
          adConfig[ad.slot].push({
            id: ad.id,
            title: ad.title || 'Anúncio',
            type: ad.type || 'image',
            url: ad.image_url,
            link: ad.link_url || 'https://wa.me/5565993044444'
          });
        }
      });

      // Se a página inicial já tiver sido renderizada, atualiza com os novos anúncios do Supabase
      const hash = window.location.hash;
      const pathname = window.location.pathname;
      if (hash === '' || hash === '#/' || pathname === '/') {
        renderHome();
      }
    }
  } catch (e) {
    console.warn('Erro ao carregar anúncios do Supabase:', e);
  }
}

// Data atual formatada para o topo
function updateHeaderDate() {
  const currentDateEl = document.getElementById('current-date');
  if (currentDateEl) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = new Date().toLocaleDateString('pt-BR', options);
    currentDateEl.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  }
}

// Gerenciamento de Tema (Light / Dark Mode)
function initTheme() {
  if (state.theme === 'dark') {
    document.body.classList.add('dark-mode');
    if (themeIcon) themeIcon.textContent = '☀️';
    if (themeText) themeText.textContent = 'Modo Claro';
  } else {
    document.body.classList.remove('dark-mode');
    if (themeIcon) themeIcon.textContent = '🌙';
    if (themeText) themeText.textContent = 'Modo Escuro';
  }
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('theme', state.theme);
  initTheme();
}

// Inicialização da Aplicação
async function initApp() {
  updateHeaderDate();
  initTheme();
  
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Carrega os anúncios do Supabase de forma assíncrona
  loadAnunciosFromSupabase();

  // Tenta restaurar notícias do cache local instantaneamente (para UX rápida)
  const cachedNoticias = localStorage.getItem('noticias_cache');
  if (cachedNoticias) {
    try {
      state.noticias = JSON.parse(cachedNoticias);
      handleRouting(); // Renderiza com cache imediatamente
    } catch (e) {
      console.warn('Cache local corrompido, buscando da rede...', e);
    }
  }

  // Busca lista atualizada do Supabase / JSON estático em segundo plano
  await loadNoticiasIndex();
  handleRouting();

  // Configura roteamento por hash
  window.addEventListener('hashchange', handleRouting);

  // Configura eventos de busca
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', executeSearch);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') executeSearch();
    });
  }

  // Configura navegação das categorias
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const category = link.getAttribute('data-category');
      if (category && category !== 'home') {
        state.currentCategory = category;
        state.searchQuery = '';
        window.location.hash = `#/categoria/${category.toLowerCase()}`;
      } else {
        state.currentCategory = null;
        state.searchQuery = '';
        window.location.hash = '#/';
      }
    });
  });
}

// Executa a busca
function executeSearch() {
  const query = searchInput.value.trim();
  if (query) {
    state.searchQuery = query;
    state.currentCategory = null;
    window.location.hash = `#/busca/${encodeURIComponent(query)}`;
  }
}

// Carrega o índice de notícias (do Supabase ou fallback para noticias_registry.json)
async function loadNoticiasIndex() {
  try {
    // 1. Tenta carregar as notícias mais recentes diretamente do banco Supabase
    const { data: supabaseNoticias, error } = await supabaseClient
      .from('noticias')
      .select('id, slug, title, summary, category, author, image, featured, date')
      .order('date', { ascending: false });

    if (!error && supabaseNoticias && supabaseNoticias.length > 0) {
      state.noticias = supabaseNoticias;
      localStorage.setItem('noticias_cache', JSON.stringify(supabaseNoticias));
      return;
    }

    // 2. Fallback para noticias_registry.json se o banco não responder
    const response = await fetch('/data/noticias_registry.json');
    if (response.ok) {
      const data = await response.json();
      state.noticias = data.sort((a, b) => new Date(b.date) - new Date(a.date));
      localStorage.setItem('noticias_cache', JSON.stringify(state.noticias));
    } else {
      console.error('Falha ao carregar o índice de notícias.');
    }
  } catch (error) {
    console.error('Erro na requisição das notícias:', error);
  }
}

// Roteador baseado na Hash da URL
async function handleRouting() {
  const hash = window.location.hash || '#/';
  
  if (hash.startsWith('#/anunciar-vaga') || hash.startsWith('/anunciar-vaga')) {
    updateActiveNavLink(null);
    renderAnnounceJob();
    window.scrollTo(0, 0);
    return;
  }
  
  if (hash.startsWith('#/vagas') || hash.startsWith('/vagas')) {
    updateActiveNavLink(null);
    renderJobs();
    window.scrollTo(0, 0);
    return;
  }

  if (hash.startsWith('#/manager') || hash.startsWith('/manager')) {
    updateActiveNavLink(null);
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      renderAdminDashboard(session.user);
    } else {
      renderLoginForm();
    }
    window.scrollTo(0, 0);
    return;
  }

  if (hash.startsWith('#/noticia/')) {
    const slug = hash.replace('#/noticia/', '');
    renderArticlePage(slug);
    updateActiveNavLink(null);
  } else if (hash.startsWith('#/categoria/')) {
    const categorySlug = hash.replace('#/categoria/', '');
    state.currentCategory = categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1);
    updateActiveNavLink(state.currentCategory);
    renderCategoryPage(state.currentCategory);
  } else if (hash.startsWith('#/busca/')) {
    const query = decodeURIComponent(hash.replace('#/busca/', ''));
    state.searchQuery = query;
    updateActiveNavLink(null);
    renderSearchResultsPage(query);
  } else {
    // Rota Home
    state.currentCategory = null;
    state.searchQuery = '';
    updateActiveNavLink('home');
    renderHome();
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

// Renderiza um espaço de anúncio dinâmico (Vídeo, Imagem, Placeholder ou Carrossel Multi-Banners)
const activeCarouselTimers = {};

function renderAdSpace(position) {
  const ads = adConfig[position] || [];
  const whatsappUrl = 'https://wa.me/5565993044444?text=Olá!%20Gostaria%20de%20saber%20mais%20sobre%20os%20espaços%20publicitários%20do%20portal%20Sobre%20o%20Povo.';

  let containerClass = '';
  if (position === 'megaTopo') containerClass = 'ad-mega-banner-topo';
  else if (position === 'intermediario') containerClass = 'ad-full-banner-intermediario';
  else if (position === 'quadradoLateral') containerClass = 'ad-banner-square';
  else if (position === 'arranhaceu') containerClass = 'ad-banner-skyscraper';

  // 1. Caso 0 anúncios ativos: Exibe o Placeholder Padrão
  if (ads.length === 0) {
    if (position === 'megaTopo') {
      return `
        <div class="ad-space-box ad-mega-banner-topo">
          <h3 class="ad-title">ANUNCIE AQUI</h3>
          <p class="ad-desc">Coloque sua marca em evidência no topo do portal de Mato Grosso.</p>
          <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-ad-cta">
            <span class="icon">💬</span> Toque no botão abaixo e converse conosco
          </a>
        </div>
      `;
    }
    if (position === 'intermediario') {
      return `
        <div class="ad-space-box ad-full-banner-intermediario">
          <h3 class="ad-title">ANUNCIE AQUI</h3>
          <p class="ad-desc">Espaço publicitário de alta visibilidade no meio das notícias de Mato Grosso.</p>
          <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-ad-cta">
            <span class="icon">💬</span> Toque no botão abaixo e converse conosco
          </a>
        </div>
      `;
    }
    if (position === 'quadradoLateral') {
      return `
        <div class="ad-space-box ad-banner-square">
          <h3 class="ad-title">ANUNCIE AQUI</h3>
          <p class="ad-desc">Banner Lateral Quadrado (300x250) - Destaque para seu negócio.</p>
          <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-ad-cta">
            <span class="icon">💬</span> Toque no botão abaixo e converse conosco
          </a>
        </div>
      `;
    }
    if (position === 'arranhaceu') {
      return `
        <div class="ad-space-box ad-banner-skyscraper">
          <h3 class="ad-title">ANUNCIE AQUI</h3>
          <p class="ad-desc">Destaque sua empresa na lateral do portal durante a leitura. Banner Arranha-céu (300x600).</p>
          <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-ad-cta">
            <span class="icon">💬</span> Toque no botão abaixo e converse conosco
          </a>
        </div>
      `;
    }
    return '';
  }

  // 2. Caso 1 único anúncio ativo: Exibe a mídia estática normalmente
  if (ads.length === 1) {
    const ad = ads[0];
    const linkUrl = ad.link || whatsappUrl;

    if (ad.type === 'video' && ad.url) {
      return `
        <div class="ad-space-box ${containerClass} ad-space-active-media" onclick="window.open('${linkUrl}', '_blank')">
          <video class="ad-media-video" src="${ad.url}" autoplay loop muted playsinline></video>
          <div class="ad-media-overlay">
            <div class="ad-media-overlay-content">
              <span class="icon">💬</span> Toque para saber mais
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="ad-space-box ${containerClass} ad-space-active-media" onclick="window.open('${linkUrl}', '_blank')">
        <img class="ad-media-image" src="${ad.url}" alt="${ad.title || 'Publicidade'}" />
        <div class="ad-media-overlay">
          <div class="ad-media-overlay-content">
            <span class="icon">💬</span> Toque para saber mais
          </div>
        </div>
      </div>
    `;
  }

  // 3. Caso 2 ou mais anúncios ativos: Inicializa o Carrossel Dinâmico
  const carouselId = `ad-carousel-${position}`;
  
  // Agenda a inicialização do timer de rotação do carrossel após inserção no DOM
  setTimeout(() => {
    initAdCarousel(carouselId, ads.length);
  }, 150);

  const slidesHtml = ads.map((ad, idx) => `
    <div class="ad-carousel-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}" onclick="window.open('${ad.link || whatsappUrl}', '_blank')">
      ${ad.type === 'video' ? `
        <video class="ad-media-video" src="${ad.url}" autoplay loop muted playsinline></video>
      ` : `
        <img class="ad-media-image" src="${ad.url}" alt="${ad.title || 'Publicidade'}" />
      `}
      <div class="ad-media-overlay">
        <div class="ad-media-overlay-content">
          <span class="icon">💬</span> Toque para saber mais (${idx + 1}/${ads.length})
        </div>
      </div>
    </div>
  `).join('');

  const dotsHtml = ads.map((_, idx) => `
    <button class="ad-carousel-dot ${idx === 0 ? 'active' : ''}" data-carousel="${carouselId}" data-slide="${idx}" aria-label="Ir para banner ${idx + 1}"></button>
  `).join('');

  return `
    <div class="ad-space-box ${containerClass} ad-space-active-media" id="${carouselId}">
      <div class="ad-carousel-wrapper">
        ${slidesHtml}
        <div class="ad-carousel-dots">
          ${dotsHtml}
        </div>
      </div>
    </div>
  `;
}

// Inicializa a rotação automática e navegação por dots do Carrossel de Anúncios
function initAdCarousel(containerId, totalSlides) {
  if (activeCarouselTimers[containerId]) {
    clearInterval(activeCarouselTimers[containerId]);
  }

  const container = document.getElementById(containerId);
  if (!container) return;

  let currentIdx = 0;

  function goToSlide(index) {
    currentIdx = (index + totalSlides) % totalSlides;
    const slides = container.querySelectorAll('.ad-carousel-slide');
    const dots = container.querySelectorAll('.ad-carousel-dot');

    slides.forEach((s, idx) => {
      if (idx === currentIdx) s.classList.add('active');
      else s.classList.remove('active');
    });

    dots.forEach((d, idx) => {
      if (idx === currentIdx) d.classList.add('active');
      else d.classList.remove('active');
    });
  }

  // Rotação automática a cada 5.5 segundos
  activeCarouselTimers[containerId] = setInterval(() => {
    goToSlide(currentIdx + 1);
  }, 5500);

  // Pausa a rotação se o leitor passar o mouse por cima
  container.addEventListener('mouseenter', () => {
    if (activeCarouselTimers[containerId]) clearInterval(activeCarouselTimers[containerId]);
  });

  container.addEventListener('mouseleave', () => {
    if (activeCarouselTimers[containerId]) clearInterval(activeCarouselTimers[containerId]);
    activeCarouselTimers[containerId] = setInterval(() => {
      goToSlide(currentIdx + 1);
    }, 5500);
  });

  // Ouvinte de clique nos dots de navegação
  const dots = container.querySelectorAll('.ad-carousel-dot');
  dots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      const slideIdx = parseInt(dot.getAttribute('data-slide'), 10);
      goToSlide(slideIdx);
    });
  });
}

// Renderiza a Página Inicial (Home) com grid e sidebar
function renderHome() {
  if (state.noticias.length === 0) {
    mainContent.innerHTML = renderErrorState(
      'Nenhuma Notícia Publicada',
      'Ainda não temos notícias disponíveis no momento. Volte em breve!'
    );
    return;
  }

  updateSEO(
    'Sobre o Povo - O Portal de Notícias de Mato Grosso',
    'Fique informado com as últimas notícias sobre política, economia, cidades, cultura e cotidiano de Cuiabá e Mato Grosso.',
    null,
    '#/',
    'website'
  );

  const featured = state.noticias.find(n => n.featured) || state.noticias[0];
  const feedNoticias = state.noticias.filter(n => n.id !== featured.id);
  const latestSidebar = state.noticias.slice(0, 6);

  mainContent.innerHTML = `
    <!-- ESP-4: Mega Banner Topo (970x150) -->
    ${renderAdSpace('megaTopo')}

    <div class="home-layout fade-in">
      <!-- Coluna Principal (Feed de Notícias) -->
      <div class="main-feed-column">
        
        <!-- Notícia em Destaque Principal -->
        <article class="featured-card">
          <a href="#/noticia/${featured.slug}">
            <div class="featured-img-container">
              <span class="category-badge" style="background-color: ${getCategoryColor(featured.category)}">
                ${featured.category}
              </span>
              <img class="featured-img" src="${getValidNewsImage(featured.image)}" alt="${featured.title}" onerror="this.onerror=null; this.src='https://sobreopovo.com.br/assets/logosemfundo.png';" />
            </div>
          </a>
          <div class="featured-content">
            <a href="#/noticia/${featured.slug}">
              <h2 class="featured-title">${featured.title}</h2>
            </a>
            <p class="featured-summary">${featured.summary}</p>
            <div class="article-meta">
              <span class="meta-author">Por ${featured.author}</span>
              <span>&bull;</span>
              <span class="meta-date">${formatFriendlyDate(featured.date)}</span>
            </div>
          </div>
        </article>

        <!-- ESP-3: Full Banner Intermediário (728x90) -->
        ${renderAdSpace('intermediario')}

        <!-- Feed Secundário de Notícias (Grid) -->
        <div class="news-feed-grid">
          ${feedNoticias.map(noticia => renderNewsCard(noticia)).join('')}
        </div>

      </div>

      <!-- Coluna Lateral (Sidebar) -->
      <aside class="sidebar">
        <!-- Widget: Últimas Notícias -->
        <div class="widget-box">
          <h3 class="widget-title">Mais Recentes</h3>
          <div class="latest-list">
            ${latestSidebar.map(noticia => renderLatestSidebarItem(noticia)).join('')}
          </div>
        </div>

        <!-- ESP-1: Banner Quadrado Lateral (300x250) -->
        ${renderAdSpace('quadradoLateral')}

        <!-- ESP-2: Banner Arranha-céu Lateral (300x600) -->
        ${renderAdSpace('arranhaceu')}
      </aside>
    </div>
  `;
}

// Renderiza a Página de Categoria
function renderCategoryPage(category) {
  const filteredNoticias = state.noticias.filter(
    n => n.category.toLowerCase() === category.toLowerCase()
  );

  updateSEO(
    `${category} - Notícias de Mato Grosso | Sobre o Povo`,
    `Acompanhe as últimas matérias e atualizações sobre ${category} no portal Sobre o Povo.`,
    null,
    `#/categoria/${category.toLowerCase()}`,
    'website'
  );

  if (filteredNoticias.length === 0) {
    mainContent.innerHTML = `
      ${renderFilterInfoBar()}
      ${renderErrorState(
        'Nenhuma Notícia Encontrada',
        `Não encontramos matérias publicadas na editoria "${category}".`
      )}
    `;
    return;
  }

  const featured = filteredNoticias[0];
  const remaining = filteredNoticias.slice(1);
  const latestSidebar = state.noticias.slice(0, 6);

  mainContent.innerHTML = `
    ${renderFilterInfoBar()}
    <div class="home-layout fade-in">
      <div class="main-feed-column">
        <article class="featured-card">
          <a href="#/noticia/${featured.slug}">
            <div class="featured-img-container">
              <span class="category-badge" style="background-color: ${getCategoryColor(featured.category)}">
                ${featured.category}
              </span>
              <img class="featured-img" src="${getValidNewsImage(featured.image)}" alt="${featured.title}" onerror="this.onerror=null; this.src='https://sobreopovo.com.br/assets/logosemfundo.png';" />
            </div>
          </a>
          <div class="featured-content">
            <a href="#/noticia/${featured.slug}">
              <h2 class="featured-title">${featured.title}</h2>
            </a>
            <p class="featured-summary">${featured.summary}</p>
            <div class="article-meta">
              <span class="meta-author">Por ${featured.author}</span>
              <span>&bull;</span>
              <span class="meta-date">${formatFriendlyDate(featured.date)}</span>
            </div>
          </div>
        </article>

        ${renderAdSpace('intermediario')}

        <div class="news-feed-grid">
          ${remaining.map(noticia => renderNewsCard(noticia)).join('')}
        </div>
      </div>

      <aside class="sidebar">
        <div class="widget-box">
          <h3 class="widget-title">Mais Recentes</h3>
          <div class="latest-list">
            ${latestSidebar.map(noticia => renderLatestSidebarItem(noticia)).join('')}
          </div>
        </div>
        ${renderAdSpace('quadradoLateral')}
      </aside>
    </div>
  `;

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

// Renderiza a Página de Resultados de Busca
function renderSearchResultsPage(query) {
  const lowerQuery = query.toLowerCase();
  const filteredNoticias = state.noticias.filter(n =>
    n.title.toLowerCase().includes(lowerQuery) ||
    n.summary.toLowerCase().includes(lowerQuery) ||
    n.category.toLowerCase().includes(lowerQuery)
  );

  updateSEO(
    `Busca por "${query}" | Sobre o Povo`,
    `Resultados da pesquisa por ${query} no portal de notícias Sobre o Povo.`,
    null,
    `#/busca/${encodeURIComponent(query)}`,
    'website'
  );

  if (filteredNoticias.length === 0) {
    mainContent.innerHTML = `
      ${renderFilterInfoBar()}
      ${renderErrorState(
        'Nenhum Resultado Encontrado',
        `Não encontramos matérias que correspondam ao termo "${query}". Tente buscar por palavras mais genéricas.`
      )}
    `;
  } else {
    mainContent.innerHTML = `
      ${renderFilterInfoBar()}
      <section class="search-results-container fade-in">
        <h2 class="widget-title" style="margin-bottom: 1.5rem;">Foram encontrados ${filteredNoticias.length} resultado(s)</h2>
        <div class="news-feed-grid">
          ${filteredNoticias.map(noticia => renderNewsCard(noticia)).join('')}
        </div>
      </section>
    `;
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

// Helper para validar e fallback de URL da imagem da notícia
function getValidNewsImage(image) {
  const defaultImg = 'https://sobreopovo.com.br/assets/logosemfundo.png';
  if (!image || typeof image !== 'string' || image.trim() === '') {
    return defaultImg;
  }
  return image.trim();
}

// Template de Card de Notícia Padrão (Feed Secundário)
function renderNewsCard(noticia) {
  const validImg = getValidNewsImage(noticia.image);
  return `
    <article class="news-card">
      <a href="#/noticia/${noticia.slug}" class="news-img-container">
        <img src="${validImg}" alt="${noticia.title}" loading="lazy" onerror="this.onerror=null; this.src='https://sobreopovo.com.br/assets/logosemfundo.png';" />
      </a>
      <div class="news-card-content">
        <span class="category-badge" style="position: static; display: inline-block; align-self: flex-start; margin-bottom: 0.5rem; background-color: ${getCategoryColor(noticia.category)}">
          ${noticia.category}
        </span>
        <a href="#/noticia/${noticia.slug}">
          <h3 class="news-card-title">${noticia.title}</h3>
        </a>
        <p class="news-card-summary">${noticia.summary}</p>
        <div class="news-card-footer article-meta">
          <span>Por ${noticia.author}</span>
          <span>&bull;</span>
          <span>${formatFriendlyDate(noticia.date)}</span>
        </div>
      </div>
    </article>
  `;
}

// Renderiza a Página Completa da Notícia
async function renderArticlePage(slug) {
  let noticia = state.noticias.find(n => n.slug === slug);

  if (!noticia || !noticia.content) {
    try {
      const { data, error } = await supabaseClient
        .from('noticias')
        .select('*')
        .eq('slug', slug)
        .single();

      if (!error && data) {
        noticia = data;
      }
    } catch (e) {
      console.warn('Não foi possível carregar o artigo via Supabase:', e);
    }
  }

  if (!noticia) {
    mainContent.innerHTML = renderErrorState(
      'Notícia Não Encontrada',
      'A matéria que você tentou acessar não existe ou foi removida.'
    );
    return;
  }

  const validImg = getValidNewsImage(noticia.image);

  updateSEO(
    `${noticia.title} | Sobre o Povo`,
    noticia.summary,
    validImg,
    `#/noticia/${noticia.slug}`,
    'article'
  );

  let bodyContent = noticia.content;
  if (!bodyContent) {
    bodyContent = `
      <p><b>${noticia.summary}</b></p>
      <p>Reportagem completa sobre ${noticia.title.toLowerCase()} em atualização pela redação do portal <b>Sobre o Povo</b>.</p>
    `;
  }

  let creditsHtml = '';
  if (noticia.credits && noticia.credits.trim()) {
    const formattedCredits = noticia.credits.trim().replace(/\n/g, '<br>');
    creditsHtml = `
      <footer class="article-credits-box" style="margin-top: 2.5rem; padding: 1.25rem; background-color: var(--color-bg-main); border-left: 4px solid var(--color-accent-orange); border-radius: var(--radius-badge);">
        <div style="font-family: var(--font-headings); font-weight: 700; font-size: 0.95rem; color: var(--color-accent-orange); margin-bottom: 0.5rem; text-transform: uppercase;">Envolvidos e Ficha Técnica</div>
        <div style="font-size: 0.9rem; color: var(--color-text-muted); line-height: 1.6;">${formattedCredits}</div>
      </footer>
    `;
  }

  mainContent.innerHTML = `
    <div class="article-container fade-in">
      <div class="btn-back" id="btn-back-home">
        <span>&larr;</span> Voltar para as Notícias
      </div>

      <article class="article-page">
        <header class="article-header">
          <span class="category-badge" style="position: static; display: inline-block; margin-bottom: 1rem; background-color: ${getCategoryColor(noticia.category)}">
            ${noticia.category}
          </span>
          <h1 class="article-title">${noticia.title}</h1>
          <p class="article-subtitle">${noticia.summary}</p>
          
          <div class="article-meta">
            <span class="meta-author">Por <strong>${noticia.author}</strong></span>
            <span>&bull;</span>
            <span class="meta-date">Publicado em ${formatFriendlyDate(noticia.date)}</span>
          </div>
        </header>

        <img class="article-hero-img" src="${validImg}" alt="${noticia.title}" onerror="this.onerror=null; this.src='https://sobreopovo.com.br/assets/logosemfundo.png';" />

        <div class="article-body">
          ${bodyContent}
        </div>

        ${creditsHtml}
      </article>

      ${renderAdSpace('intermediario')}
    </div>
  `;

  document.getElementById('btn-back-home').addEventListener('click', () => {
    window.location.hash = '#/';
  });
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

    <!-- Navegação por Abas do Painel Administrativo -->
    <div class="admin-tabs-nav">
      <button type="button" class="admin-tab-btn active" id="tab-btn-news">
        📰 Gerenciar Notícias
      </button>
      <button type="button" class="admin-tab-btn" id="tab-btn-ads">
        📢 Gerenciar Anúncios e Banners
      </button>
      <button id="btn-logout" style="margin-left: auto; background-color: transparent; border: 1px solid var(--color-border); color: var(--color-text-light); padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; transition: all 0.2s;">
        Sair (Logout)
      </button>
    </div>

    <!-- ABA 1: GERENCIAMENTO DE NOTÍCIAS -->
    <div id="tab-content-news">
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
              <div style="display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-start;">
                <h2 class="admin-form-title" id="form-mode-title" style="margin: 0;">Painel de Publicação de Notícias</h2>
                <button type="button" id="btn-cancel-edit" style="display: none; background: none; border: none; color: var(--color-accent-orange); cursor: pointer; font-size: 0.85rem; font-weight: bold; text-align: left; padding: 0; text-decoration: underline;">
                  ← Cancelar Edição (Voltar ao Cadastro)
                </button>
              </div>
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
                    <option value="Cidades">Cidades</option>
                    <option value="Economia">Economia</option>
                    <option value="Cultura">Cultura</option>
                    <option value="Celebridades">Celebridades</option>
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
    </div>

    <!-- ABA 2: GERENCIAMENTO DE ANÚNCIOS E BANNERS -->
    <div id="tab-content-ads" style="display: none;">
      <div style="display: flex; flex-direction: column; gap: 2rem; max-width: 900px; margin: 0 auto;">
        
        <!-- Formulário de Cadastro/Edição de Anúncio -->
        <div class="admin-form-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid var(--color-border); padding-bottom: 1rem;">
            <div style="display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-start;">
              <h2 class="admin-form-title" id="ad-form-mode-title" style="margin: 0;">Alocação e Cadastro de Anúncio (Supabase)</h2>
              <button type="button" id="btn-cancel-ad-edit" style="display: none; background: none; border: none; color: var(--color-accent-orange); cursor: pointer; font-size: 0.85rem; font-weight: bold; text-align: left; padding: 0; text-decoration: underline;">
                ← Cancelar Edição (Voltar ao Cadastro)
              </button>
            </div>
          </div>
          
          <div id="ad-alert-container"></div>
          
          <form id="ad-manager-form">
            <div class="form-group row-flex">
              <div>
                <label class="form-label" for="ad-slot">Espaço Publicitário (Slot)</label>
                <select class="form-control" id="ad-slot" required>
                  <option value="megaTopo">Mega Banner Topo (970x250)</option>
                  <option value="intermediario">Full Banner Intermediário (728x90)</option>
                  <option value="quadradoLateral">Banner Quadrado Lateral (300x250)</option>
                  <option value="arranhaceu">Banner Arranha-céu Lateral (300x600)</option>
                </select>
              </div>
              <div>
                <label class="form-label" for="ad-title">Nome do Anunciante / Cliente</label>
                <input type="text" class="form-control" id="ad-title" required placeholder="Ex: Vibe Boa Menina" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="ad-link">Link de Destino ao Clicar (WhatsApp ou Loja)</label>
              <input type="url" class="form-control" id="ad-link" required placeholder="Ex: https://wa.me/5565993044444 ou https://site.com.br" />
            </div>

            <div class="form-group">
              <label class="form-label" for="ad-image-file">Arte do Anúncio (Upload Direto do Computador para o Supabase)</label>
              <input type="file" class="form-control" id="ad-image-file" accept="image/*,video/*" style="padding: 0.5rem;" />
              <p style="font-size: 0.75rem; color: var(--color-text-light); margin-top: 0.35rem;">Escolha o arquivo de imagem/vídeo no seu computador. O site fará o upload direto para o Supabase Storage.</p>
            </div>

            <div class="form-group">
              <label class="form-label" for="ad-image-url">Ou URL da Imagem Externa (Opcional)</label>
              <input type="text" class="form-control" id="ad-image-url" placeholder="Ex: https://wnvpkbddmhnznybvmqam.supabase.co/storage/..." />
            </div>

            <div class="form-group">
              <label class="form-checkbox-label">
                <input type="checkbox" class="form-checkbox" id="ad-active" checked />
                Anúncio Ativo no Portal (Se houver múltiplos anúncios ativos no mesmo espaço, eles formarão um carrossel automático rotativo)
              </label>
            </div>

            <button type="submit" class="btn-publish" id="ad-submit-btn">
              Salvar Anúncio no Supabase
            </button>
          </form>
        </div>

        <!-- Lista de Anúncios Cadastrados -->
        <div class="admin-form-card">
          <h2 class="admin-form-title" style="font-size: 1.5rem; margin-bottom: 1.5rem;">Banners e Anúncios Cadastrados no Banco</h2>
          <div id="ad-list-container"></div>
        </div>

      </div>
    </div>
  `;

  // Ouvintes de Alternância de Abas (Notícias x Anúncios)
  const tabBtnNews = document.getElementById('tab-btn-news');
  const tabBtnAds = document.getElementById('tab-btn-ads');
  const tabContentNews = document.getElementById('tab-content-news');
  const tabContentAds = document.getElementById('tab-content-ads');

  tabBtnNews.addEventListener('click', () => {
    tabBtnNews.classList.add('active');
    tabBtnAds.classList.remove('active');
    tabContentNews.style.display = 'block';
    tabContentAds.style.display = 'none';
  });

  tabBtnAds.addEventListener('click', () => {
    tabBtnAds.classList.add('active');
    tabBtnNews.classList.remove('active');
    tabContentAds.style.display = 'block';
    tabContentNews.style.display = 'none';
    renderAdManagerList();
  });

  // Ouvinte do botão de Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    if (confirm('Tem certeza que deseja sair do painel administrativo?')) {
      await supabaseClient.auth.signOut();
      renderLoginForm();
    }
  });

  // =========================================================================
  // LÓGICA DA ABA DE NOTÍCIAS
  // =========================================================================
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
  const formModeTitle = document.getElementById('form-mode-title');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');

  btnCancelEdit.addEventListener('click', () => {
    state.editingId = null;
    state.editingSlug = null;
    formModeTitle.textContent = 'Painel de Publicação de Notícias';
    btnCancelEdit.style.display = 'none';
    btnSubmit.textContent = 'Publicar Matéria no Portal';
    
    inTitle.value = '';
    inSummary.value = '';
    inImageUrl.value = '';
    inImageFile.value = '';
    inContent.innerHTML = '';
    inFeatured.checked = false;
    inCredits.value = '';
    btnCreditsNo.click();
    
    updatePreview();
  });

  const btnCreditsYes = document.getElementById('btn-credits-yes');
  const btnCreditsNo = document.getElementById('btn-credits-no');
  const creditsInputGroup = document.getElementById('credits-input-group');
  let hasCredits = false;

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

  const prevBadge = document.getElementById('prev-badge');
  const prevTitle = document.getElementById('prev-title');
  const prevSummary = document.getElementById('prev-summary');
  const prevAuthor = document.getElementById('prev-author');
  const prevImage = document.getElementById('prev-image');
  const prevBody = document.getElementById('prev-body');
  const prevCreditsBox = document.getElementById('prev-credits-box');
  const prevCreditsContent = document.getElementById('prev-credits-content');

  if (localStorage.getItem('git_author')) inAuthor.value = localStorage.getItem('git_author');

  const toolbar = document.getElementById('floating-toolbar');
  
  function checkTextSelection() {
    const selection = window.getSelection();
    if (!selection.isCollapsed && selection.toString().trim().length > 0 && inContent.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      toolbar.style.display = 'flex';
      toolbar.style.top = `${rect.top + window.scrollY - toolbar.offsetHeight - 8}px`;
      toolbar.style.left = `${rect.left + window.scrollX + (rect.width / 2) - (toolbar.offsetWidth / 2)}px`;
    } else {
      toolbar.style.display = 'none';
    }
  }

  document.addEventListener('selectionchange', checkTextSelection);
  window.addEventListener('resize', () => toolbar.style.display = 'none');

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

    const richTextHtml = inContent.innerHTML.trim();
    if (richTextHtml && richTextHtml !== '<br>') {
      prevBody.innerHTML = richTextHtml;
    } else {
      prevBody.innerHTML = '<p>O corpo da notícia redigido no editor aparecerá formatado aqui em tempo real.</p>';
    }

    if (hasCredits && inCredits.value.trim()) {
      prevCreditsBox.style.display = 'block';
      prevCreditsContent.innerHTML = inCredits.value.trim().replace(/\n/g, '<br>');
    } else {
      prevCreditsBox.style.display = 'none';
    }
  }

  inTitle.addEventListener('input', updatePreview);
  inSummary.addEventListener('input', updatePreview);
  inAuthor.addEventListener('input', updatePreview);
  inCategory.addEventListener('change', updatePreview);
  inImageUrl.addEventListener('input', updatePreview);
  inContent.addEventListener('input', updatePreview);
  inContent.addEventListener('blur', updatePreview);
  inImageFile.addEventListener('change', updatePreview);
  inCredits.addEventListener('input', updatePreview);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertContainer.innerHTML = '';
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Enviando dados...';

    const author = inAuthor.value.trim();
    const category = inCategory.value;
    const title = inTitle.value.trim();
    const summary = inSummary.value.trim();
    const contentHtml = inContent.innerHTML.trim();
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

      let dbError;
      if (state.editingId) {
        const { error: updateError } = await supabaseClient
          .from('noticias')
          .update({
            slug, title, summary, category, author, image: finalImageUrl, content: contentHtml, featured, credits: credits
          })
          .eq('id', state.editingId);
        dbError = updateError;
      } else {
        const { error: insertError } = await supabaseClient
          .from('noticias')
          .insert([{
            slug, title, summary, category, author, image: finalImageUrl, content: contentHtml, featured, credits: credits
          }]);
        dbError = insertError;
      }

      if (dbError) throw dbError;

      alertContainer.innerHTML = `
        <div class="alert alert-success">
          ✅ Matéria ${state.editingId ? 'atualizada' : 'publicada'} e disponível no portal instantaneamente!
        </div>
      `;

      localStorage.setItem('git_author', author);

      if (state.editingId) {
        state.editingId = null;
        state.editingSlug = null;
        formModeTitle.textContent = 'Painel de Publicação de Notícias';
        btnCancelEdit.style.display = 'none';
      }

      inTitle.value = '';
      inSummary.value = '';
      inImageUrl.value = '';
      inImageFile.value = '';
      inContent.innerHTML = '';
      inFeatured.checked = false;
      inCredits.value = '';
      btnCreditsNo.click();
      
      updatePreview();
      await loadNoticiasIndex();
      renderManagerArticlesList();
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
      console.error('Erro ao salvar notícia no Supabase:', error);
      alertContainer.innerHTML = `
        <div class="alert alert-error">
          ❌ Erro ao Salvar: ${error.message || 'Falha de comunicação com o Supabase.'}
        </div>
      `;
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = state.editingId ? 'Salvar Alterações' : 'Publicar Matéria no Portal';
    }
  });

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
            <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
              <button class="btn-edit-article" data-id="${noticia.id}" style="background-color: var(--color-accent-orange); color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; font-weight: bold; transition: background-color 0.2s;">
                Editar
              </button>
              <button class="btn-delete-article" data-id="${noticia.id}" data-title="${noticia.title}" style="background-color: #e74c3c; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; font-weight: bold; transition: background-color 0.2s;">
                Excluir
              </button>
            </div>
          </li>
        `).join('')}
      </ul>
    `;
    
    const deleteButtons = listContainer.querySelectorAll('.btn-delete-article');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const title = btn.getAttribute('data-title');
        if (confirm(`Tem certeza que deseja excluir permanentemente a notícia "${title}"?`)) {
          btn.disabled = true;
          try {
            await supabaseClient.from('noticias').delete().eq('id', id);
            await loadNoticiasIndex();
            renderManagerArticlesList();
          } catch (err) {
            alert('Erro ao excluir notícia.');
          }
        }
      });
    });

    const editButtons = listContainer.querySelectorAll('.btn-edit-article');
    editButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          const { data: noticia } = await supabaseClient.from('noticias').select('*').eq('id', id).single();
          if (noticia) {
            state.editingId = noticia.id;
            state.editingSlug = noticia.slug;
            formModeTitle.textContent = 'Editando Matéria (Supabase)';
            btnCancelEdit.style.display = 'inline-block';
            btnSubmit.textContent = 'Salvar Alterações';
            inAuthor.value = noticia.author || 'Redação';
            inCategory.value = noticia.category;
            inTitle.value = noticia.title;
            inSummary.value = noticia.summary;
            inImageUrl.value = noticia.image || '';
            inContent.innerHTML = noticia.content || '';
            inFeatured.checked = noticia.featured === true;
            if (noticia.credits) { inCredits.value = noticia.credits; btnCreditsYes.click(); } else { btnCreditsNo.click(); }
            updatePreview();
            window.scrollTo({ top: document.querySelector('.admin-form-card').offsetTop - 20, behavior: 'smooth' });
          }
        } catch (e) {
          alert('Erro ao carregar dados da notícia.');
        }
      });
    });
  }

  // =========================================================================
  // LÓGICA DA ABA DE GESTÃO DE ANÚNCIOS (SUPABASE STORAGE & CARROSSEL)
  // =========================================================================
  const adForm = document.getElementById('ad-manager-form');
  const inAdSlot = document.getElementById('ad-slot');
  const inAdTitle = document.getElementById('ad-title');
  const inAdLink = document.getElementById('ad-link');
  const inAdImageFile = document.getElementById('ad-image-file');
  const inAdImageUrl = document.getElementById('ad-image-url');
  const inAdActive = document.getElementById('ad-active');
  const btnAdSubmit = document.getElementById('ad-submit-btn');
  const adAlertContainer = document.getElementById('ad-alert-container');
  const adFormModeTitle = document.getElementById('ad-form-mode-title');
  const btnCancelAdEdit = document.getElementById('btn-cancel-ad-edit');

  btnCancelAdEdit.addEventListener('click', () => {
    state.editingAdId = null;
    adFormModeTitle.textContent = 'Alocação e Cadastro de Anúncio (Supabase)';
    btnCancelAdEdit.style.display = 'none';
    btnAdSubmit.textContent = 'Salvar Anúncio no Supabase';
    inAdTitle.value = '';
    inAdLink.value = '';
    inAdImageUrl.value = '';
    inAdImageFile.value = '';
    inAdActive.checked = true;
  });

  adForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    adAlertContainer.innerHTML = '';
    btnAdSubmit.disabled = true;
    btnAdSubmit.textContent = 'Processando...';

    const slot = inAdSlot.value;
    const title = inAdTitle.value.trim();
    const linkUrl = inAdLink.value.trim();
    const active = inAdActive.checked;

    let resolution = '970x250';
    if (slot === 'intermediario') resolution = '728x90';
    else if (slot === 'quadradoLateral') resolution = '300x250';
    else if (slot === 'arranhaceu') resolution = '300x600';

    try {
      let finalImageUrl = inAdImageUrl.value.trim();

      // 1. Processa upload de arte diretamente para o Supabase Storage se arquivo foi anexado
      if (inAdImageFile.files && inAdImageFile.files[0]) {
        btnAdSubmit.textContent = 'Fazendo upload da arte do anúncio para o Supabase Storage...';
        const file = inAdImageFile.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `ad_${slot}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabaseClient.storage
          .from('imagens-noticias')
          .upload(fileName, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabaseClient.storage
          .from('imagens-noticias')
          .getPublicUrl(fileName);

        finalImageUrl = publicUrl;
      }

      if (!finalImageUrl) {
        alert('Por favor, faça o upload de um arquivo de imagem do anúncio ou insira uma URL de imagem.');
        btnAdSubmit.disabled = false;
        btnAdSubmit.textContent = state.editingAdId ? 'Salvar Alterações do Anúncio' : 'Salvar Anúncio no Supabase';
        return;
      }

      btnAdSubmit.textContent = 'Gravando no banco de dados Supabase...';

      const type = (inAdImageFile.files && inAdImageFile.files[0] && inAdImageFile.files[0].type.includes('video')) || finalImageUrl.endsWith('.mp4') ? 'video' : 'image';

      if (state.editingAdId) {
        const { error: updateError } = await supabaseClient
          .from('anuncios')
          .update({
            slot,
            title,
            image_url: finalImageUrl,
            link_url: linkUrl,
            resolution,
            type,
            active
          })
          .eq('id', state.editingAdId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabaseClient
          .from('anuncios')
          .insert([{
            slot,
            title,
            image_url: finalImageUrl,
            link_url: linkUrl,
            resolution,
            type,
            active
          }]);

        if (insertError) throw insertError;
      }

      adAlertContainer.innerHTML = `
        <div class="alert alert-success">
          ✅ Anúncio ${state.editingAdId ? 'atualizado' : 'cadastrado'} com sucesso no Supabase!
        </div>
      `;

      if (state.editingAdId) {
        btnCancelAdEdit.click();
      } else {
        inAdTitle.value = '';
        inAdLink.value = '';
        inAdImageUrl.value = '';
        inAdImageFile.value = '';
        inAdActive.checked = true;
      }

      await loadAnunciosFromSupabase();
      renderAdManagerList();

    } catch (err) {
      console.error('Erro ao salvar anúncio no Supabase:', err);
      adAlertContainer.innerHTML = `
        <div class="alert alert-error">
          ❌ Erro ao salvar anúncio: ${err.message || 'Falha de conexão com o Supabase.'}
        </div>
      `;
    } finally {
      btnAdSubmit.disabled = false;
      btnAdSubmit.textContent = state.editingAdId ? 'Salvar Alterações do Anúncio' : 'Salvar Anúncio no Supabase';
    }
  });

  // Renderiza a lista de anúncios cadastrados divididos por Slot
  function renderAdManagerList() {
    const listContainer = document.getElementById('ad-list-container');
    if (!listContainer) return;

    const slotLabels = {
      megaTopo: 'Mega Banner Topo (970x250)',
      intermediario: 'Full Banner Intermediário (728x90)',
      quadradoLateral: 'Banner Quadrado Lateral (300x250)',
      arranhaceu: 'Banner Arranha-céu Lateral (300x600)'
    };

    const slots = ['megaTopo', 'intermediario', 'quadradoLateral', 'arranhaceu'];

    let html = '';

    slots.forEach(slotKey => {
      const slotAds = (state.rawAnuncios || []).filter(a => a.slot === slotKey);
      const activeCount = slotAds.filter(a => a.active).length;

      let carouselStatus = '';
      if (activeCount === 0) carouselStatus = '<span style="color: var(--color-text-light); font-size: 0.8rem;">(0 ativos - Exibindo Anuncie Aqui)</span>';
      else if (activeCount === 1) carouselStatus = '<span style="color: #27ae60; font-size: 0.8rem; font-weight: bold;">(1 ativo - Banner Fixo)</span>';
      else carouselStatus = `<span style="color: var(--color-accent-orange); font-size: 0.8rem; font-weight: bold;">(${activeCount} ativos - 🔥 Carrossel Automático Ativado)</span>`;

      html += `
        <div class="ad-slot-section">
          <div class="ad-slot-header">
            <h3 class="ad-slot-title">
              📌 ${slotLabels[slotKey]} ${carouselStatus}
            </h3>
          </div>
          
          ${slotAds.length === 0 ? `
            <p style="font-size: 0.85rem; color: var(--color-text-light); margin: 0;">Nenhum anúncio cadastrado para este espaço.</p>
          ` : `
            <div>
              ${slotAds.map(ad => `
                <div class="ad-item-card">
                  <img src="${ad.image_url}" alt="${ad.title}" class="ad-item-thumb" onerror="this.src='https://via.placeholder.com/100x60?text=Sem+Imagem';" />
                  <div class="ad-item-info">
                    <div class="ad-item-title">${ad.title || 'Sem título'}</div>
                    <div class="ad-item-link">🔗 ${ad.link_url}</div>
                  </div>
                  <div>
                    <span class="${ad.active ? 'ad-badge-active' : 'ad-badge-inactive'}">
                      ${ad.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div style="display: flex; gap: 0.4rem;">
                    <button class="btn-toggle-ad-active" data-id="${ad.id}" data-active="${ad.active}" style="background: ${ad.active ? '#e67e22' : '#27ae60'}; color: white; border: none; padding: 0.35rem 0.65rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: bold;">
                      ${ad.active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button class="btn-edit-ad" data-id="${ad.id}" style="background: var(--color-accent-orange); color: white; border: none; padding: 0.35rem 0.65rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: bold;">
                      Editar
                    </button>
                    <button class="btn-delete-ad" data-id="${ad.id}" data-title="${ad.title}" style="background: #e74c3c; color: white; border: none; padding: 0.35rem 0.65rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: bold;">
                      Excluir
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
    });

    listContainer.innerHTML = html;

    const toggleBtns = listContainer.querySelectorAll('.btn-toggle-ad-active');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const currentActive = btn.getAttribute('data-active') === 'true';
        btn.disabled = true;

        try {
          await supabaseClient
            .from('anuncios')
            .update({ active: !currentActive })
            .eq('id', id);

          await loadAnunciosFromSupabase();
          renderAdManagerList();
        } catch (err) {
          alert('Erro ao alterar status do anúncio.');
        }
      });
    });

    const deleteBtns = listContainer.querySelectorAll('.btn-delete-ad');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const title = btn.getAttribute('data-title');

        if (confirm(`Tem certeza que deseja excluir o anúncio "${title}"?`)) {
          btn.disabled = true;
          try {
            await supabaseClient.from('anuncios').delete().eq('id', id);
            await loadAnunciosFromSupabase();
            renderAdManagerList();
          } catch (err) {
            alert('Erro ao excluir anúncio.');
          }
        }
      });
    });

    const editBtns = listContainer.querySelectorAll('.btn-edit-ad');
    editBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const ad = (state.rawAnuncios || []).find(a => a.id === id);

        if (ad) {
          state.editingAdId = ad.id;
          adFormModeTitle.textContent = 'Editando Anúncio (Supabase)';
          btnCancelAdEdit.style.display = 'inline-block';
          btnAdSubmit.textContent = 'Salvar Alterações do Anúncio';

          inAdSlot.value = ad.slot;
          inAdTitle.value = ad.title || '';
          inAdLink.value = ad.link_url || '';
          inAdImageUrl.value = ad.image_url || '';
          inAdImageFile.value = '';
          inAdActive.checked = ad.active === true;

          const formCard = document.querySelector('#tab-content-ads .admin-form-card');
          if (formCard) {
            window.scrollTo({ top: formCard.offsetTop - 20, behavior: 'smooth' });
          }
        }
      });
    });
  }

  updatePreview();
  renderManagerArticlesList();
}

// Função para renderizar o Portal de Vagas de Emprego
function renderJobs() {
  updateSEO(
    'Portal de Vagas de Emprego MT',
    'Encontre vagas de emprego e oportunidades de trabalho na Baixada Cuiabana e em todo o estado de Mato Grosso no portal Sobre o Povo.',
    null,
    '#/vagas',
    'website'
  );

  const mockJobs = [
    {
      id: 1,
      title: 'Assistente Administrativo',
      company: 'Grupo Comercial Cuiabá',
      location: 'Cuiabá - MT',
      type: 'Tempo Integral',
      salary: 'R$ 2.400 - R$ 2.800',
      description: 'Atuação em rotinas administrativas, emissão de notas fiscais, atendimento ao cliente e controle de planilhas de estoque.',
      date: 'Publicada hoje'
    },
    {
      id: 2,
      title: 'Operador de Logística',
      company: 'Distribuidora Araguaia',
      location: 'Várzea Grande - MT',
      type: 'Tempo Integral',
      salary: 'R$ 2.100 + Benefícios',
      description: 'Conferência de mercadorias, organização de paletes, carga e descarga e controle de entrada/saída de caminhões.',
      date: 'Publicada ontem'
    },
    {
      id: 3,
      title: 'Vendedor Interno (Agronegócio)',
      company: 'AgroSul Insumos',
      location: 'Rondonópolis - MT',
      type: 'Tempo Integral',
      salary: 'R$ 3.000 + Comissões',
      description: 'Prospecção e atendimento a produtores rurais, venda de insumos e sementes e acompanhamento de pós-venda.',
      date: 'Publicada há 2 dias'
    },
    {
      id: 4,
      title: 'Técnico em Manutenção Predial',
      company: 'Shopping Parque Cuiabá',
      location: 'Cuiabá - MT',
      type: 'Escala 12x36',
      salary: 'R$ 2.600 + Periculosidade',
      description: 'Manutenção preventiva e corretiva de instalações elétricas, hidráulicas e de ar-condicionado central.',
      date: 'Publicada há 3 dias'
    }
  ];

  mainContent.innerHTML = `
    <div class="article-container fade-in" style="max-width: 1000px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h1 class="widget-title" style="font-size: 2rem; margin: 0;">💼 Vagas de Emprego em MT</h1>
          <p style="color: var(--color-text-muted); font-size: 0.95rem; margin-top: 0.25rem;">Oportunidades de trabalho atualizadas diariamente em Mato Grosso.</p>
        </div>
        <a href="#/anunciar-vaga" class="btn-ad-cta" style="font-size: 0.9rem; padding: 0.6rem 1.4rem;">
          <span class="icon">📢</span> Anunciar Vaga Gratuitamente
        </a>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        ${mockJobs.map(job => `
          <div class="news-card" style="padding: 1.5rem; flex-direction: row; justify-content: space-between; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 280px;">
              <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                <span class="category-badge" style="position: static; font-size: 0.7rem; background-color: var(--cat-economia);">${job.type}</span>
                <span style="font-size: 0.8rem; color: var(--color-text-light); font-weight: 600;">${job.location}</span>
              </div>
              <h3 style="font-family: var(--font-headings); font-size: 1.25rem; font-weight: 800; color: var(--color-text-main); margin-bottom: 0.25rem;">${job.title}</h3>
              <div style="font-size: 0.9rem; font-weight: 700; color: var(--color-accent-orange); margin-bottom: 0.5rem;">🏢 ${job.company} &bull; ${job.salary}</div>
              <p style="font-size: 0.88rem; color: var(--color-text-muted); line-height: 1.5;">${job.description}</p>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.75rem;">
              <span style="font-size: 0.75rem; color: var(--color-text-light);">${job.date}</span>
              <a href="https://wa.me/5565993044444?text=Olá!%20Gostaria%20de%20me%20candidatar%20à%20vaga%20de%20${encodeURIComponent(job.title)}" target="_blank" rel="noopener noreferrer" class="btn-ad-cta" style="padding: 0.45rem 1rem; font-size: 0.8rem;">
                Candidatar-se 💬
              </a>
            </div>
          </div>
        `).join('')}
      </div>

      ${renderAdSpace('intermediario')}
    </div>
  `;
}

// Função para renderizar formulário de Anunciar Vaga
function renderAnnounceJob() {
  updateSEO(
    'Anunciar Vaga de Emprego | Sobre o Povo',
    'Publique sua vaga de emprego no portal Sobre o Povo e alcance candidatos qualificados em Mato Grosso.',
    null,
    '#/anunciar-vaga',
    'website'
  );

  mainContent.innerHTML = `
    <div class="article-container fade-in" style="max-width: 700px;">
      <div class="admin-form-card" style="padding: 2rem;">
        <h1 class="admin-form-title" style="font-size: 1.8rem; text-align: center; margin-bottom: 0.5rem;">📢 Anuncie sua Vaga de Emprego</h1>
        <p style="text-align: center; color: var(--color-text-muted); font-size: 0.9rem; margin-bottom: 2rem;">Preencha os dados da oportunidade para divulgação no portal Sobre o Povo.</p>
        
        <form id="job-announce-form">
          <div class="form-group">
            <label class="form-label">Título do Cargo / Vaga</label>
            <input type="text" class="form-control" required placeholder="Ex: Auxiliar Financeiro" />
          </div>
          <div class="form-group row-flex">
            <div>
              <label class="form-label">Nome da Empresa</label>
              <input type="text" class="form-control" required placeholder="Ex: Mercado Central" />
            </div>
            <div>
              <label class="form-label">Cidade / Estado</label>
              <input type="text" class="form-control" required placeholder="Ex: Cuiabá - MT" value="Cuiabá - MT" />
            </div>
          </div>
          <div class="form-group row-flex">
            <div>
              <label class="form-label">Tipo de Contrato</label>
              <select class="form-control">
                <option value="CLT">Tempo Integral (CLT)</option>
                <option value="Estágio">Estágio</option>
                <option value="PJ">Prestador de Serviço (PJ)</option>
                <option value="Temporário">Temporário</option>
              </select>
            </div>
            <div>
              <label class="form-label">Faixa Salarial (Opcional)</label>
              <input type="text" class="form-control" placeholder="Ex: R$ 2.500 ou A Combinar" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Descrição das Atividades e Requisitos</label>
            <textarea class="form-control" required placeholder="Descreva brevemente as responsabilidades e requisitos do candidato..." style="min-height: 120px;"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">WhatsApp ou E-mail para Envio de Currículos</label>
            <input type="text" class="form-control" required placeholder="Ex: (65) 99999-8888 ou rh@empresa.com.br" />
          </div>
          <button type="submit" class="btn-publish" style="width: 100%; margin-top: 1rem;">
            Enviar Vaga para Aprovação
          </button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('job-announce-form').addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Vaga enviada com sucesso! Nossa equipe revisará a oportunidade e publicará no portal em breve.');
    window.location.hash = '#/vagas';
  });
}

// Renderiza Estado de Erro / Não Encontrado
function renderErrorState(title, message) {
  return `
    <div class="article-container fade-in" style="text-align: center; padding: 4rem 1.5rem;">
      <h2 style="font-family: var(--font-headings); font-size: 2rem; color: var(--color-accent-orange); margin-bottom: 1rem;">${title}</h2>
      <p style="color: var(--color-text-muted); font-size: 1.1rem; max-width: 600px; margin: 0 auto 2rem auto;">${message}</p>
      <a href="#/" class="btn-ad-cta" style="display: inline-flex;">
        <span>&larr;</span> Voltar para a Página Inicial
      </a>
    </div>
  `;
}

// Formatação amigável de datas em Português
function formatFriendlyDate(dateString) {
  if (!dateString) return 'Data recente';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Agora mesmo';
    if (diffInSeconds < 3600) return `Há ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Há ${Math.floor(diffInSeconds / 3600)} horas`;
    
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (e) {
    return dateString;
  }
}

// Atualização de SEO Dinâmico Meta Tags
function updateSEO(title, description, image, path, type = 'website') {
  document.title = title;

  const setMetaTag = (selector, attribute, value) => {
    let el = document.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      const parts = selector.split('[');
      const attrName = parts[1].split('=')[0];
      el.setAttribute(attrName, parts[1].split('=')[1].replace(/['"]/g, '').replace(']', ''));
      document.head.appendChild(el);
    }
    el.setAttribute(attribute, value);
  };

  setMetaTag('meta[name="description"]', 'content', description);
  setMetaTag('meta[property="og:title"]', 'content', title);
  setMetaTag('meta[property="og:description"]', 'content', description);
  setMetaTag('meta[property="og:type"]', 'content', type);
  setMetaTag('meta[property="og:url"]', 'content', `https://sobreopovo.com.br/${path}`);

  if (image) {
    setMetaTag('meta[property="og:image"]', 'content', image);
    setMetaTag('meta[name="twitter:image"]', 'content', image);
  }
}

// Inicializa a aplicação ao carregar o DOM
document.addEventListener('DOMContentLoaded', initApp);
