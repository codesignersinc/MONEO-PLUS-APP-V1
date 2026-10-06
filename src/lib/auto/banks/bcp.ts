import { flatten, last4, parseAmount, valueAfter } from '../normalize';
import { AMOUNT_SRC, type BankParser, merchantFields, when } from './common';

// BCP: card purchase emails ("Realizaste un consumo de S/ 2.99 con tu Tarjeta de Crédito BCP en …").
export const parseBcp: BankParser = (msg) => {
  const flat = flatten(msg.text);
  const m = flat.match(
    new RegExp(
      `Realizaste un consumo de\\s*(${AMOUNT_SRC})\\s+con tu Tarjeta de (Cr[eé]dito|D[eé]bito)(?: BCP)?\\s+en\\s+(.+?)\\.(?:\\s|$)`,
      'i'
    )
  );
  if (!m) return null;
  const amt = parseAmount(valueAfter(msg.text, /Total del consumo/) ?? m[1]);
  if (!amt) return null;
  const empresa = valueAfter(msg.text, /Empresa/) || m[3];
  const credit = /cr/i.test(m[2]);
  return {
    bank: 'bcp',
    kind: 'consumo',
    type: 'gasto',
    ...amt,
    ...merchantFields(empresa),
    ...when(msg, valueAfter(msg.text, /Fecha y hora/)),
    cardLast4: last4(valueAfter(msg.text, /N[uú]mero de Tarjeta(?: de (?:Cr[eé]dito|D[eé]bito))?/)),
    cardType: credit ? 'credito' : 'debito',
    operationId: valueAfter(msg.text, /N[uú]mero de operaci[oó]n/)?.replace(/\D/g, '') || undefined,
    recurring: false,
  };
};
