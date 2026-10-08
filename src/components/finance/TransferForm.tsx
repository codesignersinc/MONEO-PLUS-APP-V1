'use client';
import React, { useCallback, useEffect, useState } from 'react';
import LoadError from '@/components/ui/LoadError';
import { accountsService, transfersService } from '@/lib/supabaseFinance';
import { getFxContext, type FxContext } from '@/lib/supabaseCurrency';
import { buildTransferAmounts, formatCurrency } from '@/lib/currency';
import { localDateTimeToISO, nowTimeLocal, todayLocal } from '@/lib/dates';
import { getErrorMessage } from '@/lib/dataError';
import type { Account } from '@/lib/financeStore';
import { DateField, NotesField, TAGGED, Tag, TextField } from '@/components/finance/formKit';

interface TransferFormProps {
  onSaved: () => void;
  saveLabel?: string;
  saveClassName?: string;
}

const inputClass =
  'w-full px-4 h-14 bg-white rounded-2xl border-[3px] border-[#111] text-[16px] font-bold text-[#111] placeholder:font-semibold placeholder:text-gray-400 outline-none focus:shadow-[0_0_0_3px_#FFD83D] transition-shadow';

// Creates a transfer between two of the user's accounts. The first two registered accounts
// come preselected (origin and destination); the database records both legs and moves
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
        // First registered account preselected as origin and the second as destination;
        // the user can change both.
        setFromId((cur) => cur || accs[0]?.id || '');
        setToId((cur) => cur || accs[1]?.id || '');
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
      {a.name} ({a.currency} · {formatCurrency(a.balance, a.currency)})
    </option>
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        {fromId && <Tag>Desde</Tag>}
        <select
          aria-label="Desde"
          value={fromId}
          onChange={(e) => {
            setFromId(e.target.value);
            if (e.target.value === toId) setToId('');
            setReceived('');
          }}
          className={`${inputClass} ${fromId ? TAGGED : 'text-gray-400'}`}
        >
          <option value="">Desde (cuenta de origen)</option>
          {accounts.map(accountOption)}
        </select>
      </div>
      <div className="relative">
        {toId && <Tag>Hacia</Tag>}
        <select
          aria-label="Hacia"
          value={toId}
          onChange={(e) => {
            setToId(e.target.value);
            setReceived('');
          }}
          className={`${inputClass} ${toId ? TAGGED : 'text-gray-400'}`}
        >
          <option value="">Hacia (cuenta de destino)</option>
          {accounts.filter((a) => a.id !== fromId).map(accountOption)}
        </select>
      </div>
      <div className="relative">
        {amount && <Tag>Monto enviado {from ? `(${fromCurrency})` : ''}</Tag>}
        <input
          aria-label="Monto enviado"
          type="number"
          inputMode="decimal"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Monto enviado${from ? ` (${fromCurrency})` : ''}`}
          className={`${inputClass} ${amount ? TAGGED : ''}`}
        />
      </div>
      {crossCurrency && (
        <div className="relative">
          {received && <Tag>Monto recibido ({toCurrency})</Tag>}
          <input
            aria-label={`Monto recibido (${toCurrency})`}
            type="number"
            inputMode="decimal"
            min="0"
            value={received}
            onChange={(e) => setReceived(e.target.value)}
            placeholder={`Monto recibido (${toCurrency})${amounts.toAmount ? `: ${amounts.toAmount.toFixed(2)}` : ''}`}
            className={`${inputClass} ${received ? TAGGED : ''}`}
          />
          <p className="text-xs text-blue-600 mt-1">
            Si lo dejas vacío se usa tu tipo de cambio:{' '}
            {formatCurrency(amounts.toAmount, toCurrency)}
          </p>
        </div>
      )}
      <TextField label="Descripción" value={name} onChange={setName} />
      <DateField label="Fecha" value={date} onChange={setDate} />
      <NotesField label="Nota (opcional)" value={notes} onChange={setNotes} />
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
