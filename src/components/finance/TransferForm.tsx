'use client';
import React, { useCallback, useEffect, useState } from 'react';
import LoadError from '@/components/ui/LoadError';
import { accountsService, transfersService } from '@/lib/supabaseFinance';
import { getFxContext, type FxContext } from '@/lib/supabaseCurrency';
import { buildTransferAmounts, formatCurrency, getCurrencyInfo } from '@/lib/currency';
import { localDateTimeToISO, nowTimeLocal, todayLocal } from '@/lib/dates';
import { getErrorMessage } from '@/lib/dataError';
import type { Account } from '@/lib/financeStore';

interface TransferFormProps {
  onSaved: () => void;
  saveLabel?: string;
  saveClassName?: string;
}

const inputClass =
  'w-full px-4 h-14 bg-white rounded-2xl border-[3px] border-[#111] text-[16px] font-bold text-[#111] placeholder:font-semibold placeholder:text-gray-400 outline-none focus:shadow-[0_0_0_3px_#FFD83D] transition-shadow';

// Creates a transfer between two of the user's accounts. Both accounts are required
// (never defaults to the first account); the database records both legs and moves
// both balances atomically.
export default function TransferForm({
  onSaved,
  saveLabel = 'Registrar transferencia',
  saveClassName = 'bg-[#FFD43B] text-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5',
}: TransferFormProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fx, setFx] = useState<FxContext>({ baseCurrency: 'PEN', ratesMap: {} });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [received, setReceived] = useState('');
  const [name, setName] = useState('Transferencia');
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([accountsService.getAll(), getFxContext()])
      .then(([accs, fxCtx]) => {
        setAccounts(accs);
        setFx(fxCtx);
      })
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);
  const fromCurrency = from?.currency || 'PEN';
  const toCurrency = to?.currency || 'PEN';
  const crossCurrency = !!from && !!to && fromCurrency !== toCurrency;
  const amountNum = parseFloat(amount) || 0;
  const amounts = buildTransferAmounts({
    fromAmount: amountNum,
    toAmount: received ? parseFloat(received) || 0 : undefined,
    fromCurrency,
    toCurrency,
    baseCurrency: fx.baseCurrency,
    ratesMap: fx.ratesMap,
  });

  const handleSave = async () => {
    if (!from || !to) {
      setError('Elige la cuenta de origen y la de destino.');
      return;
    }
    if (amounts.fromAmount <= 0 || amounts.toAmount <= 0 || amounts.baseAmount <= 0) {
      setError('Ingresa un monto mayor que cero.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await transfersService.create({
        fromAccountId: from.id,
        toAccountId: to.id,
        ...amounts,
        date: localDateTimeToISO(date, nowTimeLocal()),
        name: name.trim() || 'Transferencia',
        notes,
      });
      onSaved();
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500 py-4 text-center">Cargando cuentas…</p>;
  if (loadError) return <LoadError what="tus cuentas" error={loadError} onRetry={load} />;
  if (accounts.length < 2) {
    return (
      <div className="px-4 py-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-700">
        Para transferir necesitas al menos dos cuentas. Agrégalas en la sección Cuentas.
      </div>
    );
  }

  const accountOption = (a: Account) => (
    <option key={a.id} value={a.id}>
      {a.name} ({getCurrencyInfo(a.currency).flag} {a.currency} ·{' '}
      {formatCurrency(a.balance, a.currency)})
    </option>
  );

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">
          Desde
        </label>
        <select
          value={fromId}
          onChange={(e) => {
            setFromId(e.target.value);
            if (e.target.value === toId) setToId('');
            setReceived('');
          }}
          className={inputClass}
        >
          <option value="">Elige la cuenta de origen</option>
          {accounts.map(accountOption)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">
          Hacia
        </label>
        <select
          value={toId}
          onChange={(e) => {
            setToId(e.target.value);
            setReceived('');
          }}
          className={inputClass}
        >
          <option value="">Elige la cuenta de destino</option>
          {accounts.filter((a) => a.id !== fromId).map(accountOption)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">
          Monto enviado {from ? `(${fromCurrency})` : ''}
        </label>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className={inputClass}
        />
      </div>
      {crossCurrency && (
        <div>
          <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">
            Monto recibido ({toCurrency})
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={received}
            onChange={(e) => setReceived(e.target.value)}
            placeholder={amounts.toAmount ? amounts.toAmount.toFixed(2) : '0.00'}
            className={inputClass}
          />
          <p className="text-xs text-blue-600 mt-1">
            Si lo dejas vacío se usa tu tipo de cambio:{' '}
            {formatCurrency(amounts.toAmount, toCurrency)}
          </p>
        </div>
      )}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Descripción"
        className={inputClass}
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className={inputClass}
      />
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Nota (opcional)"
        className={inputClass}
      />
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600">
          {error}
        </p>
      )}
      <button
        onClick={handleSave}
        disabled={saving || !fromId || !toId || amountNum <= 0}
        className={`w-full py-3.5 font-black rounded-xl transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed ${saveClassName}`}
      >
        {saving ? 'Guardando...' : saveLabel}
      </button>
    </div>
  );
}
