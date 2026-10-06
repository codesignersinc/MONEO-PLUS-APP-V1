import { flatten, parseAmount, valueAfter } from '../normalize';
import { AMOUNT_SRC, type BankParser, merchantFields, personName, when } from './common';

// Text between a label and the next known label, on the flattened message.
function between(flat: string, label: RegExp, stop: RegExp): string | null {
  const m = flat.match(new RegExp(`${label.source}\\s*:?\\s*(.+?)\\s*(?=${stop.source}|$)`, 'i'));
  return m ? m[1].trim() : null;
}

const STOPS =
  /Yapero|Tu n[uú]mero|N[uú]mero de celular|Fecha y hora|Celular del|Nombre del|N[º°o]\.? de operaci|Detalle del servicio|Empresa|Servicio|C[oó]digo de usuario|Titular|Resuelve/;

// Yape: payment received (notification), yapeo sent and service paid (emails).
// The security code, phone numbers, service account and receipt numbers are never read.
export const parseYape: BankParser = (msg) => {
  const flat = flatten(`${msg.subject ?? ''}\n${msg.text}`);

  // "Violeta Rey* te envió un pago por S/ 13.3. El cód. de seguridad es: 104"
  const m = flat.match(
    new RegExp(
      `(?:^|Confirmaci[oó]n de Pago\\s+)?([^.]+?)\\s+te envi[oó] un pago por\\s+(${AMOUNT_SRC})`,
      'i'
    )
  );
  if (m) {
    const amt = parseAmount(m[2]);
    if (!amt) return null;
    return {
      bank: 'yape',
      kind: 'yape_recibido',
      type: 'ingreso',
      ...amt,
      merchant: personName(m[1].replace(/^Confirmaci[oó]n de Pago\s+/i, '')),
      ...when(msg),
      suggestedCategory: null,
      recurring: false,
    };
  }

  const opId =
    between(flat, /N[º°o]\.?\s*de operaci[oó]n(?: Yape)?/, STOPS)?.replace(/\D/g, '') || undefined;
  const dateText = between(flat, /Fecha y hora(?: de la operaci[oó]n)?/, STOPS);

  // Service paid with Yape (Bitel, Claro, Luz del Sur…).
  if (/servicio fue yapeado/i.test(flat)) {
    const amt = parseAmount(between(flat, /Monto total/, STOPS) ?? '');
    const empresa = valueAfter(msg.text, /Empresa/) ?? between(flat, /Empresa/, STOPS);
    if (!amt || !empresa) return null;
    const fields = merchantFields(empresa);
    return {
      bank: 'yape',
      kind: 'pago_servicio',
      type: 'gasto',
      ...amt,
      ...fields,
      suggestedCategory: fields.suggestedCategory ?? 'Servicios',
      ...when(msg, dateText),
      operationId: opId,
      recurring: false,
    };
  }

  // Yapeo sent.
  if (/acabas de yapear|yapeaste/i.test(flat)) {
    const amt = parseAmount(between(flat, /Monto de yapeo\*?/, STOPS) ?? '');
    if (!amt) return null;
    const beneficiary = between(flat, /Nombre del Beneficiario/, STOPS);
    return {
      bank: 'yape',
      kind: 'yape_enviado',
      type: 'gasto',
      ...amt,
      merchant: beneficiary ? personName(beneficiary) : 'Yape',
      ...when(msg, dateText),
      operationId: opId,
      suggestedCategory: null,
      recurring: false,
    };
  }
  return null;
};
