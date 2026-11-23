// Identidade de cada jogo. A cor de cada um continua a mesma das versões anteriores.
export const GAMES = {
  iscas: {
    id: 'iscas', title: 'Jogo das Iscas', short: 'Iscas', item: 'isca', items: 'iscas', question: 'Qual é esta isca?',
    url: 'https://jogodasiscas.chumbada.com.br', accent: '#ff7a1a', accent2: '#ffc24b', glow: '255, 122, 26',
    tagline: 'Adivinhe o nome das iscas soft da Chumbada Oficial antes que o tempo acabe.',
  },
  chumbadas: {
    id: 'chumbadas', title: 'Jogo das Chumbadas', short: 'Chumbadas', item: 'chumbada', items: 'chumbadas', question: 'Qual é esta chumbada?',
    url: 'https://jogodaschumbadas.chumbada.com.br', accent: '#22d3ee', accent2: '#60a5fa', glow: '34, 211, 238',
    tagline: 'Reconheça cada modelo de chumbada oficial no menor tempo possível.',
  },
  anzois: {
    id: 'anzois', title: 'Jogo dos Anzóis', short: 'Anzóis', item: 'anzol', items: 'anzóis', question: 'Qual é este anzol?',
    url: 'https://jogodosanzois.chumbada.com.br', accent: '#f5c451', accent2: '#ff9f43', glow: '245, 196, 81',
    tagline: 'Prove que você conhece a linha de anzóis premium da Chumbada Oficial.',
  },
};
export const GAME_ORDER = ['iscas', 'chumbadas', 'anzois'];
export const HUB_URL = 'https://jogos.chumbada.com.br';
