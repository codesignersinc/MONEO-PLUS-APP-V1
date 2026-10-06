// Payment vouchers from bank / wallet apps read with OCR ("¡Yapeaste!", "¡Operación
// exitosa!", "¡Pago exitoso!", "Te yapearon"…): works for any bank, not only the ones
// with a dedicated parser. Finds the amount, whether money left or arrived, the
// counterpart, the date and the operation number. Pure function; the user always reviews
// the suggestion before registering it.
//
// Privacy: phone numbers, security codes and account numbers are never read; only the
// last 4 digits of the source account ("Desde … 2097") to suggest the account.

import type { BankId, MovementKind, ParsedMovement } from './types';
import { localDate, localTime, normalizeText, parseDate, parseTime } from './normalize';
import { cleanMerchant, suggestCategory } from './merchant';

// Money that arrived.
const IN =
  /te\s*yape(?:aron|[oó])|te\s*plinearon|recibiste|te\s*envi(?:[oó]|aron)|te\s*transfiri|te\s*(?:pag[oó]|pagaron|depositaron)|recibido\s+de|has\s+recibido|(?:abono|dep[oó]sito|transferencia)\s+recibid[oa]|cobraste/i;
// Money that left.
const OUT =
  /yapeaste|plineaste|enviado\s+a|enviaste|pagaste|transferiste|pago\s+(?:exitoso|realizado)|operaci[oó]n\s+(?:exitosa|realizada)|transferencia\s+(?:exitosa|realizada)|env[ií]o\s+exitoso|realizad[oa]\s+con\s+[eé]xito|constancia\s+de\s+(?:pago|transferencia|operaci[oó]n)|beneficiario|destinatario|cuenta\s+(?:de\s+)?destino/i;

