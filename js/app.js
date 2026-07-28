import { formatFriendlyDate, getCategoryColor } from './utils.js';

// Configurações do Supabase obtidas do usuário
const supabaseUrl = 'https://wnvpkbddmhnznybvmqam.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudnBrYmRkbWhuem55YnZtcWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjEzODgsImV4cCI6MjA5Nzg5NzM4OH0.q1OllfKvmIhjoCNTCGPKQB_5opZIVgJc0L5_8BZj7Ew';

// Inicializa o cliente do Supabase carregado globalmente no index.html
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Engine de Anúncios Dinâmicos (Suporta 'video', 'image' ou 'placeholder')
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
  const absoluteUrl = `https://sobreopovo.com.br/${relativeUrl}`;
  const finalImage = imageUrl || 'https://sobreopovo.com.br/assets/logosemfundo.png';

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
  } else if (hash === '#/vagas') {
    updateActiveNavLink('vagas');
    renderJobs();
  } else if (hash === '#/anunciar-vaga') {
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
          <img class="card-bg-image" src="${featured.image}" alt="${featured.title}" fetchpriority="high" />
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
              <img class="card-bg-image" src="${card2.image}" alt="${card2.title}" loading="lazy" />
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
              <img class="card-bg-image" src="${card3.image}" alt="${card3.title}" loading="lazy" />
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
  try {
    // 1. Exibir esqueleto/loading enquanto busca o artigo completo no Supabase
    mainContent.innerHTML = `
      <div class="article-detail-container" style="max-width: 800px; margin: 2rem auto; padding: 0 1rem;">
        <div style="text-align: center; padding: 4rem 0; color: var(--color-text-muted);">
          <p style="font-size: 1.2rem;">Carregando matéria...</p>
        </div>
      </div>
    `;

    // 2. Busca o artigo completo no Supabase filtrando pelo slug
    const { data: articles, error } = await supabaseClient
      .from('noticias')
      .select('*')
      .eq('slug', slug)
      .limit(1);

    if (error || !articles || articles.length === 0) {
      mainContent.innerHTML = renderErrorState('Matéria Não Encontrada', 'A notícia que você está tentando acessar não existe ou foi removida.');
      return;
    }

    const article = articles[0];

    // 3. Atualiza as tags de SEO e redes sociais (Open Graph / Twitter Cards)
    updateSEO(
      article.title,
      article.summary || article.title,
      article.image,
      `#/noticia/${article.slug}`,
      'article',
      article
    );

    // 4. Converte o conteúdo HTML ou Markdown
    let bodyHtml = article.content || '';
    if (typeof marked !== 'undefined' && !bodyHtml.trim().startsWith('<')) {
      bodyHtml = marked.parse(bodyHtml);
    }

    // 5. Monta a lista de matérias recentes na barra lateral do artigo
    const recentNoticias = state.noticias.filter(n => n.slug !== slug).slice(0, 5);

    const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${article.title} - Leia mais no portal Sobre o Povo: https://sobreopovo.com.br/#/noticia/${article.slug}`)}`;
    const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://sobreopovo.com.br/#/noticia/${article.slug}`)}`;
    const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(`https://sobreopovo.com.br/#/noticia/${article.slug}`)}`;

    mainContent.innerHTML = `
      <div class="article-layout">
        <main class="article-main-content">
          <a href="#/" class="back-link">&larr; Voltar para a Página Inicial</a>
          
          <header class="article-header">
            <span class="category-badge" style="background-color: ${getCategoryColor(article.category)}">
              ${article.category}
            </span>
            <h1 class="article-headline">${article.title}</h1>
            ${article.summary ? `<p class="article-subtitle">${article.summary}</p>` : ''}
            
            <div class="article-meta-bar">
              <div class="author-info">
                <span>Por <strong>${article.author || 'Redação'}</strong></span>
                <span class="meta-dot">&bull;</span>
                <time>${formatFriendlyDate(article.date)}</time>
              </div>
              
              <!-- Botões de Compartilhamento em Redes Sociais -->
              <div class="share-buttons">
                <a href="${whatsappShareUrl}" target="_blank" rel="noopener noreferrer" class="share-btn share-whatsapp" title="Compartilhar no WhatsApp">
                  💬 WhatsApp
                </a>
                <a href="${facebookShareUrl}" target="_blank" rel="noopener noreferrer" class="share-btn share-facebook" title="Compartilhar no Facebook">
                  f Facebook
                </a>
                <a href="${twitterShareUrl}" target="_blank" rel="noopener noreferrer" class="share-btn share-twitter" title="Compartilhar no X/Twitter">
                  𝕏 Twitter
                </a>
              </div>
            </div>
          </header>

          ${article.image ? `
            <figure class="article-hero-image">
              <img src="${article.image}" alt="${article.title}" />
            </figure>
          ` : ''}

          <!-- Espaço de Anúncio Intermediário antes do texto -->
          ${renderAdSpace('intermediario')}

          <!-- Corpo da Matéria em HTML Rico -->
          <div class="article-body">
            ${bodyHtml}
          </div>

          <!-- Créditos / Ficha Técnica da Matéria -->
          <div class="article-credits-box" style="margin-top: 2rem; padding: 1rem 1.2rem; background: var(--color-bg-secondary); border-left: 4px solid var(--color-accent-orange); border-radius: 6px; font-size: 0.9rem; color: var(--color-text-muted);">
            <p style="margin: 0; font-weight: 600; color: var(--color-text-main);">📋 Ficha Técnica e Créditos:</p>
            <p style="margin: 0.3rem 0 0 0; line-height: 1.5;">${article.credits || 'Informações e dados apurados com fontes públicas e oficiais de Mato Grosso.'}</p>
          </div>

          <!-- Rodapé do Artigo: Compartilhamento Final -->
          <footer class="article-footer" style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--color-border);">
            <div class="article-meta-bar">
              <span style="font-weight: 600; color: var(--color-text-muted);">Gostou desta matéria? Compartilhe:</span>
              <div class="share-buttons">
                <a href="${whatsappShareUrl}" target="_blank" rel="noopener noreferrer" class="share-btn share-whatsapp">WhatsApp</a>
                <a href="${facebookShareUrl}" target="_blank" rel="noopener noreferrer" class="share-btn share-facebook">Facebook</a>
                <a href="${twitterShareUrl}" target="_blank" rel="noopener noreferrer" class="share-btn share-twitter">𝕏 Twitter</a>
              </div>
            </div>
          </footer>
        </main>

        <!-- Sidebar de Notícias Relacionadas / Recentes -->
        <aside class="article-sidebar">
          <div class="sidebar-section">
            <h3 class="section-title">Mais Recentes</h3>
            <div class="latest-list">
              ${recentNoticias.map(renderLatestSidebarItem).join('')}
            </div>
          </div>

          <!-- Espaço de Anúncios Quadrado na Sidebar da Leitura -->
          <div style="margin-top: 2rem;">
            ${renderAdSpace('quadradoLateral')}
          </div>
        </aside>
      </div>
    `;
  } catch (error) {
    console.error('Erro ao renderizar artigo:', error);
    mainContent.innerHTML = renderErrorState('Erro ao Carregar Matéria', 'Ocorreu uma falha ao tentar exibir esta notícia. Tente novamente mais tarde.');
  }
}

// Exibe a Tela do Painel Gerenciador (/manager)
function renderManager() {
  updateSEO(
    'Painel Gerenciador de Notícias',
    'Área administrativa para cadastro, edição e gerenciamento de notícias do portal Sobre o Povo.',
    null,
    '#/manager',
    'website'
  );

  mainContent.innerHTML = `
    <div class="manager-container">
      <header class="manager-header">
        <h2>Painel Gerenciador de Notícias</h2>
        <p>Cadastre novas notícias ou edite matérias existentes na plataforma.</p>
      </header>

      <!-- Formulário de Cadastro e Edição de Notícias -->
      <form class="manager-form" id="news-form">
        <input type="hidden" id="form-news-id" value="" />
        
        <div class="form-group">
          <label for="form-title">Título da Notícia *</label>
          <input type="text" id="form-title" class="form-control" placeholder="Ex: Obras do BRT em Cuiabá avançam para nova fase" required />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="form-category">Categoria *</label>
            <select id="form-category" class="form-control" required>
              <option value="Brasil">Brasil</option>
              <option value="Política">Política</option>
              <option value="Cidades">Cidades</option>
              <option value="Economia">Economia</option>
              <option value="Cultura">Cultura</option>
              <option value="Celebridades">Celebridades</option>
              <option value="Opinião">Opinião</option>
            </select>
          </div>

          <div class="form-group">
            <label for="form-author">Autor / Redação *</label>
            <input type="text" id="form-author" class="form-control" value="Redação" required />
          </div>
        </div>

        <div class="form-group">
          <label for="form-summary">Resumo / Subtítulo (Linha Fina) *</label>
          <textarea id="form-summary" class="form-control" rows="2" placeholder="Resumo curto que aparece nos cards e redes sociais" required></textarea>
        </div>

        <div class="form-group">
          <label for="form-image">URL da Imagem de Destaque</label>
          <input type="url" id="form-image" class="form-control" placeholder="https://exemplo.com/imagem.jpg" />
        </div>

        <div class="form-group">
          <label for="form-credits">Ficha Técnica e Créditos</label>
          <input type="text" id="form-credits" class="form-control" placeholder="Ex: Foto: Secom-MT / Texto: Assessoria de Imprensa" />
        </div>

        <div class="form-group">
          <label for="form-content">Corpo da Matéria (HTML ou Texto com Formatação) *</label>
          <textarea id="form-content" class="form-control" rows="10" placeholder="Escreva ou cole o texto da matéria aqui..." required></textarea>
        </div>

        <div class="form-group form-checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" id="form-featured" />
            Marcar como Destaque Principal na Home
          </label>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" id="btn-save-news">Salvar Notícia</button>
          <button type="button" class="btn btn-secondary" id="btn-cancel-edit" style="display: none;">Cancelar Edição</button>
        </div>
      </form>

      <!-- Lista de Notícias Cadastradas para Gerenciamento -->
      <section class="manager-list-section">
        <h3>Matérias Cadastradas (${state.noticias.length})</h3>
        <div class="manager-table-wrapper">
          <table class="manager-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Categoria</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${state.noticias.map(n => `
                <tr>
                  <td><strong>${n.title}</strong></td>
                  <td><span class="category-badge" style="background-color: ${getCategoryColor(n.category)}">${n.category}</span></td>
                  <td>${formatFriendlyDate(n.date)}</td>
                  <td class="action-cells">
                    <button class="btn-action btn-edit-article" data-id="${n.id}">✏️ Editar</button>
                    <button class="btn-action btn-delete-article" data-id="${n.id}">🗑️ Excluir</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  // Configura ouvintes do formulário administrativo
  const newsForm = document.getElementById('news-form');
  const btnCancel = document.getElementById('btn-cancel-edit');

  newsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveArticleFromForm();
  });

  btnCancel.addEventListener('click', clearManagerForm);

  // Event listeners para botões de editar e excluir
  document.querySelectorAll('.btn-edit-article').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const targetBtn = e.currentTarget;

      const originalText = targetBtn.innerHTML;
      targetBtn.innerHTML = '⏳ Carregando...';
      targetBtn.disabled = true;

      try {
        const { data, error } = await supabaseClient
          .from('noticias')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !data) throw error || new Error('Matéria não encontrada');

        document.getElementById('form-news-id').value = data.id;
        document.getElementById('form-title').value = data.title;
        document.getElementById('form-category').value = data.category;
        document.getElementById('form-author').value = data.author || 'Redação';
        document.getElementById('form-summary').value = data.summary;
        document.getElementById('form-image').value = data.image || '';
        document.getElementById('form-credits').value = data.credits || '';
        document.getElementById('form-content').value = data.content || '';
        document.getElementById('form-featured').checked = data.featured === true;

        state.editingId = data.id;
        document.getElementById('btn-save-news').textContent = 'Atualizar Notícia';
        btnCancel.style.display = 'inline-block';
        window.scrollTo(0, 0);
      } catch (err) {
        console.error('Erro ao buscar dados completos da matéria:', err);
        alert('Não foi possível carregar os dados completos da matéria para edição.');
      } finally {
        targetBtn.innerHTML = originalText;
        targetBtn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.btn-delete-article').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (confirm('Tem certeza que deseja excluir esta matéria do portal? Esta ação não pode ser desfeita.')) {
        await deleteArticle(id);
      }
    });
  });
}

