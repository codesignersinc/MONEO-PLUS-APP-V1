import { flatten, last4, parseAmount, valueAfter } from '../normalize';
import { type BankParser, personName, when } from './common';

// BBVA: transfer receipts ("Constancia Transf. Interbancaria").
export const parseBbva: BankParser = (msg) => {
  const flat = flatten(`${msg.subject ?? ''}\n${msg.text}`);
  if (!/Transferencia|Transf\./i.test(flat)) return null;
  const amt = parseAmount(
    valueAfter(msg.text, /Importe transferido/) ?? valueAfter(msg.text, /Importe cargado/) ?? ''
  );
  if (!amt) return null;
  const ownAccount = /cuenta es propia/i.test(flat);
  const destinationBank = valueAfter(msg.text, /Banco de destino/) ?? undefined;
  const destinationLast4 = last4(valueAfter(msg.text, /Cuenta de destino/));
  const beneficiary = valueAfter(msg.text, /Nombre del beneficiario/);
  const bankName = destinationBank ? personName(destinationBank) : 'otra cuenta';
  return {
    bank: 'bbva',
    kind: 'transferencia',
    type: ownAccount ? 'transferencia' : 'gasto',
    ...amt,
    // Own account: no third-party name needed. Otherwise the beneficiary describes it.
    merchant: ownAccount
      ? `Transferencia a ${bankName}${destinationLast4 ? ` •${destinationLast4}` : ''}`
      : beneficiary
        ? personName(beneficiary)
        : `Transferencia a ${bankName}`,
    ...when(msg, valueAfter(msg.text, /Fecha y hora de la operaci[oó]n/)),
    destinationBank,
    destinationLast4,
    ownAccount,
    operationId: valueAfter(msg.text, /N[uú]mero de operaci[oó]n/)?.replace(/\D/g, '') || undefined,
    suggestedCategory: ownAccount ? null : 'Otros',
    recurring: false,
  };
};
