'use client';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import { getErrorMessage } from '@/lib/dataError';
import { notifyDataChanged } from '@/lib/dataSync';
import { parseAmountInput } from '@/lib/amount';
import { todayLocal } from '@/lib/dates';
import { BUSINESS_EXPENSE_CATEGORIES, BUSINESS_INCOME_CATEGORIES } from '@/lib/business';
import {
  bizObligationsService,
  businessService,
  partiesService,
  type BizObligation,
  type Party,
  type PartyKind,
} from '@/lib/supabaseBusiness';
import { userSettingsService } from '@/lib/supabaseCurrency';
import type { Account } from '@/lib/financeStore';
import Glyph from '@/components/ui/Glyph';

// Shared pieces of MONEO NEGOCIO (fase 3): sheet frame, contact field, settle dialog and the
// payment / collection form.

export const field =
  'w-full rounded-xl border-2 border-[#111] bg-white px-3 py-2.5 text-sm font-semibold text-[#111] outline-none focus-visible:ring-2 focus-visible:ring-[#75B8FF]';
export const label = 'mb-1 block text-xs font-black uppercase tracking-wide text-[#111]/70';

export const KIND_LABEL: Record<PartyKind, string> = {
  proveedor: 'Proveedor',
  cliente: 'Cliente',
  empleado: 'Empleado',
};

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="paper-opaque sheet-max w-full max-w-lg overflow-y-auto rounded-t-3xl border-2 border-[#111] bg-[#FFF9EC] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-[#111] sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-[#111] bg-white"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Initials avatar (no photos or third-party logos). */
export function Initials({ name, color = '#B99CFF' }: { name: string; color?: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <span
      aria-hidden
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-[#111] text-sm font-black text-[#111]"
      style={{ backgroundColor: color }}
    >
      {letters || '?'}
    </span>
  );
}

/** Name of a customer / supplier: pick a known one or type a new one (created on save). */
export function PartyField({
  kind,
  parties,
  value,
  onChange,
  optional = true,
}: {
  kind: PartyKind;
  parties: Party[];
  value: string;
  onChange: (name: string) => void;
  optional?: boolean;
}) {
  const options = parties.filter((p) => p.kind === kind && p.active);
  const q = value.trim().toLowerCase();
  const matches = q
    ? options.filter((p) => p.name.toLowerCase().includes(q) && p.name.toLowerCase() !== q)
    : options;
  return (
    <div>
      <label className="block">
        <span className={label}>
          {KIND_LABEL[kind]}
          {optional ? ' (opcional)' : ''}
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            kind === 'cliente' ? 'Ej. Vega' : kind === 'proveedor' ? 'Ej. Makro' : 'Nombre'
          }
          className={field}
        />
      </label>
      {matches.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {matches.slice(0, 6).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.name)}
              className="rounded-full border-2 border-[#111] bg-white px-2.5 py-1 text-xs font-bold"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      {q && !options.some((p) => p.name.toLowerCase() === q) && (
        <p className="mt-1 text-[11px] font-semibold text-[#111]/60">
          Se agregará «{value.trim()}» como {KIND_LABEL[kind].toLowerCase()}.
        </p>
      )}
    </div>
  );
}

/** Mark a payment as paid / a collection as collected, choosing the business account. */
export function SettleSheet({
  businessId,
  obligation,
  onClose,
  onDone,
}: {
  businessId: string;
  obligation: BizObligation;
  onClose: () => void;
  onDone: () => void;
}) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [accountId, setAccountId] = useState('');
  const [base, setBase] = useState('PEN');
  const [accAmount, setAccAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([businessService.accounts(businessId), userSettingsService.get()])
      .then(([a, s]) => {
        setAccounts(a);
        setAccountId(a[0]?.id ?? '');
        setBase(s.baseCurrencyCode);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [businessId]);

  const account = accounts?.find((a) => a.id === accountId);
  const otherCurrency = !!account && account.currency !== base;
  const paying = obligation.type === 'pago';

  const confirm = async () => {
    if (!account) return setError('Agrega primero una cuenta del negocio.');
    let amountInAccount: number | undefined;
    if (otherCurrency) {
      amountInAccount = parseAmountInput(accAmount);
      if (!(amountInAccount > 0)) return setError(`Indica el monto en ${account.currency}.`);
    }
    setSaving(true);
    setError('');
    try {
      await bizObligationsService.settle(obligation, account.id, amountInAccount);
      notifyDataChanged();
      onDone();
    } catch (e) {
      setError(getErrorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Sheet title={paying ? 'Marcar como pagado' : 'Marcar como cobrado'} onClose={onClose}>
      <div className="mb-4 rounded-2xl border-2 border-[#111] bg-white p-4">
        <p className="text-sm font-bold">{obligation.name}</p>
        <p className="text-2xl font-black tabular-nums">{formatMoney(obligation.amount, base)}</p>
      </div>
      {accounts && accounts.length === 0 ? (
        <p className="rounded-xl bg-[#FFF3C4] px-3 py-3 text-sm font-bold">
          Agrega primero la cuenta de tu negocio en «Cuentas».
        </p>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className={label}>{paying ? 'Pagado desde' : 'Cobrado en'}</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={field}
            >
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatMoney(a.balance, a.currency)})
                </option>
              ))}
            </select>
          </label>
          {otherCurrency && (
            <label className="block">
              <span className={label}>Monto en {account!.currency}</span>
              <input
                inputMode="decimal"
                value={accAmount}
                onChange={(e) => setAccAmount(e.target.value)}
                className={field}
              />
            </label>
          )}
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]"
        >
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={confirm}
        disabled={saving || !account}
        className="paper-opaque mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] py-3.5 text-base font-black shadow-[0_4px_0_#111] disabled:opacity-60"
      >
        {saving && <Loader2 className="h-5 w-5 animate-spin" />}
        {paying ? 'Confirmar pago' : 'Confirmar cobro'}
      </button>
    </Sheet>
  );
}

