import { describe, expect, it } from 'vitest';
import {
  guessCategory,
  matchPerson,
  parseAmount,
  parseCsv,
  parseFrequency,
  readSheet,
  summarize,
} from '@/lib/householdImport';
import type { HouseholdMember } from '@/lib/household';

const m = (id: string, displayName: string): HouseholdMember => ({
  id,
  userId: id,
  displayName,
  role: 'member',
  status: 'active',
  declaredIncome: null,
  customPct: null,
  joinedAt: '2026-10-01',
});
const members = [m('f', 'Félix'), m('s', 'Sophia')];

describe('values', () => {
  it('amounts in Peruvian and European formats', () => {
    expect(parseAmount('S/ 2,600.00')).toBe(2600);
    expect(parseAmount('2.600,50')).toBe(2600.5);
    expect(parseAmount('26,50')).toBe(26.5);
    expect(parseAmount('S/.70')).toBe(70);
    expect(parseAmount(1250)).toBe(1250);
    expect(parseAmount('1.250.000')).toBe(1250000);
    expect(parseAmount('Internet')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });

  it('frequency, category and person', () => {
    expect(parseFrequency('Mensual')).toBe('monthly');
    expect(parseFrequency('Anual')).toBe('yearly');
    expect(parseFrequency('único')).toBeNull();
    expect(parseFrequency('')).toBeUndefined();
    expect(guessCategory('', 'Alquiler casa')).toBe('Vivienda');
    expect(guessCategory('Alimentación', 'x')).toBe('Supermercado');
    expect(guessCategory('', 'Gasolina Mazda')).toBe('Transporte');
    expect(guessCategory('', 'Nana')).toBe('Hijos');
    expect(guessCategory('', 'Seguro auto')).toBe('Seguros');
    expect(guessCategory('', 'Algo raro')).toBe('Otros');
    expect(matchPerson('felix', members)).toBe('f');
    expect(matchPerson('Sophia R.', members)).toBe('s');
    expect(matchPerson('Ambos', members)).toBe('shared');
    expect(matchPerson('Pedro', members)).toBeNull();
  });
});

describe('readSheet', () => {
  it('one row per expense (brief example)', () => {
    const rows = readSheet(
      [
        ['Presupuesto del hogar 2026'],
        ['Persona', 'Descripción', 'Categoría', 'Monto', 'Periodicidad'],
        ['Félix', 'Alquiler casa', 'Vivienda', 'S/ 2,600.00', 'Mensual'],
        ['Sophia', 'Internet', '', '70', 'Mensual'],
        ['Ambos', 'Seguro auto', 'Seguros', 1200, 'Anual'],
        ['', 'TOTAL', '', 3870, ''],
      ],
      members
    );
    expect(rows.map((r) => [r.person, r.description, r.category, r.amount, r.frequency])).toEqual([
      ['f', 'Alquiler casa', 'Vivienda', 2600, 'monthly'],
      ['s', 'Internet', 'Servicios', 70, 'monthly'],
      ['shared', 'Seguro auto', 'Seguros', 1200, 'yearly'],
    ]);
    const s = summarize(rows, members);
    expect(s.count).toBe(3);
    expect(s.monthlyCount).toBe(2);
    expect(s.total).toBe(2770);
    expect(s.byPerson).toEqual([
      { person: 'f', label: 'Félix', total: 2600 },
      { person: 's', label: 'Sophia', total: 70 },
      { person: 'shared', label: 'Ambos', total: 100 },
    ]);
  });

  it('one column per person', () => {
    const rows = readSheet(
      [
        ['Concepto', 'Félix', 'Sophia'],
        ['Alquiler', 2600, ''],
        ['Compras súper', 1000, 650],
        ['Total', 3600, 650],
      ],
      members
    );
    expect(rows.map((r) => [r.person, r.description, r.amount])).toEqual([
      ['f', 'Alquiler', 2600],
      ['f', 'Compras súper', 1000],
      ['s', 'Compras súper', 650],
    ]);
  });

  it('CSV with semicolons and no known person', () => {
    const rows = readSheet(
      parseCsv('﻿Concepto;Monto;Quién\n"Luz; agua";"S/ 120,50";Pedro\nNetflix;44.90;ambos\n'),
      members
    );
    expect(rows.map((r) => [r.description, r.amount, r.person, r.personLabel])).toEqual([
      ['Luz; agua', 120.5, null, 'Pedro'],
      ['Netflix', 44.9, 'shared', 'ambos'],
    ]);
  });

  it('without header: first text and the last number', () => {
    const rows = readSheet([['Gasolina', 'x', 450]], members);
    expect(rows.map((r) => [r.description, r.amount, r.category])).toEqual([
      ['Gasolina', 450, 'Transporte'],
    ]);
  });
});