// Currency marker as OCR reads it: "S/", "s/", "5/", "sI", "S|", "S/.", "US$", "$".
const CUR = String.raw`US\s?\$|(?:[Ss5§$])\s?[\/|Il]\s?\.?|\$`;
const NUM = String.raw`\d{1,3}(?:[,.]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const AMOUNT_RE = new RegExp(String.raw`(?<![\w/.,])(${CUR})\s*(${NUM})(?![\d/]|[.,]\d)`, 'g');

// Lines around an amount that make it something else (ads, fees, balances, limits).
const AD_CONTEXT = /hasta|bienvenida|cashback|publicidad|\bgana\b|descuento|promo|oferta|sorteo/i;
const NOT_THE_AMOUNT = /comisi[oó]n|saldo|disponible|l[ií]mite|m[ií]nimo|m[aá]ximo|itf\b/i;

const TITLE =
  /yapeaste|plineaste|te\s*yape|te\s*plinearon|exitos[oa]|realizad[oa]|recibiste|constancia|enviaste|pagaste|transferiste/i;

const OTHER_BANKS =
  /banbif|pichincha|mibanco|scotiabank|banco de la naci[oó]n|caja\s+(?:arequipa|huancayo|piura|cusco|trujillo|sullana|ica|tacna|maynas)|falabella|ripley|\bgnb\b|citibank|alfin|compartamos|agrobanco|tunki|\bbim\b|ligo|lukita/i;

// Accents removed for the keyword tests: OCR often misreads them ("Operacién").
function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// A currency alone on its line ("S/" printed small next to a big "300") is joined with the
// amount on the next line, skipping OCR noise in between ("|", "—").
function joinSplitAmounts(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^(?:S\/\.?|US\$|\$)$/i.test(lines[i])) {
      let j = i + 1;
      while (j < lines.length && j <= i + 2 && !/[\p{L}\d]/u.test(lines[j])) j++;
      if (j < lines.length && /^\d/.test(lines[j])) {
        out.push(`${lines[i]} ${lines[j]}`);
        i = j;
        continue;
      }
    }
    out.push(lines[i]);
  }
  return out;
}

function toNumber(raw: string): number {
  const s = raw.replace(/\s/g, '');
  const dec = s.match(/[.,](\d{1,2})$/);
  if (dec) {
    const int = s.slice(0, s.length - dec[0].length).replace(/[.,]/g, '');
    return Math.round(parseFloat(`${int}.${dec[1]}`) * 100) / 100;
  }
  return parseFloat(s.replace(/[.,]/g, ''));
}

function findAmount(
  lines: string[]
): { amount: number; currency: 'PEN' | 'USD'; index: number } | null {
  for (let i = 0; i < lines.length; i++) {
    if (NOT_THE_AMOUNT.test(fold(lines[i]))) continue;
    const around = `${lines[i - 1] ?? ''} ${lines[i]} ${lines[i + 1] ?? ''}`;
    if (AD_CONTEXT.test(around)) continue;
    for (const m of lines[i].matchAll(AMOUNT_RE)) {
      const amount = toNumber(m[2]);
      if (!(amount > 0 && amount < 1_000_000)) continue;
      const currency = /\$/.test(m[1]) && !/^[Ss5§]/.test(m[1]) ? 'USD' : 'PEN';
      return { amount, currency, index: i };
    }
  }
  // OCR sometimes drops the currency of the big amount: a bare number right under the
  // title ("¡Yapeaste!" / "50").
  const title = lines.findIndex((l) => TITLE.test(fold(l)));
  if (title >= 0) {
    for (let i = title + 1; i <= title + 4 && i < lines.length; i++) {
      const m = lines[i].match(/^(\d{1,6}(?:[.,]\d{1,2})?)$/);
      if (m && toNumber(m[1]) > 0) return { amount: toNumber(m[1]), currency: 'PEN', index: i };
    }
  }
  return null;
}

function bankOf(lines: string[], text: string): BankId {
  if (/yapeaste|te\s*yape/i.test(text)) return 'yape';
  if (/plineaste|te\s*plinearon/i.test(text)) return 'plin';
  const byName = (s: string): BankId | null => {
    if (/bcp|banco de cr[eé]dito/i.test(s)) return 'bcp';
    if (/in[tf]er[bv]ank|lnterbank/i.test(s)) return 'interbank';
    if (/bbva/i.test(s)) return 'bbva';
    if (/scotiabank/i.test(s)) return 'scotiabank';
    if (OTHER_BANKS.test(s)) return 'otro';
    return null;
  };
  // The app's logo is at the top; "- Yape" / "PLIN" further down is the destination.
  const head = byName(lines.slice(0, 4).join(' '));
  if (head) return head;
  const anywhere = byName(text);
  if (anywhere) return anywhere;
  if (/\byape\b/i.test(text)) return 'yape';
  if (/\bplin\b/i.test(text)) return 'plin';
  return 'otro';
}

const LABEL =
  /^(?:enviado\s+a|enviaste\s+a|pagaste\s+a|para\s*:|destinatario|beneficiario|nombre\s+del\s+beneficiario|recibido\s+de|remitente|de\s*:|comercio|empresa|establecimiento|pagado\s+a)\s*:?\s*(.*)$/i;

const NOT_A_NAME =
  /compartir|yapeaste|plineaste|exitos|operaci[oó]n|fecha|hora|c[oó]digo|datos|nro|n[uú]mero|destino|comisi[oó]n|reserva|mensaje|celular|gratis|desde|cuenta|constancia|realizad|recibiste|\d{3}/i;

function cleanName(raw: string): string {
  const name = raw
    .replace(/\d[\d\s-]{5,}.*$/, '') // phone that follows ("970 819 133 - Yape")
    .replace(/[*|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!/[a-záéíóúñ]{2,}/i.test(name)) return '';
  return name
    .toLowerCase()
    .replace(/(^|\s)([a-záéíóúñ])/g, (_, s, c) => s + c.toUpperCase())
    .slice(0, 60);
}

function counterpart(lines: string[], amountIndex: number): { name: string; labeled: string } {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LABEL);
    if (!m) continue;
    const value = m[1].trim() || lines[i + 1] || '';
    const name = cleanName(value);
    if (name) return { name, labeled: lines[i].toLowerCase() };
  }
  // Wallet vouchers: the name is the first line under the amount ("Ynder Pel*").
  for (let i = amountIndex + 1; i <= amountIndex + 2 && i < lines.length; i++) {
    if (NOT_A_NAME.test(lines[i])) continue;
    const name = cleanName(lines[i]);
    if (name && name.split(' ').length <= 5) return { name, labeled: '' };
  }
  return { name: '', labeled: '' };
}

export function looksLikeVoucher(text: string): boolean {
  const t = fold(text);
  return IN.test(t) || OUT.test(t);
}

export function parseVoucher(text: string, receivedAt: Date): ParsedMovement | null {
  const normalized = normalizeText(text);
  if (!looksLikeVoucher(normalized)) return null;
  const lines = joinSplitAmounts(
    normalized
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  );
  const found = findAmount(lines);
  if (!found) return null;

  const incoming = IN.test(fold(normalized));
  const bank = bankOf(lines, normalized);
  const { name, labeled } = counterpart(lines, found.index);
  const isPayment = /comercio|empresa|establecimiento|pagaste|servicio/i.test(labeled + normalized);

  let kind: MovementKind;
  if (incoming) {
    kind = bank === 'yape' ? 'yape_recibido' : bank === 'plin' ? 'plin_recibido' : 'transferencia';
  } else if (bank === 'yape') {
    kind = 'yape_enviado';
  } else if (/empresa|servicio/i.test(labeled)) {
    kind = 'pago_servicio';
  } else if (/comercio|establecimiento/i.test(labeled)) {
    kind = 'consumo';
  } else {
    kind = 'transferencia';
  }

  const fallbackName =
    bank === 'yape' ? 'Yape' : bank === 'plin' ? 'Plin' : incoming ? 'Ingreso' : 'Transferencia';
  const merchant = (isPayment && !incoming && name ? cleanMerchant(name) : name) || fallbackName;

  // The time is on the date line or the next one (the first line may be the phone's clock).
  const dateIdx = lines.findIndex((l) => parseDate(l, receivedAt));
  const date = dateIdx >= 0 ? parseDate(lines[dateIdx], receivedAt) : null;
  const time = date ? (parseTime(lines[dateIdx]) ?? parseTime(lines[dateIdx + 1] ?? '')) : null;
  // "Desde Ahorro Soles / **** 2097": the account the money left from (last 4 only).
  const fromIdx = lines.findIndex((l) => /^desde\b/i.test(l));
  const from = fromIdx >= 0 ? lines.slice(fromIdx, fromIdx + 2).join(' ') : '';
  const sourceLast4 = from.match(/(\d{4})\s*$/)?.[1];
  const opLine = lines.findIndex((l) =>
    /(?:n(?:ro|[uú]mero|[º°o])\.?\s*de\s*operaci[oó]n|c[oó]digo\s+de\s+operaci[oó]n)/i.test(l)
  );
  const opId =
    opLine >= 0
      ? `${lines[opLine]} ${lines[opLine + 1] ?? ''}`.match(/\b(\d{6,20})\b/)?.[1]
      : undefined;

  return {
    bank,
    kind,
    type: incoming ? 'ingreso' : 'gasto',
    amount: found.amount,
    currency: found.currency,
    merchant: merchant.slice(0, 120),
    date: date ?? localDate(receivedAt),
    time: date ? time : localTime(receivedAt),
    ...(sourceLast4 && !incoming ? { cardLast4: sourceLast4 } : {}),
    operationId: opId,
    suggestedCategory: isPayment && !incoming ? suggestCategory(merchant, normalized) : null,
    recurring: false,
  };
}
