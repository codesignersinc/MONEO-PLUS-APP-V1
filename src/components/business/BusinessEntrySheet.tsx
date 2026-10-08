'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2, X } from 'lucide-react';
import Glyph from '@/components/ui/Glyph';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';
import { parseAmountInput } from '@/lib/amount';
import { buildCurrencyFields, buildTransferAmounts, getRateFromMap } from '@/lib/currency';
import { localDateTimeToISO, nowTimeLocal, todayLocal } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { notifyDataChanged } from '@/lib/dataSync';
import { BUSINESS_EXPENSE_CATEGORIES, BUSINESS_INCOME_CATEGORIES } from '@/lib/business';
import { businessService } from '@/lib/supabaseBusiness';
import { accountsService, transactionsService, transfersService } from '@/lib/supabaseFinance';
import { getFxContext } from '@/lib/supabaseCurrency';
import type { Account } from '@/lib/financeStore';

// Register a business movement: income, expense, or move money between the business and
// your personal accounts (owner withdrawal / contribution: a transfer, never income or
// expense). The account picks the context; the database enforces it.

export type BusinessEntryMode = 'ingreso' | 'gasto' | 'retiro' | 'aporte';

const TITLES: Record<BusinessEntryMode, string> = {
  ingreso: 'Nuevo ingreso del negocio',
  gasto: 'Nuevo gasto del negocio',
  retiro: 'Retiro del negocio',
  aporte: 'Aporte al negocio',
};

const field =
  'w-full rounded-xl border-2 border-[#111] bg-white px-3 py-2.5 text-sm font-semibold text-[#111] outline-none focus-visible:ring-2 focus-visible:ring-[#75B8FF]';
const label = 'mb-1 block text-xs font-black uppercase tracking-wide text-[#111]/70';

