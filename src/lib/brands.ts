// Catálogo de marcas (bancos peruanos y servicios de suscripción) y búsqueda de su logo
// a partir del texto guardado (institución de la cuenta/deuda o nombre del servicio).

export interface Institution {
  id: string;
  name: string;
  image?: string;
  color: string;
  bg: string;
  /** Digital wallet with its own balance (PayPal…) rather than a bank. */
  wallet?: boolean;
  /** Usual currency of its accounts (PayPal: USD); otherwise the user's. */
  currency?: string;
}

export const PERUVIAN_BANKS: Institution[] = [
  {
    id: 'bcp',
    name: 'BCP',
    image: '/assets/images/bcp-1790986661188.jpg',
    color: '#003087',
    bg: '#E8F0FF',
  },
  {
    id: 'interbank',
    name: 'Interbank',
    image: '/assets/images/interbank-1790986660881.png',
    color: '#00A651',
    bg: '#E6F7EE',
  },
  {
    id: 'bbva',
    name: 'BBVA',
    image: '/assets/images/bbva-1790986661190.png',
    color: '#004481',
    bg: '#E6EEF7',
  },
  {
    id: 'scotiabank',
    name: 'Scotiabank',
    image: '/assets/images/scotiabank-1790986661195.png',
    color: '#CC0000',
    bg: '#FFE6E6',
  },
  {
    id: 'banbif',
    name: 'BanBif',
    image: '/assets/images/banbif-1790986684660.jpg',
    color: '#E30613',
    bg: '#FFE6E7',
  },
  {
    id: 'nacion',
    name: 'Banco de la Nación',
    image: '/assets/images/banco_de_la_nacion-1790987077025.jpg',
    color: '#C8102E',
    bg: '#FFE6EA',
  },
  {
    id: 'ripley',
    name: 'Banco Ripley',
    image: '/assets/images/bancoripley-1790987077028.jpg',
    color: '#6B21A8',
    bg: '#F3E8FF',
  },
  {
    id: 'falabella',
    name: 'Banco Falabella',
    image: '/assets/images/falabella-1790987077026.png',
    color: '#1D4ED8',
    bg: '#DBEAFE',
  },
];

// Every institution offered when creating an account (onboarding and Cuentas use the same list).
// Yape and Plin are not here: they pay from a bank account (Yape → BCP, Plin → Interbank, BBVA…),
// so an account for them would count the same money twice. They remain payment methods.
export const PERU_INSTITUTIONS: Institution[] = [
  ...PERUVIAN_BANKS,
  { id: 'pichincha', name: 'Banco Pichincha', color: '#B38F00', bg: '#FFF7CC' },
  {
    id: 'paypal',
    name: 'PayPal',
    color: '#003087',
    bg: '#E8F0FE',
    wallet: true,
    currency: 'USD',
  },
];

export interface ServiceOption {
  name: string;
  category: string;
  icon: string;
  logoUrl?: string;
  color: string;
}