// Salva ou Atualiza uma matéria via formulário do Gerenciador
async function saveArticleFromForm() {
  const id = document.getElementById('form-news-id').value;
  const title = document.getElementById('form-title').value.trim();
  const category = document.getElementById('form-category').value;
  const author = document.getElementById('form-author').value.trim();
  const summary = document.getElementById('form-summary').value.trim();
  const image = document.getElementById('form-image').value.trim();
  const credits = document.getElementById('form-credits').value.trim();
  const content = document.getElementById('form-content').value.trim();
  const featured = document.getElementById('form-featured').checked;

  if (!title || !summary || !content) {
    alert('Por favor, preencha todos os campos obrigatórios (*).');
    return;
  }

  // Gera slug simples
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  const payload = {
    title,
    slug,
    category,
    author,
    summary,
    image: image || null,
    credits: credits || null,
    content,
    featured,
    date: new Date().toISOString()
  };

  try {
    if (id) {
      // Atualização
      const { error } = await supabaseClient
        .from('noticias')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
      alert('Notícia atualizada com sucesso!');
    } else {
      // Inserção de nova notícia
      const { error } = await supabaseClient
        .from('noticias')
        .insert([payload]);
      if (error) throw error;
      alert('Nova notícia publicada com sucesso!');
    }

    clearManagerForm();
    await loadNoticiasIndex();
    renderManager();
  } catch (err) {
    console.error('Erro ao salvar no Supabase:', err);
    alert(`Erro ao salvar a notícia: ${err.message}`);
  }
}

