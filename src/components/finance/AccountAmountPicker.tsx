'use client';
import React, { useCallback, useEffect, useState } from 'react';
import LoadError from '@/components/ui/LoadError';
import { accountsService } from '@/lib/supabaseFinance';
import { getFxContext } from '@/lib/supabaseCurrency';
import { formatCurrency, getCurrencyInfo, getRateFromMap } from '@/lib/currency';
import { getErrorMessage } from '@/lib/dataError';
import type { Account } from '@/lib/financeStore';

// The account chosen to pay/collect an amount expressed in the base currency. When the
// account uses another currency, `accountAmount` is what it really moves (prefilled
// with the user's rate, editable).
export interface AccountChoice {
  accountId: string;
  accountAmount: string;
  foreign: boolean;
}

export const EMPTY_ACCOUNT_CHOICE: AccountChoice = {
  accountId: '',
  accountAmount: '',
  foreign: false,
};

// Validates a choice; returns the RPC arguments or an error message for the user.
export function resolveAccountChoice(
  choice: AccountChoice
): { accountId: string; accountAmount?: number } | { error: string } {
  if (!choice.accountId) return { error: 'Elige la cuenta.' };
  if (!choice.foreign) return { accountId: choice.accountId };
  const amt = Math.round((parseFloat(choice.accountAmount) || 0) * 100) / 100;
  if (amt <= 0) return { error: 'Indica el monto en la moneda de la cuenta.' };
  return { accountId: choice.accountId, accountAmount: amt };
}

interface FieldsProps {
  amount: number; // in the base currency
  value: AccountChoice;
  onChange: (c: AccountChoice) => void;
  label?: string;
  selectClassName?: string;
}

const defaultSelectClass =
  'w-full px-4 py-3 bg-gray-50 rounded-xl border-[2px] border-gray-200 text-sm text-black outline-none focus:border-black transition-colors';

export function AccountAmountFields({
  amount,
  value,
  onChange,
  label = 'Cuenta',
  selectClassName = defaultSelectClass,
}: FieldsProps) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [baseCurrency, setBaseCurrency] = useState('PEN');
  const [ratesMap, setRatesMap] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState<unknown>(null);

  const load = useCallback(() => {
    setLoadError(null);
    Promise.all([accountsService.getAll(), getFxContext()])
      .then(([accs, fx]) => {
        setAccounts(accs);
        setBaseCurrency(fx.baseCurrency);
        setRatesMap(fx.ratesMap);
      })
      .catch(setLoadError);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) return <LoadError what="tus cuentas" error={loadError} onRetry={load} />;
  if (accounts && accounts.length === 0) {
    return (
      <p className="px-4 py-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-700">
        Primero agrega una cuenta en la sección Cuentas.
      </p>
    );
  }

  const selected = accounts?.find((a) => a.id === value.accountId);
  const select = (id: string) => {
    const acc = accounts?.find((a) => a.id === id);
    const foreign = !!acc && (acc.currency || 'PEN') !== baseCurrency;
    const converted = acc ? amount * getRateFromMap(ratesMap, baseCurrency, acc.currency) : 0;
    onChange({
      accountId: id,
      foreign,
      accountAmount: foreign && converted > 0 ? converted.toFixed(2) : '',
    });
  };

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">
          {label}
        </label>
        <select
          value={value.accountId}
          onChange={(e) => select(e.target.value)}
          disabled={!accounts}
          className={selectClassName}
        >
          <option value="">{accounts ? 'Elige la cuenta' : 'Cargando cuentas…'}</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.icon} {a.name} ({getCurrencyInfo(a.currency).flag} {a.currency} ·{' '}
              {formatCurrency(a.balance, a.currency)})
            </option>
          ))}
        </select>
      </div>
      {selected && value.foreign && (
        <div>
          <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">
            Monto en {selected.currency} ({formatCurrency(amount, baseCurrency)} {baseCurrency})
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={value.accountAmount}
            onChange={(e) => onChange({ ...value, accountAmount: e.target.value })}
            className={selectClassName}
          />
        </div>
      )}
    </div>
  );
}

interface ModalProps {
  title: string;
  amount: number;
  confirmLabel: string;
  onConfirm: (accountId: string, accountAmount?: number) => Promise<void>;
  onClose: () => void;
}

// Asks for the account before marking a payment as paid or an income as collected.
export function AccountPickerModal({
  title,
  amount,
  confirmLabel,
  onConfirm,
  onClose,
}: ModalProps) {
  const [choice, setChoice] = useState<AccountChoice>(EMPTY_ACCOUNT_CHOICE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    const r = resolveAccountChoice(choice);
    if ('error' in r) {
      setError(r.error);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onConfirm(r.accountId, r.accountAmount);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => !saving && onClose()}
      />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] p-5 space-y-4">
        <h2 className="font-semibold text-black">{title}</h2>
        <AccountAmountFields amount={amount} value={choice} onChange={setChoice} />
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 rounded-xl border-[3px] border-black bg-white text-sm font-black text-black disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={saving || !choice.accountId}
            className="flex-1 py-3 rounded-xl bg-[#FFD43B] text-sm disabled:opacity-50 text-black font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
          >
            {saving ? 'Guardando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
