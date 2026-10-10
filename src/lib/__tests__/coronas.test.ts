import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, awardLabel, awardsMessage, LEVELS, levelFor, streakText } from '../coronas';

describe('levelFor', () => {
  it('starts at level 1', () => {
    const p = levelFor(0);
    expect(p.current.level).toBe(1);
    expect(p.next?.level).toBe(2);
    expect(p.progress).toBe(0);
    expect(p.missing).toBe(20);
  });

  it('moves up exactly at the threshold', () => {
    expect(levelFor(19).current.level).toBe(1);
    expect(levelFor(20).current.level).toBe(2);
    expect(levelFor(40).progress).toBeCloseTo(0.5);
  });

  it('stops at the last level', () => {
    const last = LEVELS[LEVELS.length - 1];
    const p = levelFor(last.from + 1000);
    expect(p.current).toBe(last);
    expect(p.next).toBeNull();
    expect(p.progress).toBe(1);
    expect(p.missing).toBe(0);
  });

  it('ignores negatives and decimals', () => {
    expect(levelFor(-5).current.level).toBe(1);
    expect(levelFor(19.9).current.level).toBe(1);
  });
});

describe('awardsMessage', () => {
  it('is null without awards', () => {
    expect(awardsMessage([])).toBeNull();
  });

  it('describes a single award', () => {
    expect(awardsMessage([{ rule: 'registro_dia', key: 'registro:2026-10-10', amount: 1 }])).toBe(
      '+1 Corona · Registraste tus movimientos del día'
    );
  });

  it('adds up several awards and highlights achievements', () => {
    expect(
      awardsMessage([
        { rule: 'registro_dia', key: 'registro:2026-10-10', amount: 1 },
        { rule: 'logro', key: 'logro:primer_registro', amount: 3 },
      ])
    ).toBe('+4 Coronas · Desbloqueaste un logro');
  });
});

describe('awardLabel', () => {
  it('names achievements', () => {
    expect(awardLabel('logro', 'logro:racha_7')).toBe('Logro: Una semana');
    expect(awardLabel('logro', 'logro:otro')).toBe('Desbloqueaste un logro');
    expect(awardLabel('pago_a_tiempo', 'pago:x')).toBe('Pagaste a tiempo');
  });
});

describe('catalog', () => {
  it('has unique achievement codes', () => {
    const codes = ACHIEVEMENTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('pluralizes the streak', () => {
    expect(streakText(1)).toBe('1 día');
    expect(streakText(7)).toBe('7 días');
  });
});