// Apaga uma notícia do Supabase
async function deleteArticle(id) {
  try {
    const { error } = await supabaseClient
      .from('noticias')
      .delete()
      .eq('id', id);

    if (error) throw error;
    alert('Matéria excluída com sucesso.');
    await loadNoticiasIndex();
    renderManager();
  } catch (err) {
    console.error('Erro ao excluir notícia:', err);
    alert(`Erro ao excluir notícia: ${err.message}`);
  }
}

// Limpa os campos do formulário administrativo
function clearManagerForm() {
  document.getElementById('form-news-id').value = '';
  document.getElementById('news-form').reset();
  state.editingId = null;
  document.getElementById('btn-save-news').textContent = 'Salvar Notícia';
  document.getElementById('btn-cancel-edit').style.display = 'none';
}

// Renderiza a Página de Vagas de Emprego
function renderJobs() {
  updateSEO(
    'Vagas de Emprego em Mato Grosso',
    'Confira as oportunidades de emprego abertas em Rondonópolis, Cuiabá e interior de MT. Vagas atualizadas diariamente.',
    null,
    '#/vagas',
    'website'
  );

  mainContent.innerHTML = `
    <div class="jobs-page-container">
      <header class="jobs-page-header">
        <span class="category-badge" style="background-color: var(--color-category-blue);">OPORTUNIDADES</span>
        <h2>Portal de Vagas de Emprego MT</h2>
        <p>Vagas de trabalho atualizadas diariamente para Cuiabá, Rondonópolis e todo o estado de Mato Grosso.</p>
      </header>

      <div class="jobs-cta-box" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--color-bg-secondary); border-radius: 8px; text-align: center;">
        <h3>Sua empresa está contratando?</h3>
        <p style="color: var(--color-text-muted); margin: 0.5rem 0 1rem 0;">Divulgue gratuitamente ou com destaque a sua oportunidade no portal Sobre o Povo.</p>
        <a href="#/anunciar-vaga" class="btn-ad-cta" style="display: inline-block;">
          <span class="icon">📢</span> Cadastrar Nova Vaga de Emprego
        </a>
      </div>

      <div class="jobs-list">
        <article class="job-card" style="background: var(--color-bg-primary); border: 1px solid var(--color-border); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span style="font-size: 0.8rem; font-weight: 600; color: var(--color-category-blue); text-transform: uppercase;">Rondonópolis / MT</span>
              <h3 style="margin: 0.3rem 0; font-size: 1.2rem;">Auxiliar de Logística e Estoque</h3>
              <p style="color: var(--color-text-muted); font-size: 0.9rem; margin: 0;">Empresa do Setor Agroindustrial &bull; Ensino Médio Completo &bull; Vínculo CLT</p>
            </div>
            <a href="https://wa.me/5565993044444?text=Olá!%20Tenho%20interesse%20na%20vaga%20de%20Auxiliar%20de%20Logística%20em%20Rondonópolis" target="_blank" rel="noopener noreferrer" class="jobs-highlight-btn">Candidatar-se →</a>
          </div>
        </article>

        <article class="job-card" style="background: var(--color-bg-primary); border: 1px solid var(--color-border); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span style="font-size: 0.8rem; font-weight: 600; color: var(--color-category-blue); text-transform: uppercase;">Cuiabá / MT</span>
              <h3 style="margin: 0.3rem 0; font-size: 1.2rem;">Atendente de Caixa e Recepção</h3>
              <p style="color: var(--color-text-muted); font-size: 0.9rem; margin: 0;">Rede de Supermercados &bull; Escala 6x1 &bull; Benefícios de VT e VR</p>
            </div>
            <a href="https://wa.me/5565993044444?text=Olá!%20Tenho%20interesse%20na%20vaga%20de%20Atendente%20de%20Caixa%20em%20Cuiabá" target="_blank" rel="noopener noreferrer" class="jobs-highlight-btn">Candidatar-se →</a>
          </div>
        </article>

        <article class="job-card" style="background: var(--color-bg-primary); border: 1px solid var(--color-border); padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span style="font-size: 0.8rem; font-weight: 600; color: var(--color-category-blue); text-transform: uppercase;">Várzea Grande / MT</span>
              <h3 style="margin: 0.3rem 0; font-size: 1.2rem;">Motorista Entregador (Categoria D)</h3>
              <p style="color: var(--color-text-muted); font-size: 0.9rem; margin: 0;">Distribuidora Regional &bull; CNH D Ativa &bull; Disponibilidade para viagens regionais</p>
            </div>
            <a href="https://wa.me/5565993044444?text=Olá!%20Tenho%20interesse%20na%20vaga%20de%20Motorista%20em%20Várzea%20Grande" target="_blank" rel="noopener noreferrer" class="jobs-highlight-btn">Candidatar-se →</a>
          </div>
        </article>
      </div>
    </div>
  `;
}