export const POPULAR_SERVICES: ServiceOption[] = [
  // Entretenimiento
  {
    name: 'Netflix',
    category: 'Entretenimiento',
    icon: 'film',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg',
    color: '#E50914',
  },
  {
    name: 'Disney+',
    category: 'Entretenimiento',
    icon: 'castle',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg',
    color: '#113CCF',
  },
  {
    name: 'HBO Max',
    category: 'Entretenimiento',
    icon: 'drama',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/17/HBO_Max_Logo.svg',
    color: '#5822B4',
  },
  {
    name: 'Amazon Prime',
    category: 'Entretenimiento',
    icon: 'package',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Prime_Video.svg',
    color: '#00A8E1',
  },
  {
    name: 'Apple TV+',
    category: 'Entretenimiento',
    icon: 'apple',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg',
    color: '#000000',
  },
  { name: 'Paramount+', category: 'Entretenimiento', icon: 'star', color: '#0064FF' },
  { name: 'Crunchyroll', category: 'Entretenimiento', icon: 'food', color: '#F47521' },
  // Música
  {
    name: 'Spotify',
    category: 'Música',
    icon: 'music',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/26/Spotify_logo_with_text.svg',
    color: '#1DB954',
  },
  { name: 'Apple Music', category: 'Música', icon: 'music', color: '#FC3C44' },
  { name: 'YouTube Music', category: 'Música', icon: 'guitar', color: '#FF0000' },
  { name: 'Deezer', category: 'Música', icon: 'headphones', color: '#A238FF' },
  { name: 'Tidal', category: 'Música', icon: 'waves', color: '#000000' },
  // IA
  {
    name: 'ChatGPT Plus',
    category: 'Software',
    icon: 'bot',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg',
    color: '#10A37F',
  },
  { name: 'Claude Pro', category: 'Software', icon: 'brain', color: '#D97706' },
  { name: 'Gemini Advanced', category: 'Software', icon: 'sparkles', color: '#4285F4' },
  { name: 'Midjourney', category: 'Software', icon: 'palette', color: '#000000' },
  { name: 'Copilot Pro', category: 'Software', icon: 'bulb', color: '#0078D4' },
  { name: 'Perplexity AI', category: 'Software', icon: 'search', color: '#20B2AA' },
  // Software / Productividad
  { name: 'Adobe Creative', category: 'Software', icon: 'brush', color: '#FF0000' },
  { name: 'Microsoft 365', category: 'Software', icon: 'chart', color: '#0078D4' },
  { name: 'Notion', category: 'Software', icon: 'note', color: '#000000' },
  { name: 'Figma', category: 'Software', icon: 'target', color: '#F24E1E' },
  { name: 'Canva Pro', category: 'Software', icon: 'image', color: '#00C4CC' },
  { name: 'Slack', category: 'Software', icon: 'chat', color: '#4A154B' },
  { name: 'Zoom', category: 'Software', icon: 'video', color: '#2D8CFF' },
  { name: 'Dropbox', category: 'Almacenamiento', icon: 'folder', color: '#0061FF' },
  { name: 'Google One', category: 'Almacenamiento', icon: 'cloud', color: '#4285F4' },
  { name: 'iCloud+', category: 'Almacenamiento', icon: 'apple', color: '#3478F6' },
  { name: 'OneDrive', category: 'Almacenamiento', icon: 'globe', color: '#0078D4' },
  // Juegos
  { name: 'Xbox Game Pass', category: 'Entretenimiento', icon: 'gamepad', color: '#107C10' },
  { name: 'PlayStation Plus', category: 'Entretenimiento', icon: 'joystick', color: '#003087' },
  { name: 'Nintendo Online', category: 'Entretenimiento', icon: 'gamepad', color: '#E60012' },
  { name: 'Steam', category: 'Entretenimiento', icon: 'gamepad', color: '#1B2838' },
  // Salud / Fitness
  { name: 'Calm', category: 'Salud', icon: 'person', color: '#3E7BFA' },
  { name: 'Headspace', category: 'Salud', icon: 'brain', color: '#F47D31' },
  { name: 'Duolingo Plus', category: 'Educación', icon: 'bird', color: '#58CC02' },
  { name: 'Coursera Plus', category: 'Educación', icon: 'book', color: '#0056D2' },
  { name: 'LinkedIn Premium', category: 'Servicios', icon: 'briefcase', color: '#0A66C2' },
  { name: 'YouTube Premium', category: 'Entretenimiento', icon: 'play', color: '#FF0000' },
  { name: 'Twitch Turbo', category: 'Entretenimiento', icon: 'star', color: '#9146FF' },
];

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const BANK_ALIASES: Record<string, string[]> = {
  bcp: ['bcp', 'banco de credito', 'credito del peru'],
  interbank: ['interbank'],
  bbva: ['bbva', 'continental'],
  scotiabank: ['scotiabank', 'scotia'],
  banbif: ['banbif', 'interamericano de finanzas'],
  nacion: ['banco de la nacion', 'nacion'],
  ripley: ['ripley'],
  falabella: ['falabella'],
  pichincha: ['pichincha'],
  paypal: ['paypal'],
};

// Bank matching any of the texts (e.g. institution, then account name).
export function findBank(...texts: (string | undefined | null)[]) {
  for (const text of texts) {
    if (!text) continue;
    const t = normalize(text);
    const bank = PERU_INSTITUTIONS.find((b) =>
      (BANK_ALIASES[b.id] ?? [b.id]).some((a) => t.includes(a))
    );
    if (bank) return bank;
  }
  return undefined;
}

export function findService(name: string | undefined | null): ServiceOption | undefined {
  if (!name) return undefined;
  const t = normalize(name);
  return (
    POPULAR_SERVICES.find((s) => normalize(s.name) === t) ??
    POPULAR_SERVICES.find((s) => t.startsWith(normalize(s.name)))
  );
}
