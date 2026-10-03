'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import LoadError from '@/components/ui/LoadError';
import { getErrorMessage } from '@/lib/dataError';
import { accountsService } from '@/lib/supabaseFinance';
import {
  userSettingsService,
  exchangeRatesService,
  currencyExchangesService,
} from '@/lib/supabaseCurrency';
import { getCurrencyInfo, formatCurrency, getRateFromMap } from '@/lib/currency';
import { ArrowLeft, ArrowUpDown, Check } from 'lucide-react';

interface AccountOption {
  id: string;
  name: string;
  icon: string;
  currency: string;
  balance: number;
  bgColor: string;
}

export default function ConvertirDineroPage() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [fromAmount, setFromAmount] = useState('');
  const [ratesMap, setRatesMap] = useState<Record<string, number>>({});
  const [baseCurrency, setBaseCurrency] = useState('PEN');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState<unknown>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      accountsService.getAll(),
      userSettingsService.get(),
      exchangeRatesService.getRatesMap(),
    ])
      .then(([accs, settings, rates]) => {
        const opts: AccountOption[] = accs.map((a) => ({
          id: a.id,
          name: a.name,
          icon: a.icon,
          currency: a.currency || 'PEN',
          balance: a.balance,
          bgColor: a.bgColor,
        }));
        setAccounts(opts);
        setBaseCurrency(settings.baseCurrencyCode);
        setRatesMap(rates);
        if (opts.length >= 2) {
          setFromAccountId(opts[0].id);
          setToAccountId(opts[1].id);
        } else if (opts.length === 1) {
          setFromAccountId(opts[0].id);
        }
      })
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  const fromCurrency = fromAccount?.currency || 'PEN';
  const toCurrency = toAccount?.currency || 'PEN';
  const rate = getRateFromMap(ratesMap, fromCurrency, toCurrency);
  const fromAmountNum = parseFloat(fromAmount) || 0;
  const toAmountCalc = fromAmountNum * rate;

  const fromCurrInfo = getCurrencyInfo(fromCurrency);
  const toCurrInfo = getCurrencyInfo(toCurrency);

  const handleSwap = () => {
    const tmp = fromAccountId;
    setFromAccountId(toAccountId);
    setToAccountId(tmp);
    setFromAmount('');
  };

  const handleConvert = async () => {
    if (!fromAccount || !toAccount || !fromAmountNum) return;
    if (fromAccountId === toAccountId) {
      setError('Las cuentas de origen y destino deben ser diferentes.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const today = new Date().toISOString().split('T')[0];
      await currencyExchangesService.create({
        fromAccountId,
        toAccountId,
        fromCurrency,
        fromAmount: fromAmountNum,
        toCurrency,
        toAmount: toAmountCalc,
        exchangeRate: rate,
        exchangeDate: today,
        notes,
      });
      // Only reached when the insert really succeeded (the service throws otherwise).
      setSuccess(true);
      setFromAmount('');
      setNotes('');
    } catch (e) {
      console.error(e);
      setError(`No se pudo registrar la conversión. ${getErrorMessage(e)}`);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="rounded-2xl border-[3px] border-black p-6 bg-[#FFD43B] shadow-[4px_4px_0px_#000]">
          <p className="font-black text-black uppercase tracking-widest text-sm animate-pulse">
            CARGANDO...
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="px-4 lg:px-8 py-6 max-w-md mx-auto">
        <LoadError what="tus cuentas" error={loadError} onRetry={load} />
      </div>
    );
  }

  if (success) {
    return (
      <div className="px-4 lg:px-8 py-6 max-w-md mx-auto">
        <div className="rounded-3xl border-[3px] border-black bg-[#DCFCE7] shadow-[6px_6px_0px_#000] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[#4ADE80] border-[3px] border-black flex items-center justify-center mx-auto mb-4 shadow-[3px_3px_0px_#000]">
            <Check className="w-8 h-8 text-black" strokeWidth={3} />
          </div>
          <h2 className="text-2xl font-black text-black uppercase mb-2">¡Conversión registrada!</h2>
          <p className="text-sm font-bold text-black/70 mb-6">
            Tu conversión de {fromCurrInfo.flag} {fromCurrency} a {toCurrInfo.flag} {toCurrency} fue
            registrada correctamente.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => setSuccess(false)}
              className="w-full py-3 rounded-2xl border-[3px] border-black bg-[#FFD43B] text-black font-black text-sm uppercase shadow-[4px_4px_0px_#000] active:shadow-none active:translate-y-0.5 transition-all"
            >
              Nueva conversión
            </button>
            <Link
              href="/finanzas/cuentas"
              className="block w-full py-3 rounded-2xl border-[3px] border-black bg-white text-black font-black text-sm uppercase text-center shadow-[4px_4px_0px_#000] active:shadow-none active:translate-y-0.5 transition-all"
            >
              Ver cuentas
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/finanzas"
          className="w-10 h-10 rounded-xl border-[3px] border-black bg-white flex items-center justify-center shadow-[3px_3px_0px_#000] hover:bg-gray-50 transition-colors active:shadow-none active:translate-y-0.5"
        >
          <ArrowLeft className="w-5 h-5 text-black" strokeWidth={2.5} />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-black uppercase">Convertir dinero</h1>
          <p className="text-xs font-bold text-gray-500">Conversión entre monedas</p>
        </div>
      </div>

      {accounts.length < 2 ? (
        <div className="rounded-2xl border-[3px] border-black bg-[#FEF9C3] p-6 shadow-[4px_4px_0px_#000] text-center">
          <p className="text-2xl mb-3">💱</p>
          <p className="font-black text-black uppercase mb-2">Necesitas al menos 2 cuentas</p>
          <p className="text-sm text-black/60 font-bold mb-4">
            Para convertir dinero, agrega cuentas en diferentes monedas.
          </p>
          <Link
            href="/finanzas/cuentas"
            className="inline-block px-5 py-3 rounded-xl border-[3px] border-black bg-[#FFD43B] font-black text-sm uppercase shadow-[3px_3px_0px_#000]"
          >
            Agregar cuenta
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Info banner */}
          <div className="rounded-xl border-[3px] border-black bg-[#DBEAFE] px-4 py-3 shadow-[3px_3px_0px_#000]">
            <p className="text-xs font-black text-black uppercase">
              💡 Esto NO es un gasto ni un ingreso
            </p>
            <p className="text-xs font-bold text-black/60 mt-0.5">
              Es una conversión de activos. Tu patrimonio total no cambia.
            </p>
          </div>

          {/* FROM */}
          <div className="rounded-2xl border-[3px] border-black bg-white shadow-[4px_4px_0px_#000] p-4">
            <p className="text-xs font-black text-black/60 uppercase mb-2">Desde</p>
            <select
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border-[3px] border-black text-sm font-bold bg-white mb-3 outline-none"
            >
              {accounts.map((a) => {
                const ci = getCurrencyInfo(a.currency);
                return (
                  <option key={a.id} value={a.id}>
                    {a.icon} {a.name} ({ci.flag} {a.currency})
                  </option>
                );
              })}
            </select>
            {fromAccount && (
              <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-gray-50 rounded-xl border-[2px] border-black/20">
                <span className="text-sm">{fromCurrInfo.flag}</span>
                <span className="text-xs font-bold text-black/60">
                  {fromCurrency} · Saldo: {formatCurrency(fromAccount.balance, fromCurrency)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-3 bg-gray-50 rounded-xl border-[3px] border-black">
              <span className="text-black font-black text-lg">{fromCurrInfo.symbol}</span>
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-2xl font-black text-black outline-none"
              />
              <span className="text-sm font-black text-gray-500 bg-white px-2 py-1 rounded-lg border-[2px] border-black">
                {fromCurrency}
              </span>
            </div>
          </div>

          {/* Swap button */}
          <div className="flex justify-center">
            <button
              onClick={handleSwap}
              className="w-12 h-12 rounded-full border-[3px] border-black bg-[#FFD43B] flex items-center justify-center shadow-[3px_3px_0px_#000] hover:bg-yellow-300 transition-all active:shadow-none active:translate-y-0.5"
            >
              <ArrowUpDown className="w-5 h-5 text-black" strokeWidth={2.5} />
            </button>
          </div>

          {/* TO */}
          <div className="rounded-2xl border-[3px] border-black bg-white shadow-[4px_4px_0px_#000] p-4">
            <p className="text-xs font-black text-black/60 uppercase mb-2">Hasta</p>
            <select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border-[3px] border-black text-sm font-bold bg-white mb-3 outline-none"
            >
              {accounts.map((a) => {
                const ci = getCurrencyInfo(a.currency);
                return (
                  <option key={a.id} value={a.id}>
                    {a.icon} {a.name} ({ci.flag} {a.currency})
                  </option>
                );
              })}
            </select>
            {toAccount && (
              <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-gray-50 rounded-xl border-[2px] border-black/20">
                <span className="text-sm">{toCurrInfo.flag}</span>
                <span className="text-xs font-bold text-black/60">
                  {toCurrency} · Saldo: {formatCurrency(toAccount.balance, toCurrency)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-3 bg-[#DCFCE7] rounded-xl border-[3px] border-black">
              <span className="text-black font-black text-lg">{toCurrInfo.symbol}</span>
              <span className="flex-1 text-2xl font-black text-black">
                {fromAmountNum > 0 ? toAmountCalc.toFixed(2) : '0.00'}
              </span>
              <span className="text-sm font-black text-gray-500 bg-white px-2 py-1 rounded-lg border-[2px] border-black">
                {toCurrency}
              </span>
            </div>
          </div>

          {/* Exchange rate info */}
          {fromCurrency !== toCurrency && (
            <div className="rounded-xl border-[3px] border-black bg-[#FEF9C3] px-4 py-3 shadow-[3px_3px_0px_#000]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-black uppercase">Tipo de cambio</p>
                <p className="text-sm font-black text-black">
                  1 {fromCurrency} = {formatCurrency(rate, toCurrency)}
                </p>
              </div>
              {fromAmountNum > 0 && (
                <div className="mt-2 pt-2 border-t-[2px] border-dashed border-black/20">
                  <p className="text-xs font-bold text-black/60">
                    {formatCurrency(fromAmountNum, fromCurrency)} →{' '}
                    {formatCurrency(toAmountCalc, toCurrency)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Nota (opcional, ej: Cambio en banco)"
            className="w-full px-4 py-3 rounded-xl border-[3px] border-black text-sm font-bold bg-white outline-none shadow-[3px_3px_0px_#000]"
          />

          {error && (
            <div className="rounded-xl border-[3px] border-red-500 bg-red-50 px-4 py-3">
              <p className="text-xs font-bold text-red-700">{error}</p>
            </div>
          )}

          {/* Convert button */}
          <button
            onClick={handleConvert}
            disabled={!fromAmountNum || fromAccountId === toAccountId || saving}
            className="w-full py-4 rounded-2xl border-[3px] border-black bg-[#FFD43B] text-black font-black text-base uppercase shadow-[6px_6px_0px_#000] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Registrando...' : `Convertir ${fromCurrInfo.flag} → ${toCurrInfo.flag}`}
          </button>
        </div>
      )}
    </div>
  );
}
