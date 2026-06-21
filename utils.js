/**
 * Helpers e Utilitários para o Portal "Sobre o Povo"
 */

/**
 * Realiza o parse do frontmatter YAML em arquivos Markdown carregados no navegador.
 * Separa os metadados do corpo do texto.
 * @param {string} text - O conteúdo bruto do arquivo .md
 * @returns {{data: Object, body: string}} Metadados e corpo do texto
 */
export function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!match) {
    return { data: {}, body: text };
  }

  const yamlBlock = match[1];
  const body = text.slice(match[0].length).trim();
  const data = {};

  yamlBlock.split(/\r?\n/).forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Remove aspas simples/duplas
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Converte booleanos simples
      if (value === 'true') {
        data[key] = true;
      } else if (value === 'false') {
        data[key] = false;
      } else {
        data[key] = value;
      }
    }
  });

  return { data, body };
}

/**
 * Formata datas de maneira amigável em português.
 * Se for recente (menos de 24h), mostra tempo relativo. Caso contrário, mostra data completa.
 * @param {string|Date} dateInput - A data de publicação
 * @returns {string} Data formatada
 */
export function formatFriendlyDate(dateInput) {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);

  // Se a data for no futuro ou muito recente (menos de 1 minuto)
  if (diffMinutes < 1) {
    return 'Agora mesmo';
  }

  // Menos de 1 hora
  if (diffMinutes < 60) {
    return `Há ${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`;
  }

  // Menos de 24 horas
  if (diffHours < 24) {
    return `Há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  }

  // Caso contrário, mostra data formatada por extenso
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  const formattedDate = date.toLocaleDateString('pt-BR', options);
  const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  return `${formattedDate} às ${formattedTime}`;
}

/**
 * Retorna uma cor correspondente à categoria para fins de badge temático.
 * Baseia-se nas cores do logotipo e no design editorial.
 * @param {string} category - Nome da categoria
 * @returns {string} Código de cor HSL correspondente
 */
export function getCategoryColor(category) {
  const normalized = category.toLowerCase().trim();
  switch (normalized) {
    case 'economia':
      return 'var(--color-category-blue)'; // Azul Royal da bandeira
    case 'brasil & política':
    case 'política':
    case 'brasil':
      return 'var(--color-category-green)'; // Verde da bandeira
    case 'opinião':
      return 'var(--color-accent-orange)'; // Laranja do balão de fala
    case 'cultura':
      return 'hsl(283, 39%, 53%)'; // Roxo elegante para cultura
    default:
      return 'var(--color-text-light)';
  }
}
