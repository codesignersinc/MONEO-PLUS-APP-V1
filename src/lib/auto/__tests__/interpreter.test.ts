import { describe, expect, it } from 'vitest';
import { bankForEmail, isLikelyDuplicate, parseBankMessage } from '@/lib/auto';
import type { BankMessage, ParsedMovement } from '@/lib/auto';
import { cleanMerchant, sameMerchant, suggestCategory } from '@/lib/auto/merchant';
import { parseAmount, parseDate, parseTime } from '@/lib/auto/normalize';
import * as F from './fixtures';

const email = (
  f: { sender: string; subject?: string; text: string },
  at = new Date(2026, 9, 5, 21, 0)
) => ({ source: 'email', ...f, receivedAt: at }) as BankMessage;
const push = (f: { sender: string; text: string }, at: Date) =>
  ({ source: 'notification', ...f, receivedAt: at }) as BankMessage;

function parse(msg: BankMessage): ParsedMovement {
  const r = parseBankMessage(msg);
  if (!r) throw new Error('not parsed: ' + msg.text.slice(0, 60));
  return r;
}

describe('normalize', () => {
  it('reads amounts as banks write them', () => {
    expect(parseAmount('S/.19.90')).toEqual({ amount: 19.9, currency: 'PEN' });
    expect(parseAmount('S/ 13.3')).toEqual({ amount: 13.3, currency: 'PEN' });
    expect(parseAmount('S/ 20')).toEqual({ amount: 20, currency: 'PEN' });
    expect(parseAmount('S/. 103.71')).toEqual({ amount: 103.71, currency: 'PEN' });
    expect(parseAmount('S/ 1,250.00')).toEqual({ amount: 1250, currency: 'PEN' });
    expect(parseAmount('US$ 10.50')).toEqual({ amount: 10.5, currency: 'USD' });
    expect(parseAmount('sin monto')).toBeNull();
  });

  it('reads dates and times', () => {
    const ref = new Date(2026, 9, 5);
    expect(parseDate('05/10/2026', ref)).toBe('2026-10-05');
    expect(parseDate('01 de octubre de 2026 - 05:56 PM', ref)).toBe('2026-10-01');
    expect(parseDate('04 octubre, 2026 05:41', ref)).toBe('2026-10-04');
    expect(parseDate('27 Jun. 2025 - 06:56 pm', ref)).toBe('2025-06-27');
    expect(parseDate('24 agosto 2026 - 10:01 p. m.', ref)).toBe('2026-08-24');
    expect(parseDate('04/10', ref)).toBe('2026-10-04');
    expect(parseDate('31/12', new Date(2027, 0, 2))).toBe('2026-12-31');
    expect(parseTime('05:56 PM')).toBe('17:56');
    expect(parseTime('10:01 p. m.')).toBe('22:01');
    expect(parseTime('12:10 a. m.')).toBe('00:10');
    expect(parseTime('05:41')).toBe('05:41');
  });
});

describe('merchant', () => {
  it('cleans processor prefixes and codes', () => {
    expect(cleanMerchant('IZI*YOPO BENVID*0056604')).toBe('Yopo Benvid');
    expect(cleanMerchant('EBN*SG PDFGURU')).toBe('PDFGuru');
    expect(cleanMerchant('OPENAI *CHATGPT SUBSCR')).toBe('ChatGPT');
    expect(cleanMerchant('E WONG BENAVIDES')).toBe('Wong');
    expect(cleanMerchant('BENAVIDES C18 MIRAFLORE')).toBe('Benavides C18 Miraflore');
  });

  it('suggests categories', () => {
    expect(suggestCategory('ChatGPT')).toBe('Suscripciones');
    expect(suggestCategory('Wong')).toBe('Supermercado');
    expect(suggestCategory('E S El Derby 1', 'E S EL DERBY 1')).toBe('Transporte');
    expect(suggestCategory('Bitel')).toBe('Servicios');
    expect(suggestCategory('Benavides C18 Miraflore')).toBeNull();
  });

  it('matches the same merchant written two ways', () => {
    expect(sameMerchant('Yopo Benvid', 'Yopobenvides Miraflores')).toBe(true);
    expect(sameMerchant('Ocoris 2', 'Ocoris2 La Victoria')).toBe(true);
    expect(sameMerchant('Wong', 'Tottus')).toBe(false);
  });
});

