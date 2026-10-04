import { describe, expect, it } from 'vitest';
import { countsAsTransfer } from '@/lib/financeStore';

describe('countsAsTransfer', () => {
  it('counts a transfer once, by its outgoing leg', () => {
    expect(countsAsTransfer({ type: 'transferencia', transferLeg: 'out' })).toBe(true);
    expect(countsAsTransfer({ type: 'transferencia', transferLeg: 'in' })).toBe(false);
  });

  it('counts legacy single-row transfers', () => {
    expect(countsAsTransfer({ type: 'transferencia' })).toBe(true);
  });

  it('ignores expenses and income', () => {
    expect(countsAsTransfer({ type: 'gasto' })).toBe(false);
    expect(countsAsTransfer({ type: 'ingreso' })).toBe(false);
  });
});