// Renderiza a Página de Cadastro de Vagas para Empresas
function renderAnnounceJob() {
  updateSEO(
    'Anunciar Vaga de Emprego',
    'Cadastre a oportunidade da sua empresa no portal Sobre o Povo e receba currículos de candidatos de Mato Grosso.',
    null,
    '#/anunciar-vaga',
    'website'
  );

  mainContent.innerHTML = `
    <div class="announce-job-container" style="max-width: 700px; margin: 2rem auto; padding: 0 1rem;">
      <header style="text-align: center; margin-bottom: 2rem;">
        <span class="category-badge" style="background-color: var(--color-category-blue);">PARA EMPRESAS</span>
        <h2 style="font-size: 1.8rem; margin: 0.5rem 0;">Anuncie sua Vaga no Portal</h2>
        <p style="color: var(--color-text-muted);">Preencha os dados da oportunidade abaixo para publicar no Portal de Vagas de Mato Grosso.</p>
      </header>

      <form id="announce-job-form" class="manager-form">
        <div class="form-group">
          <label for="job-title">Título do Cargo / Vaga *</label>
          <input type="text" id="job-title" class="form-control" placeholder="Ex: Vendedor Externo, Técnico de Enfermagem..." required />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="job-city">Cidade / Estado *</label>
            <input type="text" id="job-city" class="form-control" placeholder="Ex: Rondonópolis / MT" required />
          </div>

          <div class="form-group">
            <label for="job-company">Nome da Empresa *</label>
            <input type="text" id="job-company" class="form-control" placeholder="Ex: Grupo Agro MT" required />
          </div>
        </div>

        <div class="form-group">
          <label for="job-desc">Descrição das Atividades e Requisitos *</label>
          <textarea id="job-desc" class="form-control" rows="5" placeholder="Descreva os requisitos, benefícios e horários da vaga..." required></textarea>
        </div>

        <div class="form-group">
          <label for="job-contact">E-mail ou WhatsApp para Recebimento de Currículos *</label>
          <input type="text" id="job-contact" class="form-control" placeholder="Ex: vagas@suaempresa.com.br ou (65) 99999-0000" required />
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" style="width: 100%;">Enviar Vaga para Aprovação</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('announce-job-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('job-title').value;
    const city = document.getElementById('job-city').value;
    const company = document.getElementById('job-company').value;
    const contact = document.getElementById('job-contact').value;

    const message = encodeURIComponent(`Olá! Gostaria de publicar a seguinte vaga no portal:\n\n*Cargo:* ${title}\n*Cidade:* ${city}\n*Empresa:* ${company}\n*Contato para CV:* ${contact}`);
    window.open(`https://wa.me/5565993044444?text=${message}`, '_blank');
  });
}

// Auxiliar para renderizar mensagens de erro elegantes
function renderErrorState(title, message) {
  return `
    <div class="error-state-box" style="text-align: center; padding: 4rem 1rem; color: var(--color-text-muted);">
      <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
      <h3 style="color: var(--color-text-main); font-size: 1.5rem; margin-bottom: 0.5rem;">${title}</h3>
      <p style="max-width: 500px; margin: 0 auto 1.5rem auto; line-height: 1.6;">${message}</p>
      <a href="#/" class="btn btn-primary" onclick="window.location.reload()">Recarregar Portal</a>
    </div>
  `;
}

// Inicializa a aplicação ao carregar o DOM
document.addEventListener('DOMContentLoaded', init);