describe('Interbank', () => {
  it('email: recurring charge', () => {
    expect(parse(email(F.INTERBANK_EMAIL_RECURRENTE))).toMatchObject({
      bank: 'interbank',
      kind: 'pago_recurrente',
      type: 'gasto',
      amount: 103.71,
      currency: 'PEN',
      merchant: 'PDFGuru',
      date: '2026-10-05',
      time: '14:48',
      cardLast4: '4821',
      cardType: 'debito',
      recurring: true,
      suggestedCategory: 'Suscripciones',
    });
  });

  it('email: purchase', () => {
    expect(parse(email(F.INTERBANK_EMAIL_CONSUMO))).toMatchObject({
      kind: 'consumo',
      amount: 40,
      date: '2026-10-04',
      time: '05:41',
      suggestedCategory: 'Transporte',
      recurring: false,
    });
  });

  it('pasted email text (no sender) is recognized too', () => {
    const r = parseBankMessage({
      source: 'text',
      text: F.INTERBANK_EMAIL_CONSUMO.text,
      receivedAt: new Date(2026, 9, 5),
    });
    expect(r).toMatchObject({ bank: 'interbank', amount: 40, cardLast4: '4821' });
  });

  it('short typed version without the card part', () => {
    const r = parseBankMessage({
      source: 'text',
      text: 'Realizaste un consumo de S/21 en yopo',
      receivedAt: new Date(2026, 9, 6, 9, 0),
    });
    expect(r).toMatchObject({
      bank: 'interbank',
      type: 'gasto',
      amount: 21,
      merchant: 'Yopo',
      suggestedCategory: 'Comida',
      date: '2026-10-06',
    });
    expect(r?.cardType).toBeUndefined();
  });

  it('a pasted BCP notice is still BCP, not Interbank', () => {
    const r = parseBankMessage({
      source: 'text',
      text: F.BCP_EMAIL_CONSUMO_2.text,
      receivedAt: new Date(2026, 9, 6),
    });
    expect(r).toMatchObject({ bank: 'bcp', amount: 92.92, merchant: 'Wong' });
  });

  it('notification: Plin received is income', () => {
    expect(parse(push(F.IB_PUSH_PLIN, new Date(2026, 9, 5, 20, 43)))).toMatchObject({
      kind: 'plin_recibido',
      type: 'ingreso',
      amount: 100,
      merchant: 'Luis Vega',
      date: '2026-10-05',
      time: '20:43',
    });
    expect(parse(push(F.IB_PUSH_PLIN_2, new Date(2026, 9, 4, 13, 29)))).toMatchObject({
      type: 'ingreso',
      amount: 87,
      merchant: 'María Elena Soto Díaz',
    });
  });

  it('notification: recurring charges', () => {
    expect(parse(push(F.IB_PUSH_RECURRENTE, new Date(2026, 9, 5, 18, 10)))).toMatchObject({
      kind: 'pago_recurrente',
      amount: 19.9,
      merchant: 'ChatGPT',
      suggestedCategory: 'Suscripciones',
      recurring: true,
    });
  });

  it('notification: "PAGO … A:" uses a 12-hour clock without AM/PM', () => {
    const pm = parse(push(F.IB_PUSH_PAGO_YOPO, new Date(2026, 9, 4, 17, 20)));
    expect(pm).toMatchObject({ kind: 'consumo', amount: 21, date: '2026-10-04', time: '17:20' });
    const am = parse(push(F.IB_PUSH_PAGO_OCORIS, new Date(2026, 9, 4, 6, 15)));
    expect(am).toMatchObject({ amount: 28.58, time: '06:15', merchant: 'Ocoris2 La Victoria' });
  });
});

describe('BCP', () => {
  it('credit card purchase emails', () => {
    expect(parse(email(F.BCP_EMAIL_CONSUMO_1))).toMatchObject({
      bank: 'bcp',
      kind: 'consumo',
      type: 'gasto',
      amount: 2.99,
      merchant: 'Benavides C18 Miraflore',
      date: '2026-10-01',
      time: '17:56',
      cardLast4: '7391',
      cardType: 'credito',
      operationId: '0000111222',
    });
    expect(parse(email(F.BCP_EMAIL_CONSUMO_2))).toMatchObject({
      amount: 92.92,
      merchant: 'Wong',
      time: '19:45',
      suggestedCategory: 'Supermercado',
    });
  });
});

describe('BBVA', () => {
  it('transfer to an own account is a transfer, not an expense', () => {
    const r = parse(email(F.BBVA_EMAIL_TRANSFER_PROPIA));
    expect(r).toMatchObject({
      bank: 'bbva',
      kind: 'transferencia',
      type: 'transferencia',
      amount: 50,
      ownAccount: true,
      destinationBank: 'INTERBANK',
      destinationLast4: '6157',
      date: '2026-10-04',
      time: '05:41',
      merchant: 'Transferencia a Interbank •6157',
    });
  });

  it('transfer to someone else is an expense to the beneficiary', () => {
    const text = F.BBVA_EMAIL_TRANSFER_PROPIA.text
      .replace(
        'Carlos Andrés Pérez Rojas\n\n\nEsta cuenta es propia, la operación será exonerada del ITF.',
        'Rosa Lima Campos'
      )
      .replace('Carlos Andrés Pérez Rojas\n\nTipo', 'Carlos Andrés Pérez Rojas\n\nTipo');
    const r = parse(email({ ...F.BBVA_EMAIL_TRANSFER_PROPIA, text }));
    expect(r).toMatchObject({ type: 'gasto', ownAccount: false, merchant: 'Rosa Lima Campos' });
  });
});

