'use client';
import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, Calculator, CalendarDays, ChevronDown, FileText, X } from 'lucide-react';
import BrandLogo from '@/components/finance/BrandLogo';
import { formatCurrency } from '@/lib/currency';
import type { Account } from '@/lib/financeStore';

// Building blocks of the quick-add forms (MONEO 3D retro pop): tall fields with thick black
// borders, dark text, an icon slot, pastel category chips and a yellow call to action.
// 16px text so iOS does not zoom into the field.

export const FIELD =
  'h-14 w-full rounded-2xl border-[3px] border-[#111] bg-white px-4 text-[16px] font-bold text-[#111] outline-none transition-shadow placeholder:font-semibold placeholder:text-gray-400 focus:shadow-[0_0_0_3px_#FFD83D]';
export const LABEL = 'mb-2 block text-[13px] font-black uppercase tracking-wide text-gray-600';

export function Field({
  label,
  aside,
  children,
}: {
  label: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={LABEL}>{label}</span>
        {aside && <span className="mb-2 text-[13px] font-bold text-gray-600">{aside}</span>}
      </div>
      {children}
    </div>
  );
}

// Yellow (or accent) header card with an illustration and the coins.
export function FormHero({
  title,
  subtitle,
  emoji,
  tone,
}: {
  title: string;
  subtitle: string;
  emoji: string;
  tone: string;
}) {
  return (
    <div
      className="relative mb-6 flex min-h-[112px] items-center gap-3 overflow-hidden rounded-[22px] border-[3px] border-[#111] py-3 pl-4 pr-24 shadow-[0_4px_0_#111]"
      style={{ background: tone }}
    >
      <span className="grid h-16 w-14 shrink-0 -rotate-6 place-items-center rounded-2xl border-[3px] border-[#111] bg-white text-3xl shadow-[2px_2px_0_#111]">
        {emoji}
      </span>
      <div className="min-w-0">
        <h3 className="whitespace-nowrap text-[22px] font-black leading-tight text-[#111]">
          {title}
        </h3>
        <p className="mt-0.5 text-[13px] font-semibold leading-snug text-[#111]/80">{subtitle}</p>
      </div>
      <Image
        src="/assets/images/home/monedas-patrimonio.webp"
        alt=""
        width={150}
        height={100}
        className="pointer-events-none absolute -bottom-3 -right-5 w-[108px] select-none"
      />
    </div>
  );
}

