import { flatten, last4, parseAmount, parseDate, valueAfter } from '../normalize';
import { AMOUNT_SRC, type BankParser, merchantFields, personName, when } from './common';

// Interbank: purchase / recurring-charge emails and app notifications, and Plin received.
export const parseInterbank: BankParser = (msg) => {
  const flat = flatten(`${msg.subject ?? ''}\n${msg.text}`);
  const isEmail = msg.source === 'email';

  // "Anat Marticorena te ha plineado S/ 100.00"
  let m = flat.match(new RegExp(`(.+?)\\s+te ha plineado\\s+(${AMOUNT_SRC})`, 'i'));
  if (m) {
    const amt = parseAmount(m[2]);
    if (!amt) return null;
    return {
      bank: 'interbank',
      kind: 'plin_recibido',
      type: 'ingreso',
      ...amt,
      merchant: personName(m[1].replace(/^Interbank\s+/i, '')),
      ...when(msg),
      suggestedCategory: null,
      recurring: false,
    };
  }

  // Email: "Conoce el detalle: Tarjeta: ****1997 Comercio: … Monto: S/. 103.71 Fecha: … Hora: …"
  // Also accepted as pasted text when it clearly comes from Interbank.
  const detailBlock = /Comercio\s*:/i.test(msg.text) && /Monto\s*:/i.test(msg.text);
  const fromInterbank =
    isEmail || /interbank/i.test(flat) || /Tarjeta\s*:\s*\*{4}\d{4}/i.test(msg.text);
  if (detailBlock && fromInterbank) {
    const amt = parseAmount(valueAfter(msg.text, /Monto/) ?? '');
    const comercio = valueAfter(msg.text, /Comercio/);
    if (!amt || !comercio) return null;
    const recurring = /pago recurrente/i.test(flat);
    return {
      bank: 'interbank',
      kind: recurring ? 'pago_recurrente' : 'consumo',
      type: 'gasto',
      ...amt,
      ...merchantFields(comercio),
      ...when(msg, valueAfter(msg.text, /Fecha/), valueAfter(msg.text, /Hora/)),
      cardLast4: last4(valueAfter(msg.text, /Tarjeta/)),
      cardType: cardTypeOf(flat),
      recurring,
    };
  }

  // "Realizaste un consumo de S/.21.00 en IZI*YOPO BENVID*0056604 con tu Tarjeta de Débito."
  // "Se realizó un pago recurrente de S/.19.90 en OPENAI *CHATGPT SUBSCR con tu Tarjeta de Débito."
  m = flat.match(
    new RegExp(
      `(Realizaste un consumo|Se realiz[oó] un pago recurrente) de\\s*(${AMOUNT_SRC})\\s+en\\s+(.+?)(?:\\s+con tu Tarjeta de (D[eé]bito|Cr[eé]dito).*|\\s*\\.?\\s*)$`,
      'i'
    )
  );
  if (m) {
    const amt = parseAmount(m[2]);
    if (!amt) return null;
    const recurring = /recurrente/i.test(m[1]);
    return {
      bank: 'interbank',
      kind: recurring ? 'pago_recurrente' : 'consumo',
      type: 'gasto',
      ...amt,
      ...merchantFields(m[3]),
      ...when(msg),
      cardType: m[4] ? (/cr/i.test(m[4]) ? 'credito' : 'debito') : undefined,
      recurring,
    };
  }

  // "PAGO S/ 21.00 A: IZI*YOPOBENVIDES MIRAFLORES (04/10 05:20:55)"
  m = flat.match(
    new RegExp(
      `PAGO\\s+(${AMOUNT_SRC})\\s+A:\\s*(.+?)\\s*\\((\\d{1,2}/\\d{1,2})\\s+([\\d:]+)\\)`,
      'i'
    )
  );
  if (m) {
    const amt = parseAmount(m[1]);
    if (!amt) return null;
    return {
      bank: 'interbank',
      kind: 'consumo',
      type: 'gasto',
      ...amt,
      ...merchantFields(m[2]),
      ...pagoWhen(msg.receivedAt, m[3], m[4]),
      recurring: false,
    };
  }
  return null;
};

// "(04/10 05:20:55)" is on a 12-hour clock without AM/PM (it arrived at 5:20 PM): take
// the reading (h or h+12) closest to when the notification arrived.
function pagoWhen(receivedAt: Date, dayMonth: string, clock: string) {
  const date = parseDate(dayMonth, receivedAt) ?? '';
  const [h, mi] = clock.split(':').map(Number);
  const at = (hour: number) => new Date(`${date}T00:00:00`).getTime() + (hour * 60 + mi) * 60000;
  const ref = receivedAt.getTime();
  const hour = h < 12 && Math.abs(at(h + 12) - ref) < Math.abs(at(h) - ref) ? h + 12 : h;
  return { date, time: `${String(hour).padStart(2, '0')}:${String(mi).padStart(2, '0')}` };
}

// "Tarjeta Interbank Visa Débito Clásica" / "Tarjeta de Crédito": the first mention next to
// "Tarjeta" (forwarded emails can mention credit cards elsewhere, e.g. in promotions).
function cardTypeOf(text: string): 'debito' | 'credito' {
  const m = text.match(/Tarjeta[^.\n]{0,40}?(D[eé]bito|Cr[eé]dito)/i);
  return m && /cr/i.test(m[1]) ? 'credito' : 'debito';
}