describe('Yape', () => {
  it('notification: payment received is income', () => {
    expect(parse(push(F.YAPE_PUSH_RECIBIDO_1, new Date(2026, 9, 4, 3, 51)))).toMatchObject({
      bank: 'yape',
      kind: 'yape_recibido',
      type: 'ingreso',
      amount: 13.3,
      merchant: 'Rosa Lim',
    });
    expect(parse(push(F.YAPE_PUSH_RECIBIDO_2, new Date(2026, 9, 3, 23, 17)))).toMatchObject({
      amount: 20,
      merchant: 'Ana Torr',
    });
  });

  it('email: service paid', () => {
    expect(parse(email(F.YAPE_EMAIL_SERVICIO))).toMatchObject({
      kind: 'pago_servicio',
      type: 'gasto',
      amount: 52.9,
      merchant: 'Bitel',
      suggestedCategory: 'Servicios',
      date: '2025-06-27',
      time: '18:56',
      operationId: '01234567',
    });
  });

  it('email: yapeo sent', () => {
    expect(parse(email(F.YAPE_EMAIL_ENVIADO))).toMatchObject({
      kind: 'yape_enviado',
      type: 'gasto',
      amount: 20,
      merchant: 'Rosa Lima C.',
      date: '2026-08-24',
      time: '22:01',
      operationId: '7654321',
    });
  });
});

describe('privacy', () => {
  const all: BankMessage[] = [
    email(F.INTERBANK_EMAIL_RECURRENTE),
    email(F.BCP_EMAIL_CONSUMO_1),
    email(F.BBVA_EMAIL_TRANSFER_PROPIA),
    email(F.YAPE_EMAIL_SERVICIO),
    email(F.YAPE_EMAIL_ENVIADO),
    push(F.YAPE_PUSH_RECIBIDO_1, new Date(2026, 9, 4, 3, 51)),
    push(F.YAPE_PUSH_RECIBIDO_2, new Date(2026, 9, 3, 23, 17)),
  ];

  it('never extracts security codes, phones, service accounts, receipts or the user name', () => {
    const out = JSON.stringify(all.map(parseBankMessage));
    for (const secret of [
      '731',
      '289',
      '900000001',
      '9999888820250401',
      'XXXXXXXXX555',
      '*** *** 909',
      'CARLOS',
      'Carlos',
      'Pérez Rojas',
    ]) {
      expect(out).not.toContain(secret);
    }
  });

  it('ignores emails from untrusted senders (phishing)', () => {
    expect(bankForEmail('notificaciones@bcp-alertas.com')).toBeNull();
    expect(bankForEmail('BCP <notificaciones@notificacionesbcp.com.pe>')).toBe('bcp');
    expect(
      parseBankMessage(
        email({ ...F.BCP_EMAIL_CONSUMO_1, sender: 'notificaciones@bcp-alertas.com' })
      )
    ).toBeNull();
  });

  it('ignores unrelated text', () => {
    expect(
      parseBankMessage({ source: 'text', text: 'Hola, ¿nos vemos mañana?', receivedAt: new Date() })
    ).toBeNull();
  });
});

describe('duplicates', () => {
  it('merges the two Interbank notifications of the same purchase', () => {
    const a = parse(push(F.IB_PUSH_CONSUMO_YOPO, new Date(2026, 9, 4, 17, 21)));
    const b = parse(push(F.IB_PUSH_PAGO_YOPO, new Date(2026, 9, 4, 17, 20)));
    expect(isLikelyDuplicate(a, b)).toBe(true);
    const c = parse(push(F.IB_PUSH_CONSUMO_OCORIS, new Date(2026, 9, 4, 6, 15)));
    const d = parse(push(F.IB_PUSH_PAGO_OCORIS, new Date(2026, 9, 4, 6, 15)));
    expect(isLikelyDuplicate(c, d)).toBe(true);
    expect(isLikelyDuplicate(a, c)).toBe(false);
  });

  it('merges a notification with the email of the same charge', () => {
    const p = parse(push(F.IB_PUSH_RECURRENTE_2, new Date(2026, 9, 5, 14, 48)));
    const e = parse(email(F.INTERBANK_EMAIL_RECURRENTE));
    expect(isLikelyDuplicate(p, e)).toBe(true);
  });

  it('keeps two different purchases of the same amount apart', () => {
    const a = parse(push(F.IB_PUSH_CONSUMO_YOPO, new Date(2026, 9, 4, 17, 21)));
    const later = parse(push(F.IB_PUSH_CONSUMO_YOPO, new Date(2026, 9, 4, 20, 0)));
    expect(isLikelyDuplicate(a, later)).toBe(false);
  });

  it('same operation number means the same movement', () => {
    const a = parse(email(F.BCP_EMAIL_CONSUMO_1));
    const b = parse(email(F.BCP_EMAIL_CONSUMO_2));
    expect(isLikelyDuplicate(a, a)).toBe(true);
    expect(isLikelyDuplicate(a, b)).toBe(false);
  });
});
