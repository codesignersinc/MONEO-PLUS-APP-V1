import { describe, expect, it } from 'vitest';
import { parseBankMessage } from '@/lib/auto';
import { cleanOcrText } from '@/lib/auto/receipt';
import { BCP_OCR, BCP_OCR_PASS1, INTERBANK_OCR, YAPE_OCR, YAPE_OCR_PASS1 } from './voucherFixtures';

const now = new Date(2026, 9, 6, 12, 0);
const read = (text: string) =>
  parseBankMessage({ source: 'text', text: cleanOcrText(text), receivedAt: now });

describe('app vouchers (OCR screenshots)', () => {
  it('Yape "¡Yapeaste!": amount, person, date, operation; ignores the ad "S/200"', () => {
    expect(read(YAPE_OCR)).toMatchObject({
      bank: 'yape',
      kind: 'yape_enviado',
      type: 'gasto',
      amount: 50,
      currency: 'PEN',
      merchant: 'Rocio Val',
      date: '2026-08-05',
      time: '13:44',
      operationId: '11112222',
    });
  });

  it('BCP "¡Operación exitosa!" (Plin): amount, recipient, source account last 4', () => {
    expect(read(BCP_OCR)).toMatchObject({
      bank: 'bcp',
      kind: 'transferencia',
      type: 'gasto',
      amount: 70,
      merchant: 'Luis Alberto Ramos Perez',
      date: '2026-06-28',
      time: '09:54',
      cardLast4: '1234',
      operationId: '00012345',
    });
  });

  it('Interbank Plin "¡Pago exitoso!": amount, recipient without the phone number', () => {
    const r = read(INTERBANK_OCR);
    expect(r).toMatchObject({
      bank: 'interbank',
      kind: 'transferencia',
      type: 'gasto',
      amount: 66,
      merchant: 'Mario P Soto R',
      date: '2026-09-11',
      time: '11:34',
      operationId: '50000001',
    });
    expect(JSON.stringify(r)).not.toMatch(/900|000 000/);
  });

  it('first OCR pass without the big amount → no suggestion (never the ad amount)', () => {
    expect(read(YAPE_OCR_PASS1)).toBeNull();
    expect(read(BCP_OCR_PASS1)).toBeNull();
  });

  it('money received: Yape, Plin and bank transfers are income', () => {
    expect(read('¡Te yapearon!\nS/ 25.50\nMaria Lop*\n06 oct. 2026 | 10:15 a.m.')).toMatchObject({
      bank: 'yape',
      kind: 'yape_recibido',
      type: 'ingreso',
      amount: 25.5,
      merchant: 'Maria Lop',
      time: '10:15',
    });
    expect(
      read('Interbank\n¡Recibiste un plin!\nS/ 40.00\nDe: Carlos Ruiz\n05 Oct 2026 08:10 PM')
    ).toMatchObject({
      bank: 'interbank',
      type: 'ingreso',
      amount: 40,
      merchant: 'Carlos Ruiz',
      time: '20:10',
    });
    expect(
      read('BBVA\nTransferencia recibida\nS/ 1,250.00\nRemitente: Empresa SAC\n01/10/2026')
    ).toMatchObject({
      bank: 'bbva',
      kind: 'transferencia',
      type: 'ingreso',
      amount: 1250,
      date: '2026-10-01',
    });
  });

  it('other banks and dollars', () => {
    expect(
      read(
        'Scotiabank\nConstancia de transferencia\nUS$ 120.00\nBeneficiario: Ana Torres\n03/10/2026'
      )
    ).toMatchObject({
      bank: 'scotiabank',
      type: 'gasto',
      amount: 120,
      currency: 'USD',
      merchant: 'Ana Torres',
    });
    expect(
      read('Mibanco\nOperación exitosa\nS/ 300\nEnviado a: Pedro Diaz\n02 oct 2026')
    ).toMatchObject({
      bank: 'otro',
      type: 'gasto',
      amount: 300,
      merchant: 'Pedro Diaz',
    });
  });

  it('a fee or balance line is never taken as the amount', () => {
    expect(read('¡Pago exitoso!\nComisión S/ 1.00\nS/ 80.00\nEnviado a: Luis Paz')).toMatchObject({
      amount: 80,
    });
  });
});
