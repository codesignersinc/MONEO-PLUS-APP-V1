import { describe, expect, it } from 'vitest';
import { normalizeAmountExpression, normalizeNumberToken, parseAmountInput } from '@/lib/amount';

describe('normalizeNumberToken', () => {
  it('reads a comma followed by 3 digits as thousands', () => {
    expect(normalizeNumberToken('1,250')).toBe('1250');
    expect(normalizeNumberToken('12,500,000')).toBe('12500000');
  });
  it('reads a comma with 1–2 digits as decimal', () => {
    expect(normalizeNumberToken('12,5')).toBe('12.5');
    expect(normalizeNumberToken('12,50')).toBe('12.50');
  });
  it('uses the last separator as decimal when both appear', () => {
    expect(normalizeNumberToken('1,250.50')).toBe('1250.50');
    expect(normalizeNumberToken('1.250,50')).toBe('1250.50');
  });
  it('keeps a single dot as decimal and reads 1.250.000 as thousands', () => {
    expect(normalizeNumberToken('12.50')).toBe('12.50');
    expect(normalizeNumberToken('1.250.000')).toBe('1250000');
  });
});

describe('normalizeAmountExpression', () => {
  it('normalizes every number of a calculator expression', () => {
    expect(normalizeAmountExpression('1,250 + 12,50')).toBe('1250+12.50');
    expect(normalizeAmountExpression('(2,000-150)*2')).toBe('(2000-150)*2');
  });
});

describe('parseAmountInput', () => {
  it('parses typed amounts', () => {
    expect(parseAmountInput('1,250')).toBe(1250);
    expect(parseAmountInput(' 3,450.90 ')).toBe(3450.9);
    expect(parseAmountInput('49,90')).toBe(49.9);
    expect(parseAmountInput('')).toBeNaN();
    expect(parseAmountInput('abc')).toBeNaN();
  });
});
