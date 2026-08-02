import { formatFriendlyDate, getCategoryColor } from './utils.js';

// Configurações do Supabase obtidas do usuário
const supabaseUrl = 'https://wnvpkbddmhnznybvmqam.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudnBrYmRkbWhuem55YnZtcWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjEzODgsImV4cCI6MjA5Nzg5NzM4OH0.q1OllfKvmIhjoCNTCGPKQB_5opZIVgJc0L5_8BZj7Ew';

// Inicializa o cliente do Supabase carregado globalmente no index.html
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Engine de Anúncios Dinâmicos (Carregados diretamente da tabela 'anuncios' do Supabase)
const DEFAULT_PORTAL_LOGO = 'https://sobreopovo.com.br/assets/logosemfundo.png';

function getValidNewsImage(imgUrl) {
  if (!imgUrl || typeof imgUrl !== 'string') return DEFAULT_PORTAL_LOGO;
  const clean = imgUrl.trim();
  if (clean === '' || clean.toLowerCase() === 'null' || clean.toLowerCase() === 'undefined' || clean.toLowerCase() === 'none') {
    return DEFAULT_PORTAL_LOGO;
  }
  return clean;
}

const adConfig = {
  megaTopo: {
    type: 'placeholder',
    url: '',
    link: 'https://wa.me/5565993044444?text=Olá!%20Gostaria%20de%20anunciar%20no%20espaço%20Mega%20Banner%20Topo%20do%20portal%20Sobre%20o%20Povo.'
  },
  intermediario: {
    type: 'placeholder',
    url: '',
    link: 'https://wa.me/5565993044444?text=Olá!%20Gostaria%20de%20anunciar%20no%20espaço%20Full%20Banner%20Intermediário%20do%20portal%20Sobre%20o%20Povo.'
  },
  quadradoLateral: {
    type: 'placeholder',
    url: '',
    link: 'https://wa.me/5565993044444?text=Olá!%20Gostaria%20de%20anunciar%20no%20espaço%20Banner%20Quadrado%20Lateral%20do%20portal%20Sobre%20o%20Povo.'
  },
  arranhaceu: {
    type: 'placeholder',
    url: '',
    link: 'https://wa.me/5565993044444?text=Olá!%20Gostaria%20de%20anunciar%20no%20espaço%20Banner%20Arranha-céu%20Lateral%20do%20portal%20Sobre%20o%20Povo.'
  }
};

