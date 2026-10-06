// Merchant names as banks print them ("IZI*YOPO BENVID*0056604", "EBN*SG PDFGURU",
// "OPENAI *CHATGPT SUBSCR") → a readable name and a suggested category.

// Payment processors / gateways that prefix the real merchant.
const PROCESSOR_PREFIX =
  /^(?:IZI|EBN\*SG|EBN|PAYU|DLO|DLC|MP|PP|SQ|CULQI|NIUBIZ|VISANET|OPENPAY|PAGOEFECTIVO|PAYPAL)\s*\*\s*/i;

// Known merchants: pattern on the compact uppercase name → display name.
const KNOWN: [RegExp, string][] = [
  [/OPENAI|CHATGPT/, 'ChatGPT'],
  [/NETFLIX/, 'Netflix'],
  [/SPOTIFY/, 'Spotify'],
  [/DISNEY/, 'Disney+'],
  [/YOUTUBE/, 'YouTube'],
  [/GOOGLE\s*\*?\s*(?:STORAGE|ONE)/, 'Google One'],
  [/APPLE\.COM|APPLE\s*SERVICES/, 'Apple'],
  [/AMAZON|AMZN/, 'Amazon'],
  [/UBER\s*EATS/, 'Uber Eats'],
  [/UBER/, 'Uber'],
  [/RAPPI/, 'Rappi'],
  [/PEDIDOSYA/, 'PedidosYa'],
  [/CABIFY/, 'Cabify'],
  [/WONG/, 'Wong'],
  [/PLAZA\s*VEA/, 'Plaza Vea'],
  [/TOTTUS/, 'Tottus'],
  [/METRO\b/, 'Metro'],
  [/TAMBO/, 'Tambo'],
  [/OXXO/, 'Oxxo'],
  [/BITEL/, 'Bitel'],
  [/CLARO/, 'Claro'],
  [/MOVISTAR/, 'Movistar'],
  [/ENTEL/, 'Entel'],
  [/PDFGURU/, 'PDFGuru'],
  [/STARBUCKS/, 'Starbucks'],
];

// Category hints (labels of CATEGORY_PRESETS). First match wins.
const CATEGORY_RULES: [RegExp, string][] = [
  [
    /CHATGPT|OPENAI|NETFLIX|SPOTIFY|DISNEY|YOUTUBE|GOOGLE ONE|APPLE|PDFGURU|SUBSCR|HBO|PRIME/,
    'Suscripciones',
  ],
  [/WONG|PLAZA VEA|TOTTUS|METRO|MAKRO|VIVANDA|MASS\b|TAMBO|OXXO|MERCADO/, 'Supermercado'],
  [
    /UBER(?! EATS)|CABIFY|DIDI|INDRIVE|TAXI|GRIFO|PRIMAX|REPSOL|PECSA|PETROPERU|PEAJE|ESTACION|E S |SERVICENTRO/,
    'Transporte',
  ],
  [
    /RAPPI|PEDIDOSYA|UBER EATS|STARBUCKS|KFC|BEMBOS|PIZZA|POLLER|CHIFA|RESTAURANT|CAFE|BURGER|MCDONALD|YOPO/,
    'Comida',
  ],
  [/BITEL|CLARO|MOVISTAR|ENTEL|LUZ DEL SUR|ENEL|SEDAPAL|CALIDDA|WIN\b/, 'Servicios'],
  [/BOTICA|FARMACIA|INKAFARMA|MIFARMA|CLINICA|SALUD/, 'Salud'],
  [/CINEPLANET|CINEMARK|CINE|STEAM|PLAYSTATION|XBOX/, 'Entretenimiento'],
  [/UNIVERSIDAD|INSTITUTO|COLEGIO|UDEMY|COURSERA|PLATZI/, 'Educación'],
];

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-/])([a-záéíóúñ])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

export function cleanMerchant(raw: string): string {
  let s = raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;]+$/, '');
  s = s.replace(PROCESSOR_PREFIX, '');
  // Trailing terminal / store codes: "*0056604", " 0056604".
  s = s.replace(/\*\s*\d{3,}$/, '').replace(/\s+\d{5,}$/, '');
  s = s.replace(/\*/g, ' ').replace(/\s+/g, ' ').trim();
  const upper = s.toUpperCase();
  for (const [re, name] of KNOWN) if (re.test(upper)) return name;
  return titleCase(s);
}

export function suggestCategory(merchant: string, raw = ''): string | null {
  const hay = `${merchant} ${raw}`.toUpperCase();
  for (const [re, cat] of CATEGORY_RULES) if (re.test(hay)) return cat;
  return null;
}

// Compact key to compare the same merchant written two ways
// ("Yopo Benvid" vs "Yopobenvides Miraflores", "Ocoris 2" vs "Ocoris2 La Victoria").
export function merchantKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function sameMerchant(a: string, b: string): boolean {
  const ka = merchantKey(a);
  const kb = merchantKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const [short, long] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  return short.length >= 5 && long.startsWith(short.slice(0, Math.max(5, short.length - 2)));
}
