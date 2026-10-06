import { describe, expect, it } from 'vitest';
import { parseBankMessage } from '@/lib/auto';
import { parseFreeText } from '@/lib/auto/freeText';

const now = new Date(2026, 9, 6, 12, 30);
const p = (t: string) => parseFreeText(t, now);

describe('free text (escritura rápida)', () => {
  it('gasto with concept and category', () => {
    expect(p('gasté 25 en taxi')).toMatchObject({
      bank: 'otro',
      kind: 'texto',
      type: 'gasto',
      amount: 25,
      currency: 'PEN',
      merchant: 'Taxi',
      suggestedCategory: 'Transporte',
      date: '2026-10-06',
      time: '12:30',
    });
    expect(p('pagué 120 de luz')).toMatchObject({
      amount: 120,
      merchant: 'Luz',
      suggestedCategory: 'Servicios',
    });
  });

  it('bank named in the text', () => {
    expect(p('almuerzo 18 bcp')).toMatchObject({
      bank: 'bcp',
      amount: 18,
      merchant: 'Almuerzo',
      suggestedCategory: 'Comida',
    });
    expect(p('yapeé 15 a Juan')).toMatchObject({ bank: 'yape', amount: 15, merchant: 'Juan' });
  });

  it('income', () => {
    expect(p('me pagaron 1500 de sueldo')).toMatchObject({
      type: 'ingreso',
      amount: 1500,
      merchant: 'Sueldo',
      suggestedCategory: 'Ingreso',
    });
    expect(p('cobré S/ 200 por diseño')).toMatchObject({
      type: 'ingreso',
      amount: 200,
      merchant: 'Diseño',
    });
  });

  it('amount formats', () => {
    expect(p('taxi 12,50')).toMatchObject({ amount: 12.5 });
    expect(p('S/25 menú')).toMatchObject({
      amount: 25,
      merchant: 'Menú',
      suggestedCategory: 'Comida',
    });
    expect(p('30 soles gasolina')).toMatchObject({ amount: 30, merchant: 'Gasolina' });
    expect(p('$10 netflix')).toMatchObject({ amount: 10, currency: 'USD', merchant: 'Netflix' });
    expect(p('15 dólares spotify')).toMatchObject({
      amount: 15,
      currency: 'USD',
      merchant: 'Spotify',
    });
  });

  it('dates: ayer, anteayer, dd/mm', () => {
    expect(p('Wong 92.50 ayer')).toMatchObject({
      amount: 92.5,
      merchant: 'Wong',
      suggestedCategory: 'Supermercado',
      date: '2026-10-05',
      time: null,
    });
    expect(p('cena 60 anteayer')).toMatchObject({ date: '2026-10-04' });
    expect(p('farmacia 35 el 02/10')).toMatchObject({
      amount: 35,
      date: '2026-10-02',
      suggestedCategory: 'Salud',
    });
  });

  it('without a concept uses a generic name', () => {
    expect(p('gasté 40')).toMatchObject({ amount: 40, merchant: 'Gasto' });
  });

  it('rejects text without an amount', () => {
    expect(p('hola, nos vemos mañana')).toBeNull();
    expect(p('nos vemos a las 5:30')).toBeNull();
  });

  it('bank notices still win over free text', () => {
    expect(
      parseBankMessage({
        source: 'text',
        text: 'Realizaste un consumo de S/21 en yopo',
        receivedAt: now,
      })
    ).toMatchObject({ bank: 'interbank', kind: 'consumo' });
    expect(
      parseBankMessage({ source: 'text', text: 'gasté 25 en taxi', receivedAt: now })
    ).toMatchObject({
      kind: 'texto',
    });
  });

  it('only for typed text, never for emails or notifications', () => {
    expect(
      parseBankMessage({
        source: 'notification',
        sender: 'WhatsApp',
        text: 'gasté 25 en taxi',
        receivedAt: now,
      })
    ).toBeNull();
  });
});
