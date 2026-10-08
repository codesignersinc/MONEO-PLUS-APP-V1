import { describe, expect, it } from 'vitest';
import { parseBusinessText, receiptNumber, sameName } from '@/lib/businessText';

describe('parseBusinessText', () => {
  it('income from a customer', () => {
    expect(parseBusinessText('Vega me pagó 5,000')).toEqual({
      kind: 'ingreso',
      amount: 5000,
      party: 'Vega',
      concept: null,
    });
    expect(parseBusinessText('Amazonian Gin pagó S/ 800 por el diseño')).toMatchObject({
      kind: 'ingreso',
      amount: 800,
      party: 'Amazonian Gin',
      concept: 'Diseño',
    });
    expect(parseBusinessText('Cobré 1.200,50 a Palais Rooftop')).toMatchObject({
      kind: 'ingreso',
      amount: 1200.5,
      party: 'Palais Rooftop',
    });
  });

  it('sales without a customer', () => {
    expect(parseBusinessText('Vendí 850 soles hoy')).toEqual({
      kind: 'ingreso',
      amount: 850,
      party: null,
      concept: null,
    });
    expect(parseBusinessText('vendi 5 mil')).toMatchObject({ kind: 'ingreso', amount: 5000 });
  });

  it('expenses to a supplier', () => {
    expect(parseBusinessText('Pagué 850 al proveedor Makro')).toMatchObject({
      kind: 'gasto',
      amount: 850,
      party: 'Makro',
    });
    expect(parseBusinessText('pague 600 a Makro')).toMatchObject({ party: 'Makro', amount: 600 });
    expect(parseBusinessText('Compré 482.50 en Makro')).toMatchObject({
      kind: 'gasto',
      amount: 482.5,
      party: 'Makro',
    });
  });

  it('a spending concept is not a supplier', () => {
    expect(parseBusinessText('Gasté 50 en insumos')).toEqual({
      kind: 'gasto',
      amount: 50,
      party: null,
      concept: 'Insumos',
    });
  });

  it('returns null when it does not understand', () => {
    expect(parseBusinessText('')).toBeNull();
    expect(parseBusinessText('hola')).toBeNull();
    expect(parseBusinessText('Vega 5000')).toBeNull();
    expect(parseBusinessText('Pagué a Makro')).toBeNull();
  });
});

describe('helpers', () => {
  it('compares names without case or accents', () => {
    expect(sameName('Vega', ' vega ')).toBe(true);
    expect(sameName('Ñandú Café', 'ñandu cafe')).toBe(true);
    expect(sameName('Vega', 'Vegas')).toBe(false);
  });
  it('reads the receipt number', () => {
    expect(receiptNumber('FACTURA ELECTRONICA\nF001 - 00003256\nTOTAL 482.50')).toBe('F001-3256');
    expect(receiptNumber('BOLETA B001-123')).toBe('B001-123');
    expect(receiptNumber('TOTAL 20.00')).toBeNull();
  });
});