// Busca anúncios ativos diretamente da tabela 'anuncios' do Supabase
async function loadAnunciosFromSupabase() {
  try {
    const { data: anuncios, error } = await supabaseClient
      .from('anuncios')
      .select('*')
      .eq('active', true);

    if (error) {
      console.warn('Aviso: Não foi possível carregar os anúncios do Supabase:', error);
      return;
    }

    if (anuncios && anuncios.length > 0) {
      anuncios.forEach(ad => {
        if (adConfig[ad.slot]) {
          adConfig[ad.slot] = {
            type: ad.type || 'image',
            url: ad.image_url,
            link: ad.link_url || 'https://wa.me/5565993044444'
          };
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

// Estado global da aplicação
const state = {
  noticias: [],
  currentCategory: null,
  searchQuery: '',
  theme: localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  editingId: null,
  editingSlug: null
};

// Seletores DOM principais
const mainContent = document.getElementById('main-content');
const searchInput = document.getElementById('search-input');
const searchForm = document.getElementById('search-form');
const searchInputCompact = document.getElementById('search-input-compact');
const searchFormCompact = document.getElementById('search-form-compact');
const themeToggleBtn = document.getElementById('theme-toggle');
const navLinks = document.querySelectorAll('.nav-link');

// Inicialização da aplicação
async function init() {
  setupTheme();
  updateHeaderDate();
  setupEventListeners();
  await loadAnunciosFromSupabase();
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

// Atualiza as tags SEO na head do documento e os dados estruturados JSON-LD (SEO Local)
function updateSEO(title, description, imageUrl, relativeUrl, type = 'website', extraData = null) {
  const siteName = 'Sobre o Povo | Portal de Notícias de Mato Grosso';
  const fullTitle = title === 'Sobre o Povo' ? siteName : `${title} | Sobre o Povo`;
  const cleanRelativePath = relativeUrl ? relativeUrl.replace(/^#\//, '') : '';
  const absoluteUrl = cleanRelativePath ? `https://sobreopovo.com.br/${cleanRelativePath}` : 'https://sobreopovo.com.br/';
  const finalImage = getValidNewsImage(imageUrl);

  // 1. Atualiza elementos DOM na head
  document.title = fullTitle;
  
  const metaDesc = document.getElementById('meta-description');
  if (metaDesc) metaDesc.setAttribute('content', description);
  
  const canonical = document.getElementById('canonical-link');
  if (canonical) canonical.setAttribute('href', absoluteUrl);

  // 2. Atualiza Open Graph
  const ogType = document.getElementById('meta-og-type');
  if (ogType) ogType.setAttribute('content', type);
  
  const ogUrl = document.getElementById('meta-og-url');
  if (ogUrl) ogUrl.setAttribute('content', absoluteUrl);
  
  const ogTitle = document.getElementById('meta-og-title');
  if (ogTitle) ogTitle.setAttribute('content', fullTitle);
  
  const ogDesc = document.getElementById('meta-og-desc');
  if (ogDesc) ogDesc.setAttribute('content', description);
  
  const ogImage = document.getElementById('meta-og-image');
  if (ogImage) ogImage.setAttribute('content', finalImage);

  // 3. Atualiza Twitter Card
  const twUrl = document.getElementById('meta-tw-url');
  if (twUrl) twUrl.setAttribute('content', absoluteUrl);
  
  const twTitle = document.getElementById('meta-tw-title');
  if (twTitle) twTitle.setAttribute('content', fullTitle);
  
  const twDesc = document.getElementById('meta-tw-desc');
  if (twDesc) twDesc.setAttribute('content', description);
  
  const twImage = document.getElementById('meta-tw-image');
  if (twImage) twImage.setAttribute('content', finalImage);

  // 4. Manipulação de Dados Estruturados JSON-LD
  let ldJsonScript = document.getElementById('ld-seo');
  if (ldJsonScript) {
    ldJsonScript.remove();
  }

  let ldData = {};

  if (type === 'article' && extraData) {
    // Detecta cidades de Mato Grosso para associar localização ao artigo (SEO Local)
    const mtCities = [
      'Cuiabá', 'Rondonópolis', 'Várzea Grande', 'Sinop', 'Sorriso',
      'Lucas do Rio Verde', 'Primavera do Leste', 'Alta Floresta', 'Pontes e Lacerda',
      'Juína', 'Tangará da Serra', 'Cáceres', 'Nova Mutum', 'Barra do Garças', 'Guarantã do Norte',
      'São José do Rio Claro', 'Brasnorte', 'Barra do Bugres', 'Comodoro', 'Mirassol d’Oeste', 'Jaciara'
    ];
    
    let detectedCity = null;
    const textToSearch = `${title} ${description}`.toLowerCase();
    
    for (const city of mtCities) {
      if (textToSearch.includes(city.toLowerCase())) {
        detectedCity = city;
        break;
      }
    }

    ldData = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": title,
      "description": description,
      "image": [finalImage],
      "datePublished": extraData.date || new Date().toISOString(),
      "dateModified": extraData.date || new Date().toISOString(),
      "author": [{
        "@type": "Person",
        "name": extraData.author || "Sobre o Povo",
        "url": "https://sobreopovo.com.br/#/"
      }],
      "publisher": {
        "@type": "Organization",
        "name": "Sobre o Povo",
        "logo": {
          "@type": "ImageObject",
          "url": "https://sobreopovo.com.br/assets/logosemfundo.png"
        }
      }
    };

    if (detectedCity) {
      ldData.contentLocation = {
        "@type": "Place",
        "name": `${detectedCity}, Mato Grosso, Brasil`
      };
    }
  } else {
    // Dados estruturados padrão da Home/Organização focado em MT
    ldData = {
      "@context": "https://schema.org",
      "@type": "NewsMediaOrganization",
      "name": "Sobre o Povo",
      "url": "https://sobreopovo.com.br/",
      "logo": "https://sobreopovo.com.br/assets/logosemfundo.png",
      "address": {
        "@type": "PostalAddress",
        "addressRegion": "MT",
        "addressCountry": "BR"
      },
      "areaServed": [
        {
          "@type": "AdministrativeArea",
          "name": "Mato Grosso"
        }
      ],
      "sameAs": [
        "https://www.facebook.com/sobreopovomt",
        "https://www.instagram.com/sobreopovomt"
      ]
    };
  }

  const newScript = document.createElement('script');
  newScript.type = 'application/ld+json';
  newScript.id = 'ld-seo';
  newScript.text = JSON.stringify(ldData, null, 2);
  document.head.appendChild(newScript);
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

  // Listener para busca padrão (mobile)
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      state.searchQuery = searchInput.value.trim();
      if (searchInputCompact) searchInputCompact.value = state.searchQuery;
      window.location.hash = '#/';
      renderHome();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      if (searchInputCompact) searchInputCompact.value = state.searchQuery;
      if (state.searchQuery === '') {
        renderHome();
      }
    });
  }

  // Listener para busca compacta (desktop)
  if (searchFormCompact) {
    searchFormCompact.addEventListener('submit', (e) => {
      e.preventDefault();
      state.searchQuery = searchInputCompact.value.trim();
      if (searchInput) searchInput.value = state.searchQuery;
      window.location.hash = '#/';
      renderHome();
    });
  }

  if (searchInputCompact) {
    searchInputCompact.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      if (searchInput) searchInput.value = state.searchQuery;
      if (state.searchQuery === '') {
        renderHome();
      }
    });
  }

  window.addEventListener('hashchange', handleRouting);
}

// Carrega as notícias diretamente da tabela do Supabase
async function loadNoticiasIndex() {
  try {
    // 1. Tentar ler do cache localStorage para exibição instantânea (FCP/LCP de 0.2s)
    const cachedData = localStorage.getItem('noticias_cache');
    if (cachedData) {
      try {
        state.noticias = JSON.parse(cachedData);
        // Se estivermos em uma rota de listagem, renderiza o cache imediatamente
        const hash = window.location.hash;
        if (hash === '' || hash === '#/' || hash.startsWith('#/categoria/')) {
          renderHome();
        }
      } catch (e) {
        console.warn('Erro ao restaurar cache de notícias:', e);
      }
    }

    // 2. Consulta otimizada no Supabase (não seleciona content que contém HTML grande)
    const { data, error } = await supabaseClient
      .from('noticias')
      .select('id, slug, title, summary, category, date, author, image, featured, credits')
      .order('date', { ascending: false });
    
    if (error) throw error;
    state.noticias = data || [];

    // 3. Atualizar o cache local para a próxima inicialização
    localStorage.setItem('noticias_cache', JSON.stringify(state.noticias));

    // 4. Se a rota atual for listagem, atualiza a tela com os dados mais recentes do banco
    const hash = window.location.hash;
    if (hash === '' || hash === '#/' || hash.startsWith('#/categoria/')) {
      renderHome();
    }
  } catch (error) {
    console.error('Erro ao buscar as notícias no Supabase:', error);
    // Só exibe estado de erro se o cache estiver vazio e não houver nenhuma notícia carregada
    if (state.noticias.length === 0) {
      mainContent.innerHTML = renderErrorState(
        'Erro de Conexão',
        'Não foi possível carregar as notícias do portal. Verifique sua conexão com a internet.'
      );
    }
  }
}

// Lida com o roteamento híbrido (pathname estático SSG e hash fallback)
function handleRouting() {
  const hash = window.location.hash;
  const pathname = window.location.pathname;

  let targetRoute = hash;
  if ((hash === '' || hash === '#/') && pathname !== '/') {
    targetRoute = pathname;
  }

  if (targetRoute === '' || targetRoute === '#/' || targetRoute === '/') {
    state.currentCategory = null;
    updateActiveNavLink(null);
    renderHome();
  } else if (targetRoute.startsWith('#/categoria/') || targetRoute.startsWith('/categoria/')) {
    const categoryRaw = targetRoute.replace(/^#?\/categoria\//, '');
    const category = decodeURIComponent(categoryRaw.replace(/\/$/, ''));
    state.currentCategory = category;
    updateActiveNavLink(category);
    renderHome();
  } else if (targetRoute.startsWith('#/noticia/') || targetRoute.startsWith('/noticia/')) {
    const slugRaw = targetRoute.replace(/^#?\/noticia\//, '');
    const slug = slugRaw.replace(/\/$/, '');
    renderArticle(slug);
  } else if (targetRoute === '#/manager' || targetRoute === '/manager') {
    updateActiveNavLink(null);
    renderManager();
  } else if (targetRoute === '#/vagas' || targetRoute === '/vagas') {
    updateActiveNavLink('vagas');
    renderJobs();
  } else if (targetRoute === '#/anunciar-vaga' || targetRoute === '/anunciar-vaga') {
    updateActiveNavLink(null);
    renderAnnounceJob();
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

// Renderiza um espaço de anúncio dinâmico (Vídeo, Imagem ou Placeholder)
function renderAdSpace(position) {
  const ad = adConfig[position];
  if (!ad) return '';

  const whatsappUrl = 'https://wa.me/5565993044444?text=Olá!%20Gostaria%20de%20saber%20mais%20sobre%20os%20espaços%20publicitários%20do%20portal%20Sobre%20o%20Povo.';
  const linkUrl = ad.link || whatsappUrl;

  if (ad.type === 'video' && ad.url) {
    let containerClass = '';
    if (position === 'megaTopo') containerClass = 'ad-mega-banner-topo';
    else if (position === 'intermediario') containerClass = 'ad-full-banner-intermediario';
    else if (position === 'quadradoLateral') containerClass = 'ad-banner-square';
    else if (position === 'arranhaceu') containerClass = 'ad-banner-skyscraper';

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

  if (ad.type === 'image' && ad.url) {
    let containerClass = '';
    if (position === 'megaTopo') containerClass = 'ad-mega-banner-topo';
    else if (position === 'intermediario') containerClass = 'ad-full-banner-intermediario';
    else if (position === 'quadradoLateral') containerClass = 'ad-banner-square';
    else if (position === 'arranhaceu') containerClass = 'ad-banner-skyscraper';

    return `
      <div class="ad-space-box ${containerClass} ad-space-active-media" onclick="window.open('${linkUrl}', '_blank')">
        <img class="ad-media-image" src="${ad.url}" alt="Publicidade" />
        <div class="ad-media-overlay">
          <div class="ad-media-overlay-content">
            <span class="icon">💬</span> Toque para saber mais
          </div>
        </div>
      </div>
    `;
  }

  // Fallback / Placeholder padrão
  if (position === 'megaTopo') {
    return `
      <!-- ESP-4: Mega Banner Topo (970x150) -->
      <div class="ad-space-box ad-mega-banner-topo">
        <h3 class="ad-title">ANUNCIE AQUI</h3>
        <p class="ad-desc">Coloque sua marca em evidência no topo do portal de Mato Grosso.</p>
        <a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="btn-ad-cta">
          <span class="icon">💬</span> Toque no botão abaixo e converse conosco
        </a>
      </div>
    `;
  }

  if (position === 'intermediario') {
    return `
      <!-- ESP-3: Full Banner intermediário home (728X90) -->
      <div class="ad-space-box ad-full-banner-intermediario">
        <h3 class="ad-title">ANUNCIE AQUI</h3>
        <p class="ad-desc">Espaço publicitário de alta visibilidade no meio das notícias de Mato Grosso.</p>
        <a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="btn-ad-cta">
          <span class="icon">💬</span> Toque no botão abaixo e converse conosco
        </a>
      </div>
    `;
  }

  if (position === 'quadradoLateral') {
    return `
      <!-- ESP-1: Banner quadrado lateral (300x250) -->
      <div class="ad-space-box ad-banner-square">
        <h3 class="ad-title">ANUNCIE AQUI</h3>
        <p class="ad-desc">Banner Lateral Quadrado (300x250) - Destaque para seu negócio.</p>
        <a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="btn-ad-cta">
          <span class="icon">💬</span> Toque no botão abaixo e converse conosco
        </a>
      </div>
    `;
  }

  if (position === 'arranhaceu') {
    return `
      <!-- ESP-2: Banner arranha-céu (300x600) -->
      <div class="ad-space-box ad-banner-skyscraper">
        <h3 class="ad-title">ANUNCIE AQUI</h3>
        <p class="ad-desc">Destaque sua empresa na lateral do portal durante a leitura. Banner Arranha-céu (300x600).</p>
        <a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="btn-ad-cta">
          <span class="icon">💬</span> Toque no botão abaixo e converse conosco
        </a>
      </div>
    `;
  }

  return '';
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
  
  // Atualiza SEO da Home ou Categoria
  if (state.currentCategory) {
    updateSEO(
      `Notícias de ${state.currentCategory}`,
      `Acompanhe as últimas notícias comunitárias, cotidiano, economia e política sobre ${state.currentCategory} em Mato Grosso no portal Sobre o Povo.`,
      null,
      `#/categoria/${state.currentCategory}`,
      'website'
    );
  } else if (state.searchQuery) {
    updateSEO(
      `Busca por "${state.searchQuery}"`,
      `Resultados de busca para "${state.searchQuery}" no portal de notícias Sobre o Povo.`,
      null,
      `#/`,
      'website'
    );
  } else {
    updateSEO(
      'Sobre o Povo',
      'Sobre o Povo - O seu portal de notícias em Mato Grosso. Acompanhe o jornalismo comunitário de Cuiabá, Várzea Grande, Rondonópolis, Sinop e de todo o estado.',
      null,
      '#/',
      'website'
    );
  }
  
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

    // Monta os marcadores adicionais para a matéria principal da esquerda (usando outras notícias para evitar redundância)
    let bulletsHtml = '';
    const bulletNews = gridItems.slice(0, 2);
    bulletNews.forEach(bn => {
      bulletsHtml += `<li><a href="#/noticia/${bn.slug}">${bn.title}</a></li>`;
    });

    const whatsappUrl = 'https://wa.me/5565993044444?text=Olá!%20Gostaria%20de%20saber%20mais%20sobre%20os%20espaços%20publicitários%20do%20portal%20Sobre%20o%20Povo.';

    htmlContent += `
      ${renderAdSpace('megaTopo')}

      <!-- Banner de Destaque de Vagas de Emprego no Topo -->
      <div class="jobs-highlight-banner" style="margin-bottom: 1rem;">
        <div class="jobs-highlight-content">
          <span class="jobs-highlight-badge">NOVO</span>
          <div class="jobs-highlight-info">
            <h3 class="jobs-highlight-title">Portal de Vagas de Emprego MT</h3>
            <p class="jobs-highlight-desc">Encontre oportunidades de trabalho em Rondonópolis, Cuiabá e em todo o estado de Mato Grosso.</p>
          </div>
        </div>
        <a href="#/vagas" class="jobs-highlight-btn">Ver Vagas →</a>
      </div>

      <!-- Banner de Anúncio para Empresas -->
      <div class="jobs-highlight-banner companies-banner" style="margin-bottom: 2rem; border-left-color: var(--color-category-blue);">
        <div class="jobs-highlight-content">
          <span class="jobs-highlight-badge" style="background-color: var(--color-category-blue);">EMPRESAS</span>
          <div class="jobs-highlight-info">
            <h3 class="jobs-highlight-title">Está contratando? Anuncie sua vaga aqui!</h3>
            <p class="jobs-highlight-desc">Cadastre as oportunidades da sua empresa e encontre talentos locais rapidamente.</p>
          </div>
        </div>
        <a href="#/anunciar-vaga" class="jobs-highlight-btn" style="background-color: var(--color-category-blue);">Anunciar Vaga →</a>
      </div>

      <div class="home-grid">
        <!-- Card Grande da Esquerda (Destaque Principal) -->
        <div class="home-card card-large">
          <img class="card-bg-image" src="${getValidNewsImage(featured.image)}" alt="${featured.title}" fetchpriority="high" onerror="this.onerror=null; this.src='https://sobreopovo.com.br/assets/logosemfundo.png';" />
          <div class="card-overlay"></div>
          <div class="card-content">
            <span class="card-category" style="color: ${getCategoryColor(featured.category)}">
              ${featured.category}
            </span>
            <a href="#/noticia/${featured.slug}" class="stretched-link">
              <h2 class="card-title">${featured.title}</h2>
            </a>
            <p class="card-summary">${featured.summary}</p>
            ${bulletsHtml ? `<ul class="card-bullets">${bulletsHtml}</ul>` : ''}
          </div>
        </div>

        <!-- Coluna da Direita (Dois Cards Menores) -->
        <div class="home-grid-right">
          ${card2 ? `
            <a href="#/noticia/${card2.slug}" class="home-card card-small">
              <img class="card-bg-image" src="${getValidNewsImage(card2.image)}" alt="${card2.title}" loading="lazy" onerror="this.onerror=null; this.src='https://sobreopovo.com.br/assets/logosemfundo.png';" />
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
              <img class="card-bg-image" src="${getValidNewsImage(card3.image)}" alt="${card3.title}" loading="lazy" onerror="this.onerror=null; this.src='https://sobreopovo.com.br/assets/logosemfundo.png';" />
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

    // ESP-3: Full Banner intermediário home (728X90)
    htmlContent += renderAdSpace('intermediario');

    // Seção inferior com Leia Mais + Sidebar com anúncios (ESP-1 e ESP-2)
    htmlContent += `
      <div class="home-lower-layout">
        
        <!-- Coluna de Notícias Principal -->
        <div class="news-main-column">
          <h3 class="section-title" style="margin-bottom: 2rem;">Leia Mais</h3>
          ${gridItems.length > 0 ? `
            <div class="news-grid" style="margin-top: 0;">
              ${gridItems.map(renderNewsCard).join('')}
            </div>
          ` : '<p style="color: var(--color-text-muted);">Não há notícias adicionais cadastradas.</p>'}
        </div>

        <!-- Coluna Lateral (Sidebar de Anúncios) -->
        <aside class="news-sidebar-column">
          <div class="ad-sidebar-wrapper">
            
            ${renderAdSpace('quadradoLateral')}
            ${renderAdSpace('arranhaceu')}

          </div>
        </aside>

      </div>
    `;

    // ESP-5: Vídeos (home do site) - Seção de publicidade em vídeo no final
    htmlContent += `
      <section class="video-ad-section">
        <div class="video-ad-container">
          
          <!-- Mockup de Player de Vídeo -->
          <div class="video-player-mockup">
            <div class="video-player-overlay"></div>
            <div class="video-play-btn-circle" onclick="window.open('${whatsappUrl}', '_blank')">▶</div>
            <div class="video-mockup-footer">
              <span class="video-mockup-title">Seu Vídeo Institucional Aqui</span>
              <span class="video-mockup-duration">0:30 / 1:00</span>
            </div>
          </div>

          <!-- Texto e CTA comercial -->
          <div class="video-ad-info">
            <span class="video-ad-badge">ESPAÇO DE VÍDEO</span>
            <h3 class="video-ad-heading">Divulgue seus vídeos promocionais ou comerciais no nosso portal</h3>
            <p class="video-ad-text">Insira seu vídeo de campanha, comercial de TV ou vídeo institucional diretamente na página principal e converse com o nosso público de forma muito mais dinâmica e interativa.</p>
            <div style="margin-top: 0.5rem;">
              <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn-ad-cta" style="font-size: 0.95rem; padding: 0.7rem 1.5rem;">
                <span class="icon">💬</span> Anuncie seu Vídeo Comercial
              </a>
            </div>
          </div>

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

// Template de Card de Notícia Padrão (Feed Secundário)
function renderNewsCard(noticia) {
  const validImg = getValidNewsImage(noticia.image);
  return `
    <article class="news-card">
      <a href="#/noticia/${noticia.slug}" class="news-img-container">
        <img src="${validImg}" alt="${noticia.title}" loading="lazy" onerror="this.onerror=null; this.src='https://sobreopovo.com.br/assets/logosemfundo.png';" />
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

    const articleImg = getValidNewsImage(meta.image);

    // Atualiza metadados SEO e JSON-LD NewsArticle para buscadores (SEO Local)
    updateSEO(
      meta.title,
      meta.summary,
      articleImg,
      `#/noticia/${meta.slug}`,
      'article',
      { date: meta.date, author: meta.author }
    );

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

        <img class="article-hero-img" src="${articleImg}" alt="${meta.title}" onerror="this.onerror=null; this.src='https://sobreopovo.com.br/assets/logosemfundo.png';" />

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
            <div style="display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-start;">
              <h2 class="admin-form-title" id="form-mode-title" style="margin: 0;">Painel de Publicação (Supabase)</h2>
              <button type="button" id="btn-cancel-edit" style="display: none; background: none; border: none; color: var(--color-accent-orange); cursor: pointer; font-size: 0.85rem; font-weight: bold; text-align: left; padding: 0; text-decoration: underline;">
                ← Cancelar Edição (Voltar ao Cadastro)
              </button>
            </div>
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
  const formModeTitle = document.getElementById('form-mode-title');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');

  // Ouvinte do botão de Cancelar Edição
  btnCancelEdit.addEventListener('click', () => {
    state.editingId = null;
    state.editingSlug = null;
    formModeTitle.textContent = 'Painel de Publicação (Supabase)';
    btnCancelEdit.style.display = 'none';
    btnSubmit.textContent = 'Publicar Matéria no Portal';
    
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
  });

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

    // Validação anti-duplicidade em tempo real (Jaccard similarity de palavras significativas)
    const STOP_WORDS = new Set(['de', 'o', 'a', 'e', 'em', 'do', 'da', 'no', 'na', 'para', 'com', 'por', 'um', 'uma', 'os', 'as', 'se', 'ao', 'aos', 'sobre']);
    const getKeywords = (t) => {
      if (!t) return new Set();
      const words = t.toLowerCase().match(/\w+/g) || [];
      return new Set(words.filter(w => !STOP_WORDS.has(w) && w.length > 2));
    };
    const calculateJaccard = (t1, t2) => {
      const w1 = getKeywords(t1);
      const w2 = getKeywords(t2);
      if (w1.size === 0 || w2.size === 0) return 0;
      const intersection = new Set([...w1].filter(x => w2.has(x)));
      const union = new Set([...w1, ...w2]);
      return intersection.size / union.size;
    };

    let isSimilar = false;
    let similarTitle = '';
    
    for (const noticia of state.noticias) {
      // Ignora se for a própria notícia sendo editada
      if (state.editingId && noticia.id === state.editingId) continue;
      
      const sim = calculateJaccard(title, noticia.title);
      if (sim > 0.75) { // Limiar de 75% de similaridade
        isSimilar = true;
        similarTitle = noticia.title;
        break;
      }
    }

    if (isSimilar) {
      const confirmPublication = confirm(`Aviso de Duplicidade ⚠️\n\nUma notícia muito semelhante com o título:\n"${similarTitle}"\njá foi publicada no portal.\n\nDeseja forçar a publicação desta nova matéria mesmo assim?`);
      if (!confirmPublication) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = state.editingId ? 'Salvar Alterações' : 'Publicar Matéria no Portal';
        return;
      }
    }

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

      // 2. Inserir ou Atualizar a notícia na tabela `noticias` do Supabase
      let dbError;
      if (state.editingId) {
        const { error: updateError } = await supabaseClient
          .from('noticias')
          .update({
            slug,
            title,
            summary,
            category,
            author,
            image: finalImageUrl,
            content: contentHtml,
            featured,
            credits: credits
          })
          .eq('id', state.editingId);
        dbError = updateError;
      } else {
        const { error: insertError } = await supabaseClient
          .from('noticias')
          .insert([{
            slug,
            title,
            summary,
            category,
            author,
            image: finalImageUrl,
            content: contentHtml,
            featured,
            credits: credits
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

      // Limpa os campos ou reseta o modo de edição
      if (state.editingId) {
        state.editingId = null;
        state.editingSlug = null;
        formModeTitle.textContent = 'Painel de Publicação (Supabase)';
        btnCancelEdit.style.display = 'none';
      }

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
          ❌ Erro ao Salvar: ${error.message || 'Falha de comunicação com o Supabase.'}
        </div>
      `;
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = state.editingId ? 'Salvar Alterações' : 'Publicar Matéria no Portal';
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
    
    // Ouvinte do botão de deletar
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

            // Se a notícia deletada estava em edição, limpa o formulário
            if (state.editingId === id) {
              btnCancelEdit.click();
            }

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

    // Ouvinte do botão de editar
    const editButtons = listContainer.querySelectorAll('.btn-edit-article');
    editButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.getAttribute('data-id');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Carregando...';
        
        try {
          // Busca a notícia completa com o campo content no Supabase
          const { data: noticia, error } = await supabaseClient
            .from('noticias')
            .select('*')
            .eq('id', id)
            .single();
            
          if (error || !noticia) throw error || new Error('Notícia não encontrada');
          
          state.editingId = noticia.id;
          state.editingSlug = noticia.slug;
          
          formModeTitle.textContent = 'Editando Matéria (Supabase)';
          btnCancelEdit.style.display = 'inline-block';
          btnSubmit.textContent = 'Salvar Alterações';
          
          // Preenche os campos do formulário
          inAuthor.value = noticia.author || 'Redação';
          inCategory.value = noticia.category;
          inTitle.value = noticia.title;
          inSummary.value = noticia.summary;
          inImageUrl.value = noticia.image || '';
          inImageFile.value = ''; // Não pode preencher input file por segurança
          inContent.innerHTML = noticia.content || '';
          inFeatured.checked = noticia.featured === true;
          
          if (noticia.credits) {
            inCredits.value = noticia.credits;
            btnCreditsYes.click();
          } else {
            inCredits.value = '';
            btnCreditsNo.click();
          }
          
          updatePreview();
          
          // Scroll suave até o início do formulário
          const formCard = document.querySelector('.admin-form-card');
          if (formCard) {
            window.scrollTo({ top: formCard.offsetTop - 20, behavior: 'smooth' });
          }
        } catch (err) {
          console.error('Erro ao carregar corpo da notícia para edição:', err);
          alert('Erro ao carregar dados da notícia. Tente novamente.');
        } finally {
          btn.disabled = false;
          btn.textContent = originalText;
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
      company: 'Comércio Varejista Cuiabá',
      location: 'Cuiabá - MT',
      type: 'CLT',
      salary: 'R$ 1.800,00',
      benefits: 'VT + VR + Plano de Saúde',
      description: 'Auxílio na rotina administrativa, contas a pagar/receber, emissão de notas fiscais, controle de planilhas e atendimento ao cliente.',
      image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&q=80',
      contactInfo: 'contato@varejistacuiaba.com.br ou (65) 99988-7766'
    },
    {
      id: 2,
      title: 'Desenvolvedor Front-end Júnior',
      company: 'Tech Solutions MT',
      location: 'Cuiabá (Híbrido) - MT',
      type: 'CLT/PJ',
      salary: 'R$ 3.500,00',
      benefits: 'VR + Auxílio Home Office',
      description: 'Desenvolvimento e manutenção de interfaces responsivas utilizando HTML, CSS, JavaScript e React. Integração com APIs.',
      image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=80',
      contactInfo: 'rh@techsolutionsmt.dev'
    },
    {
      id: 3,
      title: 'Vendedor de Loja',
      company: 'Moda & Estilo Várzea Grande',
      location: 'Várzea Grande - MT',
      type: 'CLT',
      salary: 'R$ 1.650,00',
      benefits: 'Comissão + VT + Seguro de Vida',
      description: 'Atendimento consultivo ao cliente, organização do salão de vendas, controle de provadores, fechamento de vendas e metas.',
      image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=80',
      contactInfo: 'contrata@modaestilovg.com.br'
    },
    {
      id: 4,
      title: 'Auxiliar de Logística',
      company: 'Distribuidora Rondonópolis',
      location: 'Rondonópolis - MT',
      type: 'CLT',
      salary: 'R$ 1.900,00',
      benefits: 'Vale Alimentação + VT + Plano de Saúde',
      description: 'Recebimento, conferência, triagem e estocagem de mercadorias. Preparação de pedidos para expedição e organização do galpão.',
      image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&q=80',
      contactInfo: 'vagas@distribuidoraroo.com.br ou (66) 99888-5544'
    },
    {
      id: 5,
      title: 'Estagiário de Marketing Digital',
      company: 'Agência Sinop Digital',
      location: 'Sinop - MT',
      type: 'Estágio',
      salary: 'R$ 1.000,00',
      benefits: 'Bolsa Auxílio + Auxílio Transporte',
      description: 'Criação de conteúdo para redes sociais (posts e stories), redação de copys básicas, monitoramento de métricas e suporte em design.',
      image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80',
      contactInfo: 'talentos@agenciasinop.com.br'
    },
    {
      id: 6,
      title: 'Consultor de Vendas Agro',
      company: 'NutriAgro Sorriso',
      location: 'Sorriso - MT',
      type: 'CLT',
      salary: 'R$ 4.000,00',
      benefits: 'Comissões + Carro da Empresa + VR',
      description: 'Atendimento técnico comercial a produtores rurais, venda de defensivos agrícolas, sementes e fertilizantes, e visitas de campo.',
      image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=400&q=80',
      contactInfo: 'agro.sorriso@nutriagro.com.br'
    }
  ];

  // Carrega as vagas customizadas anunciadas pelo formulário no localStorage
  const customJobs = JSON.parse(localStorage.getItem('custom_jobs_cache') || '[]');
  
  // Combina as vagas, colocando as customizadas no topo
  const allJobs = [...customJobs, ...mockJobs];

  let currentSearch = '';
  let selectedCity = 'Todas';

  function buildJobsHtml() {
    let filtered = allJobs;

    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      filtered = filtered.filter(j => 
        j.title.toLowerCase().includes(q) || 
        j.company.toLowerCase().includes(q) || 
        j.description.toLowerCase().includes(q)
      );
    }

    if (selectedCity && selectedCity !== 'Todas') {
      filtered = filtered.filter(j => j.location.includes(selectedCity));
    }

    if (filtered.length === 0) {
      return `
        <div class="jobs-no-results">
          <h3>Nenhuma vaga encontrada 🔍</h3>
          <p>Tente refinar sua pesquisa ou limpe os filtros para ver todas as oportunidades.</p>
          <button class="jobs-reset-filters-btn" id="btn-reset-jobs-filters">Ver Todas as Vagas</button>
        </div>
      `;
    }

    return filtered.map(job => `
      <div class="job-card" data-id="${job.id}">
        <div class="job-card-body-content">
          ${job.image ? `
            <div class="job-card-image-container">
              <img src="${job.image}" alt="Imagem de ${job.company}" loading="lazy" />
            </div>
          ` : ''}
          <div class="job-card-text-details">
            <div class="job-card-header">
              <div>
                <h3 class="job-card-title">${job.title}</h3>
                <div class="job-card-company">${job.company}</div>
              </div>
              <span class="job-badge job-badge-${job.type.toLowerCase().replace('/', '').replace('cltpj', 'clt-pj')}">${job.type}</span>
            </div>
            <div class="job-card-meta">
              <span class="job-meta-item"><span class="icon">📍</span> ${job.location}</span>
              <span class="job-meta-item"><span class="icon">💰</span> ${job.salary}</span>
            </div>
            <p class="job-card-description">${job.description}</p>
            <div class="job-card-benefits">
              <strong>Benefícios:</strong> ${job.benefits}
            </div>
          </div>
        </div>
        <div class="job-card-footer">
          <button class="btn-job-apply" data-title="${job.title}" data-company="${job.company}" data-contact="${job.contactInfo || ''}">Entre em contato com a empresa</button>
        </div>
      </div>
    `).join('');
  }

  function render() {
    mainContent.innerHTML = `
      <div class="jobs-portal-container">
        
        <!-- Cabeçalho Moderno -->
        <div class="jobs-header">
          <div class="jobs-header-info">
            <h2 class="jobs-header-title">Portal de Vagas de Emprego</h2>
            <p class="jobs-header-subtitle">Encontre sua próxima oportunidade de trabalho em Mato Grosso</p>
          </div>
          
          <!-- Filtro/Busca -->
          <div class="jobs-filter-bar">
            <div class="jobs-search-wrapper">
              <input 
                type="text" 
                id="jobs-search-input" 
                placeholder="Buscar por cargo, palavra-chave ou empresa..." 
                value="${currentSearch}"
              />
            </div>
            <div class="jobs-select-wrapper">
              <span class="select-icon">📍</span>
              <select id="jobs-city-select">
                <option value="Todas" ${selectedCity === 'Todas' ? 'selected' : ''}>Todas as cidades</option>
                <option value="Cuiabá" ${selectedCity === 'Cuiabá' ? 'selected' : ''}>Cuiabá</option>
                <option value="Várzea Grande" ${selectedCity === 'Várzea Grande' ? 'selected' : ''}>Várzea Grande</option>
                <option value="Rondonópolis" ${selectedCity === 'Rondonópolis' ? 'selected' : ''}>Rondonópolis</option>
                <option value="Sinop" ${selectedCity === 'Sinop' ? 'selected' : ''}>Sinop</option>
                <option value="Sorriso" ${selectedCity === 'Sorriso' ? 'selected' : ''}>Sorriso</option>
              </select>
            </div>
          </div>
        </div>

        <!-- WhatsApp Destaque -->
        <div class="jobs-whatsapp-card">
          <div class="whatsapp-card-content">
            <div class="whatsapp-icon-bg">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436.002 9.858-4.419 9.86-9.86.002-2.636-1.019-5.114-2.877-6.973C16.596 1.914 14.12 .89 11.48.889c-5.44 0-9.862 4.418-9.865 9.861-.001 1.693.447 3.34 1.3 4.793l-.999 3.647 3.731-.978zm11.567-7.643c-.307-.154-1.82-.9-2.1-.1-.28.1-.56.408-.686.551-.125.143-.25.215-.558.061-.307-.15-1.3-.479-2.477-1.528-.915-.817-1.533-1.825-1.713-2.132-.18-.307-.019-.473.135-.626.138-.138.307-.36.462-.538.154-.18.206-.307.307-.513.103-.206.051-.385-.026-.538-.077-.154-.686-1.656-.94-2.267-.247-.595-.499-.513-.686-.523-.178-.01-.383-.01-.588-.01-.205 0-.538.077-.82.385-.282.307-1.077 1.051-1.077 2.562 0 1.512 1.097 2.973 1.25 3.178.154.205 2.159 3.299 5.23 4.625.73.315 1.3.504 1.743.645.733.233 1.399.2 1.925.121.587-.087 1.82-.743 2.076-1.46.256-.718.256-1.333.18-1.461-.077-.128-.282-.205-.589-.359z"/>
              </svg>
            </div>
            <div class="jobs-whatsapp-card-info" style="display: flex; flex-direction: column; gap: 0.35rem;">
              <h3 class="whatsapp-card-title">Grupo de Vagas no WhatsApp</h3>
              <p class="whatsapp-card-text">Receba novas oportunidades de emprego em Mato Grosso diretamente no seu celular em tempo real.</p>
            </div>
          </div>
          <a href="https://chat.whatsapp.com/placeholder" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-join">
            Entrar no Grupo →
          </a>
        </div>

        <!-- Listagem de Vagas -->
        <div class="jobs-list-title-container">
          <h3 class="jobs-section-title">Vagas Disponíveis</h3>
          <span class="jobs-count-badge" id="jobs-count">0 vagas</span>
        </div>

        <div class="jobs-grid-list" id="jobs-list-container">
          ${buildJobsHtml()}
        </div>

      </div>
    `;

    updateCount();
    setupEvents();
  }

  function updateCount() {
    let filtered = allJobs;
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      filtered = filtered.filter(j => 
        j.title.toLowerCase().includes(q) || 
        j.company.toLowerCase().includes(q) || 
        j.description.toLowerCase().includes(q)
      );
    }
    if (selectedCity && selectedCity !== 'Todas') {
      filtered = filtered.filter(j => j.location.includes(selectedCity));
    }
    const countEl = document.getElementById('jobs-count');
    if (countEl) {
      countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'vaga' : 'vagas'}`;
    }
  }

  function setupEvents() {
    const searchInput = document.getElementById('jobs-search-input');
    const citySelect = document.getElementById('jobs-city-select');
    const listContainer = document.getElementById('jobs-list-container');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.trim();
        listContainer.innerHTML = buildJobsHtml();
        updateCount();
      });
    }

    if (citySelect) {
      citySelect.addEventListener('change', (e) => {
        selectedCity = e.target.value;
        listContainer.innerHTML = buildJobsHtml();
        updateCount();
      });
    }

    const container = document.querySelector('.jobs-portal-container');
    if (container) {
      container.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-job-apply')) {
          const title = e.target.getAttribute('data-title');
          const company = e.target.getAttribute('data-company');
          const contact = e.target.getAttribute('data-contact');
          
          alert(`Para se candidatar à vaga de "${title}" na empresa "${company}", entre em contato diretamente através do seguinte canal:\n\n👉 ${contact || 'contato@empresa.com'}\n\n(Esta vitrine serve para facilitar o contato direto entre candidatos me recrutadores).`);
        }
        
        if (e.target.id === 'btn-reset-jobs-filters') {
          currentSearch = '';
          selectedCity = 'Todas';
          render();
        }
      });
    }
  }

  render();
}

// Função para renderizar o Formulário de Anúncio de Vagas Multi-Etapas para Empresas
function renderAnnounceJob() {
  updateSEO(
    'Anuncie sua Vaga de Emprego',
    'Cadastre vagas de emprego no portal Sobre o Povo e encontre profissionais em Rondonópolis, Cuiabá e todo Mato Grosso.',
    null,
    '#/anunciar-vaga',
    'website'
  );

  let stepData = {
    recruiterName: '',
    recruiterRole: '',
    recruiterContact: '',
    photoDataUrl: ''
  };

  function renderForm() {
    mainContent.innerHTML = `
      <div class="jobs-portal-container">
        
        <!-- Cabeçalho do Cadastro -->
        <div class="jobs-header">
          <div class="jobs-header-info">
            <h2 class="jobs-header-title">Anuncie sua Vaga de Emprego</h2>
            <p class="jobs-header-subtitle">Cadastre as oportunidades da sua empresa e encontre talentos locais</p>
          </div>
          
          <!-- Barra de Progresso/Etapas -->
          <div class="announce-steps-indicator">
            <div class="step-indicator active" id="step-ind-1">
              <span class="step-number">1</span>
              <span class="step-label">Seus Dados</span>
            </div>
            <div class="step-line"></div>
            <div class="step-indicator" id="step-ind-2">
              <span class="step-number">2</span>
              <span class="step-label">Dados da Vaga</span>
            </div>
          </div>
        </div>

        <div class="announce-form-card">
          <form id="announce-job-form" onsubmit="return false;">
            
            <!-- ETAPA 1 -->
            <div class="form-step-section" id="form-step-1">
              <h3 class="form-section-heading">Passo 1: Informações de Contato</h3>
              <p class="form-section-description">Insira seus dados profissionais para contato e recebimento de currículos.</p>
              
              <div class="form-group">
                <label class="form-label" for="ann-name">Nome Completo</label>
                <input type="text" class="form-control" id="ann-name" placeholder="Ex: João Silva" required />
              </div>
              
              <div class="form-group">
                <label class="form-label" for="ann-role">Seu Cargo na Empresa</label>
                <input type="text" class="form-control" id="ann-role" placeholder="Ex: Proprietário, RH, Gerente" required />
              </div>
              
              <div class="form-group">
                <label class="form-label" for="ann-contact">E-mail ou WhatsApp para contato</label>
                <input type="text" class="form-control" id="ann-contact" placeholder="Ex: rh@empresa.com ou (65) 99999-9999" required />
                <p class="form-input-help" style="font-size: 0.75rem; color: var(--color-text-light); margin-top: 0.35rem;">Este dado será exibido na vaga para que os candidatos entrem em contato direto.</p>
              </div>
              
              <div class="form-actions" style="display: flex; justify-content: flex-end; margin-top: 2rem;">
                <button type="button" class="btn-announce-next" id="btn-to-step-2">Avançar para Detalhes da Vaga →</button>
              </div>
            </div>

            <!-- ETAPA 2 (Oculta Inicialmente) -->
            <div class="form-step-section" id="form-step-2" style="display: none;">
              <h3 class="form-section-heading">Passo 2: Informações da Vaga</h3>
              <p class="form-section-description">Insira os detalhes do cargo técnico e os requisitos da oportunidade.</p>
              
              <div class="form-group row-flex">
                <div>
                  <label class="form-label" for="ann-job-title">Título da Vaga</label>
                  <input type="text" class="form-control" id="ann-job-title" placeholder="Ex: Auxiliar de Vendas" />
                </div>
                <div>
                  <label class="form-label" for="ann-company">Nome da Empresa</label>
                  <input type="text" class="form-control" id="ann-company" placeholder="Ex: Supermercado Boa Vista" />
                </div>
              </div>

              <div class="form-group row-flex">
                <div>
                  <label class="form-label" for="ann-city">Cidade da Vaga</label>
                  <select class="form-control" id="ann-city">
                    <option value="Cuiabá - MT">Cuiabá - MT</option>
                    <option value="Várzea Grande - MT">Várzea Grande - MT</option>
                    <option value="Rondonópolis - MT">Rondonópolis - MT</option>
                    <option value="Sinop - MT">Sinop - MT</option>
                    <option value="Sorriso - MT">Sorriso - MT</option>
                    <option value="Outra - MT">Outra cidade (Mato Grosso)</option>
                  </select>
                </div>
                <div>
                  <label class="form-label" for="ann-type">Regime de Contratação</label>
                  <select class="form-control" id="ann-type">
                    <option value="CLT">CLT</option>
                    <option value="PJ">PJ</option>
                    <option value="CLT/PJ">CLT / PJ</option>
                    <option value="Estágio">Estágio</option>
                    <option value="Temporário">Temporário</option>
                  </select>
                </div>
              </div>

              <div class="form-group row-flex">
                <div>
                  <label class="form-label" for="ann-salary">Salário oferecido (Opcional)</label>
                  <input type="text" class="form-control" id="ann-salary" placeholder="Ex: R$ 2.000,00 ou A combinar" />
                </div>
                <div>
                  <label class="form-label" for="ann-benefits">Benefícios (VT, VR, etc.)</label>
                  <input type="text" class="form-control" id="ann-benefits" placeholder="Ex: VT + Vale Alimentação" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="ann-description">Descrição das atividades e requisitos</label>
                <textarea class="form-control" id="ann-description" placeholder="Descreva as funções da vaga e o perfil desejado..." style="min-height: 120px; font-family: var(--font-ui); font-size: 0.95rem;"></textarea>
              </div>

              <!-- Upload de Foto Dinâmico -->
              <div class="form-group">
                <label class="form-label">Foto Relacionada à Empresa ou Vaga (Opcional)</label>
                <div class="announce-photo-upload-wrapper">
                  <div class="photo-upload-input-box" style="flex: 1;">
                    <input type="file" id="ann-photo-file" accept="image/*" class="form-control" style="padding: 0.5rem; margin-bottom: 0.5rem;" />
                    <input type="text" id="ann-photo-url" class="form-control" placeholder="Ou insira a URL de uma foto na internet..." />
                  </div>
                  <div class="photo-upload-preview" id="ann-photo-preview">
                    <div class="preview-placeholder">Foto da Vaga</div>
                  </div>
                </div>
              </div>

              <div class="form-actions row-flex" style="margin-top: 2rem;">
                <button type="button" class="btn-announce-back" id="btn-back-to-step-1">← Voltar</button>
                <button type="button" class="btn-announce-submit" id="btn-submit-job">Publicar Vaga de Emprego</button>
              </div>
            </div>

          </form>
        </div>

      </div>
    `;

    setupFormEvents();
  }

  function setupFormEvents() {
    const form = document.getElementById('announce-job-form');
    const step1 = document.getElementById('form-step-1');
    const step2 = document.getElementById('form-step-2');
    const ind1 = document.getElementById('step-ind-1');
    const ind2 = document.getElementById('step-ind-2');

    // Elementos inputs Passo 1
    const inName = document.getElementById('ann-name');
    const inRole = document.getElementById('ann-role');
    const inContact = document.getElementById('ann-contact');

    // Elementos inputs Passo 2
    const inJobTitle = document.getElementById('ann-job-title');
    const inCompany = document.getElementById('ann-company');
    const inCity = document.getElementById('ann-city');
    const inType = document.getElementById('ann-type');
    const inSalary = document.getElementById('ann-salary');
    const inBenefits = document.getElementById('ann-benefits');
    const inDescription = document.getElementById('ann-description');
    
    // Imagem Upload
    const inPhotoFile = document.getElementById('ann-photo-file');
    const inPhotoUrl = document.getElementById('ann-photo-url');
    const photoPreview = document.getElementById('ann-photo-preview');

    // Botões
    const btnToStep2 = document.getElementById('btn-to-step-2');
    const btnBackTo1 = document.getElementById('btn-back-to-step-1');
    const btnSubmit = document.getElementById('btn-submit-job');

    // Transição 1 -> 2 com validação nativa de Passo 1
    btnToStep2.addEventListener('click', () => {
      if (!inName.checkValidity()) {
        inName.reportValidity();
        return;
      }
      if (!inRole.checkValidity()) {
        inRole.reportValidity();
        return;
      }
      if (!inContact.checkValidity()) {
        inContact.reportValidity();
        return;
      }

      // Salva dados locais
      stepData.recruiterName = inName.value.trim();
      stepData.recruiterRole = inRole.value.trim();
      stepData.recruiterContact = inContact.value.trim();

      // Troca visual de tela
      step1.style.display = 'none';
      step2.style.display = 'block';
      ind2.classList.add('active');
      window.scrollTo(0, 0);
    });

    // Transição 2 -> 1
    btnBackTo1.addEventListener('click', () => {
      step2.style.display = 'none';
      step1.style.display = 'block';
      ind2.classList.remove('active');
      window.scrollTo(0, 0);
    });

    // Preview do upload de imagem (FileReader Base64)
    if (inPhotoFile) {
      inPhotoFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            stepData.photoDataUrl = event.target.result;
            photoPreview.innerHTML = `<img src="${stepData.photoDataUrl}" alt="Preview" />`;
            inPhotoUrl.value = ''; // Limpa a URL manual se houver upload
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Preview da URL da foto manual
    if (inPhotoUrl) {
      inPhotoUrl.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (url) {
          stepData.photoDataUrl = url;
          photoPreview.innerHTML = `<img src="${url}" alt="Preview" onerror="this.parentNode.innerHTML='<div class=\\'preview-placeholder\\'>Foto Inválida</div>';" />`;
          inPhotoFile.value = ''; // Limpa upload manual se houver URL
        } else {
          stepData.photoDataUrl = '';
          photoPreview.innerHTML = `<div class="preview-placeholder">Foto da Vaga</div>`;
        }
      });
    }

    // Submissão final do Cadastro
    btnSubmit.addEventListener('click', () => {
      if (!inJobTitle.value.trim()) {
        inJobTitle.required = true;
        inJobTitle.reportValidity();
        return;
      }
      if (!inCompany.value.trim()) {
        inCompany.required = true;
        inCompany.reportValidity();
        return;
      }
      if (!inBenefits.value.trim()) {
        inBenefits.required = true;
        inBenefits.reportValidity();
        return;
      }
      if (!inDescription.value.trim()) {
        inDescription.required = true;
        inDescription.reportValidity();
        return;
      }

      // Cria a vaga com os dados
      const newJob = {
        id: 'custom-' + Date.now(),
        title: inJobTitle.value.trim(),
        company: inCompany.value.trim(),
        location: inCity.value,
        type: inType.value,
        salary: inSalary.value.trim() || 'A combinar',
        benefits: inBenefits.value.trim(),
        description: inDescription.value.trim(),
        image: stepData.photoDataUrl || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&q=80',
        contactInfo: `${stepData.recruiterContact} (A/C ${stepData.recruiterName} - ${stepData.recruiterRole})`
      };

      // Salva no localStorage
      const customJobs = JSON.parse(localStorage.getItem('custom_jobs_cache') || '[]');
      customJobs.unshift(newJob);
      localStorage.setItem('custom_jobs_cache', JSON.stringify(customJobs));

      // Renderiza tela de sucesso
      renderSuccess(newJob.title);
    });
  }

  function renderSuccess(jobTitle) {
    mainContent.innerHTML = `
      <div class="jobs-portal-container" style="text-align: center; padding: 4rem 1rem;">
        <div class="announce-success-card">
          <div class="success-icon-check">✓</div>
          <h2 class="success-heading">Vaga Publicada com Sucesso!</h2>
          <p class="success-message">A oportunidade para <strong>${jobTitle}</strong> já está ativa e visível para todos os candidatos na vitrine do portal Sobre o Povo.</p>
          <div style="margin-top: 2.5rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
            <a href="#/vagas" class="btn-success-action">Ver Vagas no Portal</a>
            <a href="#/anunciar-vaga" class="btn-success-action secondary" id="btn-announce-another">Anunciar Outra Vaga</a>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-announce-another').addEventListener('click', (e) => {
      e.preventDefault();
      renderForm();
    });
  }

  renderForm();
}

// Inicializa o app
init();