// Native select (keyboard and screen readers) dressed with the bank logo and a chevron.
export function AccountSelect({
  accounts,
  value,
  onChange,
  label = 'Cuenta',
}: {
  accounts: Account[] | null;
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const acc = accounts?.find((a) => a.id === value);
  if (accounts && accounts.length === 0) {
    return (
      <Field label={label}>
        <p className="rounded-2xl border-[3px] border-dashed border-[#111] bg-[#FFF4CC] p-3 text-sm font-bold text-[#111]">
          Primero agrega una cuenta en la sección Cuentas.
        </p>
      </Field>
    );
  }
  return (
    <Field
      label={label}
      aside={acc ? `Saldo: ${formatCurrency(acc.balance, acc.currency || 'PEN')}` : undefined}
    >
      <div className="relative">
        {acc && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            <BrandLogo
              kind="account"
              name={acc.name}
              institution={acc.institution}
              type={acc.type}
              size="sm"
            />
          </span>
        )}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={!accounts}
          aria-label={label}
          className={`${FIELD} appearance-none pr-12 ${acc ? 'pl-[60px]' : ''} ${value ? '' : 'text-gray-400'}`}
        >
          <option value="">{accounts ? 'Elige la cuenta' : 'Cargando cuentas…'}</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency || 'PEN'})
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#111]" />
      </div>
    </Field>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: string;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-2.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl bg-[#FFE1DB] text-xl">
            {icon}
          </span>
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${FIELD} ${icon ? 'pl-14' : ''} ${value ? 'pr-12' : ''}`}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={`Borrar ${label.toLowerCase()}`}
            className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-gray-200 text-[#111]"
          >
            <X className="h-4 w-4" strokeWidth={3} />
          </button>
        )}
      </div>
    </Field>
  );
}

// "12+8.50" → 20.5. Only digits, spaces, + - * / ( ) and the decimal point; null otherwise.
export function evalAmount(expr: string): number | null {
  const s = expr.replace(/,/g, '.').replace(/\s+/g, '');
  if (!s || !/^[\d.+\-*/()]+$/.test(s)) return null;
  let i = 0;
  const num = (): number => {
    if (s[i] === '(') {
      i++;
      const v = add();
      if (s[i] !== ')') throw new Error('paren');
      i++;
      return v;
    }
    if (s[i] === '-') {
      i++;
      return -num();
    }
    const m = /^\d*\.?\d+|^\d+\./.exec(s.slice(i));
    if (!m) throw new Error('num');
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const mul = (): number => {
    let v = num();
    while (s[i] === '*' || s[i] === '/') {
      const op = s[i++];
      const r = num();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const add = (): number => {
    let v = mul();
    while (s[i] === '+' || s[i] === '-') {
      const op = s[i++];
      const r = mul();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  try {
    const v = add();
    if (i !== s.length || !isFinite(v)) return null;
    return Math.round(v * 100) / 100;
  } catch {
    return null;
  }
}

// Amount with the currency prefix and a calculator mode ("12+8+4.50" → 24.50).
export function AmountField({
  label,
  value,
  onChange,
  currency = 'S/',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  currency?: string;
}) {
  const [calc, setCalc] = useState(false);
  const [expr, setExpr] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const result = calc ? evalAmount(expr) : null;
  const apply = () => {
    if (result !== null && result > 0) onChange(String(result));
    setCalc(false);
  };
  return (
    <Field label={label}>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] font-black text-[#111]">
          {currency}
        </span>
        <input
          ref={ref}
          type={calc ? 'text' : 'number'}
          inputMode={calc ? 'text' : 'decimal'}
          step="0.01"
          min="0"
          value={calc ? expr : value}
          onChange={(e) => (calc ? setExpr(e.target.value) : onChange(e.target.value))}
          onBlur={() => calc && apply()}
          onKeyDown={(e) => {
            if (calc && e.key === 'Enter') {
              e.preventDefault();
              apply();
            }
          }}
          placeholder={calc ? '12+8.50' : '0.00'}
          className={`${FIELD} pl-11 pr-14`}
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (calc) return apply();
            setExpr(value);
            setCalc(true);
            setTimeout(() => ref.current?.focus(), 0);
          }}
          aria-label={calc ? 'Usar el resultado' : 'Calcular el monto'}
          aria-pressed={calc}
          className={`absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl border-l-2 border-gray-200 ${calc ? 'bg-[#FFD83D]' : 'bg-white'}`}
        >
          <Calculator className="h-5 w-5 text-[#111]" />
        </button>
      </div>
      {calc && (
        <p className="mt-1 text-xs font-bold text-gray-600">
          {result !== null
            ? `= ${currency} ${result.toFixed(2)} · Enter para usarlo`
            : 'Escribe una suma, ej. 12+8.50'}
        </p>
      )}
    </Field>
  );
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

export function fmtShortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// Native date picker under a readable label ("6 oct 2026") with a calendar icon.
export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Elegir fecha',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <label className="relative block">
        <span
          className={`${FIELD} flex items-center gap-2 px-3.5 ${value ? '' : 'text-gray-400'}`}
          aria-hidden
        >
          <CalendarDays className="h-5 w-5 shrink-0 text-[#111]" />
          <span className="truncate">{value ? fmtShortDate(value) : placeholder}</span>
        </span>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </Field>
  );
}

const CHIP_TONES = [
  '#FFE1DB',
  '#E0EDFF',
  '#FDE2E7',
  '#EDE7FF',
  '#E0EDFF',
  '#DDF7E9',
  '#E0F4FF',
  '#F3E8FF',
  '#FFF1DC',
];

export function CategoryChips({
  categories,
  value,
  onChange,
  label = 'Categoría',
  initial = 9,
}: {
  categories: { label: string; icon: string }[];
  value: string;
  onChange: (label: string) => void;
  label?: string;
  initial?: number;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? categories : categories.slice(0, initial);
  const more = categories.length > initial;
  return (
    <Field
      label={label}
      aside={
        more ? (
          <button
            type="button"
            onClick={() => setAll((a) => !a)}
            className="font-black text-[#2563EB]"
          >
            {all ? 'Ver menos' : 'Ver todas →'}
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-wrap gap-2">
        {shown.map((c, i) => {
          const on = c.label === value;
          return (
            <button
              key={c.label}
              type="button"
              onClick={() => onChange(c.label)}
              aria-pressed={on}
              className={`flex min-h-[46px] items-center gap-2 rounded-2xl border-2 px-3.5 text-[15px] font-black text-[#111] transition-transform active:scale-95 ${on ? 'border-[#111] bg-[#FFD83D] shadow-[0_3px_0_#111]' : 'border-transparent'}`}
              style={on ? undefined : { background: CHIP_TONES[i % CHIP_TONES.length] }}
            >
              <span className="text-xl leading-none">{c.icon}</span>
              {c.label}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function NotesField({
  value,
  onChange,
  label = 'Notas (opcional)',
  placeholder = 'Agrega una nota…',
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <FileText className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#111]" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${FIELD} pl-12`}
        />
      </div>
    </Field>
  );
}

export function SubmitButton({
  children,
  onClick,
  disabled,
  tone = '#FFD83D',
  dark,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: string;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-16 w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] text-[19px] font-black shadow-[0_5px_0_#111] transition-transform active:translate-y-1 active:shadow-[0_1px_0_#111] disabled:opacity-60 ${dark ? 'text-white' : 'text-[#111]'}`}
      style={{ background: tone }}
    >
      {children}
      <ArrowRight className="h-6 w-6" strokeWidth={2.6} />
    </button>
  );
}
