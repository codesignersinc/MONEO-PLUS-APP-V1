import { describe, expect, it } from 'vitest';
import { parseBankMessage } from '@/lib/auto';
import { cleanOcrText, parseReceipt } from '@/lib/auto/receipt';

const now = new Date(2026, 9, 6, 12, 0);

const BOLETA = `TOTTUS
HIPERMERCADOS TOTTUS S.A.
RUC 20508565934
AV. ANGAMOS ESTE 1805
BOLETA DE VENTA ELECTRONICA
B123-00045678
FECHA: 05/10/2026 HORA: 18:45
LECHE GLORIA 4.50
PAN FRANCES 3.20
SUBTOTAL 38.90
IGV 18% 7.00
TOTAL S/ 45.90
EFECTIVO 50.00
VUELTO 4.10`;

const TICKET = `Pollería El Rey
R.U.C. 10456789012
Ticket 0001-2345
Fecha 04-10-2026
1/4 Pollo 28.00
Gaseosa 6.00
TOTAL: 34,00`;

describe('receipts (OCR)', () => {
  it('supermarket boleta: TOTAL, merchant, date, category', () => {
    expect(parseReceipt(BOLETA, now)).toMatchObject({
      bank: 'otro',
      kind: 'texto',
      type: 'gasto',
      amount: 45.9,
      currency: 'PEN',
      merchant: 'Tottus',
      date: '2026-10-05',
      time: null,
      suggestedCategory: 'Supermercado',
    });
  });

  it('restaurant ticket with comma decimals and dd-mm-yyyy', () => {
    expect(parseReceipt(TICKET, now)).toMatchObject({
      amount: 34,
      merchant: 'Pollería El Rey',
      date: '2026-10-04',
      suggestedCategory: 'Comida',
    });
  });

  it('thousands separators', () => {
    expect(parseReceipt('Ferretería Sol\nTOTAL S/ 1,250.00', now)).toMatchObject({ amount: 1250 });
  });

  it('no TOTAL → not a receipt', () => {
    expect(parseReceipt('Tottus\nLECHE 4.50\nPAN 3.20', now)).toBeNull();
  });

  it('OCR slips are cleaned: "5/" → "S/"', () => {
    expect(cleanOcrText('TOTAL 5/ 45.90')).toBe('TOTAL S/ 45.90');
    expect(cleanOcrText('consumo de S /.28.58')).toBe('consumo de S/ 28.58');
    expect(cleanOcrText('Monto S/.19.90')).toBe('Monto S/ 19.90');
  });

  it('through the interpreter: receipt text and an OCR screenshot of a notification', () => {
    expect(parseBankMessage({ source: 'text', text: BOLETA, receivedAt: now })).toMatchObject({
      amount: 45.9,
      merchant: 'Tottus',
    });
    const screenshot = cleanOcrText(
      'Interbank 27m ago\nRealizaste un consumo de S/.28.58 en OCORIS 2 con tu\nTarjeta de Débito.'
    );
    expect(parseBankMessage({ source: 'text', text: screenshot, receivedAt: now })).toMatchObject({
      bank: 'interbank',
      amount: 28.58,
      merchant: 'Ocoris 2',
    });
  });
});