export default function BusinessEntrySheet({
  businessId,
  mode: initialMode,
  onClose,
  onSaved,
}: {
  businessId: string;
  mode: BusinessEntryMode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<BusinessEntryMode>(initialMode);
  const [bizAccounts, setBizAccounts] = useState<Account[] | null>(null);
  const [personal, setPersonal] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState('');
  const [personalId, setPersonalId] = useState('');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([businessService.accounts(businessId), accountsService.getAll()])
      .then(([b, p]) => {
        setBizAccounts(b);
        setPersonal(p);
        setAccountId((id) => id || b[0]?.id || '');
        setPersonalId((id) => id || p[0]?.id || '');
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [businessId]);

  const categories = mode === 'ingreso' ? BUSINESS_INCOME_CATEGORIES : BUSINESS_EXPENSE_CATEGORIES;
  useEffect(() => {
    setCategory(categories[0].label);
  }, [mode, categories]);

  const account = bizAccounts?.find((a) => a.id === accountId);
  const personalAccount = personal.find((a) => a.id === personalId);
  const isTransfer = mode === 'retiro' || mode === 'aporte';
  const value = useMemo(() => parseAmountInput(amount), [amount]);

  const save = async () => {
    setError('');
    if (!account) return setError('Agrega primero una cuenta del negocio.');
    if (!(value && value > 0)) return setError('Escribe un monto mayor que cero.');
    if (isTransfer && !personalAccount) return setError('Necesitas una cuenta personal.');
    if (!isTransfer && !name.trim()) return setError('Escribe una descripción.');
    setSaving(true);
    try {
      const fx = await getFxContext();
      if (isTransfer) {
        const from = mode === 'retiro' ? account : personalAccount!;
        const to = mode === 'retiro' ? personalAccount! : account;
        await transfersService.create({
          fromAccountId: from.id,
          toAccountId: to.id,
          ...buildTransferAmounts({
            fromAmount: value,
            fromCurrency: from.currency || 'PEN',
            toCurrency: to.currency || 'PEN',
            baseCurrency: fx.baseCurrency,
            ratesMap: fx.ratesMap,
          }),
          date: localDateTimeToISO(date, nowTimeLocal()),
          name: name.trim() || (mode === 'retiro' ? 'Retiro del negocio' : 'Aporte al negocio'),
          notes,
        });
      } else {
        const currency = account.currency || 'PEN';
        const signed = mode === 'gasto' ? -Math.abs(value) : Math.abs(value);
        const cat = categories.find((c) => c.label === category) ?? categories[0];
        await transactionsService.create({
          name: name.trim(),
          type: mode,
          amount: signed,
          category: cat.label,
          categoryIcon: cat.icon,
          accountId: account.id,
          account: account.name,
          notes,
          date: localDateTimeToISO(date, nowTimeLocal()),
          time: nowTimeLocal(),
          ...buildCurrencyFields({
            amount: signed,
            currency,
            baseCurrency: fx.baseCurrency,
            rateToBase: getRateFromMap(fx.ratesMap, currency, fx.baseCurrency),
            date,
          }),
        });
      }
      notifyDataChanged();
      toast.showSuccess('Guardado.');
      onSaved();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={TITLES[mode]}
        onClick={(e) => e.stopPropagation()}
        className="paper-opaque sheet-max w-full max-w-lg overflow-y-auto rounded-t-3xl border-2 border-[#111] bg-[#FFF9EC] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-[#111]">{TITLES[mode]}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#111] bg-white"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-4 gap-1 rounded-2xl border-2 border-[#111] bg-white p-1">
          {(['ingreso', 'gasto', 'retiro', 'aporte'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-xl px-1 py-2 text-[12px] font-black ${
                mode === m ? 'paper-opaque bg-[#111] text-white' : 'text-[#111]'
              }`}
            >
              {m === 'ingreso'
                ? 'Ingreso'
                : m === 'gasto'
                  ? 'Gasto'
                  : m === 'retiro'
                    ? 'Retiro'
                    : 'Aporte'}
            </button>
          ))}
        </div>

        {bizAccounts && bizAccounts.length === 0 ? (
          <p className="rounded-xl bg-[#FFF3C4] px-3 py-3 text-sm font-bold text-[#111]">
            Agrega primero la cuenta de tu negocio en «Cuentas».
          </p>
        ) : (
          <div className="space-y-3">
            {isTransfer && (
              <p className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#111]/80">
                {mode === 'retiro' ? (
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
                ) : (
                  <ArrowDownLeft className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
                )}
                {mode === 'retiro'
                  ? 'Pasa dinero del negocio a tu cuenta personal. No es un gasto del negocio ni un ingreso personal.'
                  : 'Pasa dinero de tu cuenta personal al negocio. No es un ingreso del negocio.'}
              </p>
            )}

            <label className="block">
              <span className={label}>Monto</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`${field} text-2xl font-black`}
              />
            </label>

            <label className="block">
              <span className={label}>{isTransfer ? 'Descripción (opcional)' : 'Descripción'}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  mode === 'ingreso'
                    ? 'Ej. Venta a Vega'
                    : mode === 'gasto'
                      ? 'Ej. Compra en Makro'
                      : ''
                }
                className={field}
              />
            </label>

            {!isTransfer && (
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
            )}

            <label className="block">
              <span className={label}>Cuenta del negocio</span>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className={field}
              >
                {(bizAccounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatMoney(a.balance, a.currency)})
                  </option>
                ))}
              </select>
            </label>

            {isTransfer && (
              <label className="block">
                <span className={label}>Tu cuenta personal</span>
                <select
                  value={personalId}
                  onChange={(e) => setPersonalId(e.target.value)}
                  className={field}
                >
                  {personal.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatMoney(a.balance, a.currency)})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className={label}>Fecha</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={field}
                />
              </label>
              <label className="block">
                <span className={label}>Nota (opcional)</span>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
              </label>
            </div>
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
          onClick={save}
          disabled={saving || !bizAccounts || bizAccounts.length === 0}
          className="paper-opaque mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] py-3.5 text-base font-black text-[#111] shadow-[0_4px_0_#111] disabled:opacity-60"
        >
          {saving && <Loader2 className="h-5 w-5 animate-spin" />}
          Guardar
        </button>
      </div>
    </div>
  );
}