/** New payment to make (pago) or collection to receive (cobro) of the business. */
export function ObligationSheet({
  businessId,
  type,
  parties,
  presetParty = '',
  onClose,
  onSaved,
}: {
  businessId: string;
  type: 'pago' | 'cobro';
  parties: Party[];
  presetParty?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const categories = type === 'pago' ? BUSINESS_EXPENSE_CATEGORIES : BUSINESS_INCOME_CATEGORIES;
  const [party, setParty] = useState(presetParty);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState(todayLocal());
  const [category, setCategory] = useState(categories[0].label);
  const [monthly, setMonthly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const value = useMemo(() => parseAmountInput(amount), [amount]);

  const save = async () => {
    setError('');
    if (!(value > 0)) return setError('Escribe un monto mayor que cero.');
    if (!name.trim() && !party.trim()) return setError('Escribe un concepto o a quién.');
    setSaving(true);
    try {
      const p = party.trim()
        ? await partiesService.ensure(
            businessId,
            type === 'pago' ? 'proveedor' : 'cliente',
            party,
            parties
          )
        : null;
      const cat = categories.find((c) => c.label === category) ?? categories[0];
      await bizObligationsService.create(businessId, {
        type,
        name: name.trim() || p!.name,
        amount: value,
        category: cat.label,
        icon: cat.icon,
        due,
        partyId: p?.id ?? null,
        recurringDay: type === 'pago' && monthly ? Number(due.slice(8, 10)) : null,
      });
      notifyDataChanged();
      onSaved();
    } catch (e) {
      setError(getErrorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Sheet
      title={type === 'pago' ? 'Nuevo pago por hacer' : 'Nuevo cobro por recibir'}
      onClose={onClose}
    >
      <div className="space-y-3">
        <PartyField
          kind={type === 'pago' ? 'proveedor' : 'cliente'}
          parties={parties}
          value={party}
          onChange={setParty}
        />
        <label className="block">
          <span className={label}>Concepto</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === 'pago' ? 'Ej. Mercadería de octubre' : 'Ej. Proyecto web'}
            className={field}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={label}>Monto</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`${field} text-lg font-black`}
            />
          </label>
          <label className="block">
            <span className={label}>Vence</span>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className={field}
            />
          </label>
        </div>
        <div>
          <span className={label}>Categoría</span>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c.label}
                type="button"
                aria-pressed={category === c.label}
                onClick={() => setCategory(c.label)}
                className={`flex items-center gap-1.5 rounded-xl border-2 border-[#111] px-2.5 py-1.5 text-xs font-bold ${
                  category === c.label ? 'paper-opaque bg-[#FFD83D]' : 'bg-white'
                }`}
              >
                <Glyph name={c.icon} className="h-4 w-4" /> {c.label}
              </button>
            ))}
          </div>
        </div>
        {type === 'pago' && (
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={monthly}
              onChange={(e) => setMonthly(e.target.checked)}
            />
            Se repite cada mes
          </label>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]"
        >
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="paper-opaque mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] py-3.5 text-base font-black shadow-[0_4px_0_#111] disabled:opacity-60"
      >
        {saving && <Loader2 className="h-5 w-5 animate-spin" />}
        Guardar
      </button>
    </Sheet>
  );
}
