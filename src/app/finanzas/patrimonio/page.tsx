'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { accountsService, savingsService, investmentsService, debtsService } from '@/lib/supabaseFinance';
import LoadError from '@/components/ui/LoadError';
import { userSettingsService, exchangeRatesService } from '@/lib/supabaseCurrency';
import { getCurrencyInfo, formatCurrency, getRateFromMap, groupAccountsByCurrency } from '@/lib/currency';

export default function PatrimonioPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [baseCurrency, setBaseCurrency] = useState('PEN');
  const [ratesMap, setRatesMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      accountsService.getAll(),
      savingsService.getAll(),
      investmentsService.getAll(),
      debtsService.getAll(),
      userSettingsService.get(),
      exchangeRatesService.getRatesMap(),
    ]).then(([accs, goals, invs, dbs, settings, rates]) => {
      setAccounts(accs);
      setSavingsGoals(goals);
      setInvestments(invs);
      setDebts(dbs);
      setBaseCurrency(settings.baseCurrencyCode);
      setRatesMap(rates);
    }).catch(setLoadError).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="rounded-2xl border-[3px] border-black p-6 bg-[#FFD43B] shadow-[4px_4px_0px_#000]">
          <p className="font-black text-black uppercase tracking-widest text-sm animate-pulse">CARGANDO...</p>
        </div>
      </div>
    );
  }

  // A failed load must never fall through to the "Sin datos de patrimonio" empty state.
  if (loadError) {
    return (
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-manrope font-800 text-fin-text mb-5">Patrimonio neto</h1>
        <LoadError what="tu patrimonio" error={loadError} onRetry={load} />
      </div>
    );
  }

  const baseCurrInfo = getCurrencyInfo(baseCurrency);

  // Convert account balance to base currency
  const getAccBaseBalance = (acc: any) => {
    const currency = acc.currency || 'PEN';
    const rate = getRateFromMap(ratesMap, currency, baseCurrency);
    return acc.balance * rate;
  };

  const positiveAccounts = accounts.filter(a => a.balance > 0);
  const negativeAccounts = accounts.filter(a => a.balance < 0);
  const totalSavings = savingsGoals.reduce((s, g) => s + g.current, 0);
  const totalInvestments = investments.reduce((s, i) => s + (i.shares * i.price), 0);
  const totalDebts = debts.reduce((s, d) => s + d.balance, 0);

  const totalAssetsBase = positiveAccounts.reduce((s, a) => s + getAccBaseBalance(a), 0) + totalSavings + totalInvestments;
  const totalLiabilitiesBase = Math.abs(negativeAccounts.reduce((s, a) => s + getAccBaseBalance(a), 0)) + totalDebts;
  const netWorth = totalAssetsBase - totalLiabilitiesBase;

  // Currency groups for accounts
  const currencyGroups = groupAccountsByCurrency(
    positiveAccounts.map(a => ({ balance: a.balance, currency: a.currency || 'PEN' })),
    baseCurrency,
    ratesMap
  );

  const isEmpty = accounts.length === 0 && savingsGoals.length === 0 && investments.length === 0 && debts.length === 0;

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-manrope font-800 text-fin-text">Patrimonio neto</h1>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center text-3xl mb-4">🏦</div>
          <h2 className="text-lg font-manrope font-800 text-fin-text mb-2">Sin datos de patrimonio</h2>
          <p className="text-sm text-fin-muted max-w-xs mb-6">Agrega cuentas, ahorros e inversiones para calcular tu patrimonio neto automáticamente.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href="/finanzas/cuentas" className="px-5 py-3 bg-fin-green text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors">Agregar cuentas</a>
            <a href="/finanzas/inversiones" className="px-5 py-3 border border-fin-border text-fin-text text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors">Agregar inversiones</a>
          </div>
        </div>
      ) : (
        <>
          {/* Net worth hero */}
          <div className={`rounded-2xl p-5 mb-5 ${netWorth >= 0 ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
            <p className="text-sm text-fin-muted mb-1">Patrimonio neto</p>
            <p className={`text-4xl font-manrope font-800 ${netWorth >= 0 ? 'text-fin-green' : 'text-fin-red'}`}>
              {netWorth < 0 ? '-' : ''}{formatCurrency(Math.abs(netWorth), baseCurrency)}
            </p>
            <p className="text-sm text-fin-muted mt-1">Activos - Pasivos · en {baseCurrInfo.flag} {baseCurrency}</p>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-white rounded-2xl border border-fin-border p-4 shadow-fin-card">
              <p className="text-xs text-fin-muted mb-1">Total activos</p>
              <p className="text-xl font-manrope font-800 text-fin-green">{formatCurrency(totalAssetsBase, baseCurrency)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-fin-border p-4 shadow-fin-card">
              <p className="text-xs text-fin-muted mb-1">Total pasivos</p>
              <p className="text-xl font-manrope font-800 text-fin-red">{formatCurrency(totalLiabilitiesBase, baseCurrency)}</p>
            </div>
          </div>

          {/* Multimoneda breakdown */}
          {currencyGroups.length > 1 && (
            <div className="bg-white rounded-2xl border border-fin-border p-4 shadow-fin-card mb-5">
              <p className="text-xs font-semibold text-fin-muted uppercase tracking-wide mb-3">Desglose por moneda</p>
              <div className="space-y-3">
                {currencyGroups.map(g => {
                  const ci = getCurrencyInfo(g.currencyCode);
                  return (
                    <div key={g.currencyCode}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{ci.flag}</span>
                          <span className="text-sm font-semibold text-fin-text">{ci.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-fin-text">{formatCurrency(g.totalOriginal, g.currencyCode)}</p>
                          {g.currencyCode !== baseCurrency && (
                            <p className="text-xs text-fin-muted">≈ {formatCurrency(g.totalInBase, baseCurrency)}</p>
                          )}
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-fin-green rounded-full" style={{ width: `${g.percentage}%` }} />
                      </div>
                      <p className="text-xs text-fin-muted text-right mt-0.5">{g.percentage}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assets breakdown */}
          {(positiveAccounts.length > 0 || totalSavings > 0 || totalInvestments > 0) && (
            <>
              <p className="text-xs font-semibold text-fin-muted uppercase tracking-wide mb-3">Activos</p>
              <div className="bg-white rounded-2xl border border-fin-border shadow-fin-card mb-4 overflow-hidden">
                {positiveAccounts.map((a, i) => {
                  const accCurrency = a.currency || 'PEN';
                  const ci = getCurrencyInfo(accCurrency);
                  const baseBalance = getAccBaseBalance(a);
                  const showEquiv = accCurrency !== baseCurrency;
                  return (
                    <div key={a.id} className={`flex items-center gap-3 px-4 py-3.5 ${i < positiveAccounts.length - 1 || totalSavings > 0 || totalInvestments > 0 ? 'border-b border-gray-50' : ''}`}>
                      <span className="text-xl w-8 flex-shrink-0">{a.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-fin-text">{a.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs">{ci.flag}</span>
                          <span className="text-xs text-fin-muted">{accCurrency}</span>
                          {a.institution && <span className="text-xs text-fin-muted">· {a.institution}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-manrope font-700 text-fin-green">{formatCurrency(a.balance, accCurrency)}</p>
                        {showEquiv && (
                          <p className="text-xs text-fin-muted">≈ {formatCurrency(baseBalance, baseCurrency)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {totalSavings > 0 && (
                  <div className={`flex items-center gap-3 px-4 py-3.5 ${totalInvestments > 0 ? 'border-b border-gray-50' : ''}`}>
                    <span className="text-xl w-8 flex-shrink-0">🐷</span>
                    <div className="flex-1"><p className="text-sm font-semibold text-fin-text">Ahorros</p><p className="text-xs text-fin-muted">{savingsGoals.length} metas</p></div>
                    <p className="text-sm font-manrope font-700 text-fin-green">{formatCurrency(totalSavings, baseCurrency)}</p>
                  </div>
                )}
                {totalInvestments > 0 && (
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <span className="text-xl w-8 flex-shrink-0">📈</span>
                    <div className="flex-1"><p className="text-sm font-semibold text-fin-text">Inversiones</p><p className="text-xs text-fin-muted">{investments.length} activos</p></div>
                    <p className="text-sm font-manrope font-700 text-fin-green">{formatCurrency(totalInvestments, baseCurrency)}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Liabilities breakdown */}
          {(negativeAccounts.length > 0 || totalDebts > 0) && (
            <>
              <p className="text-xs font-semibold text-fin-muted uppercase tracking-wide mb-3">Pasivos</p>
              <div className="bg-white rounded-2xl border border-fin-border shadow-fin-card overflow-hidden">
                {negativeAccounts.map((a, i) => {
                  const accCurrency = a.currency || 'PEN';
                  const ci = getCurrencyInfo(accCurrency);
                  const baseBalance = Math.abs(getAccBaseBalance(a));
                  const showEquiv = accCurrency !== baseCurrency;
                  return (
                    <div key={a.id} className={`flex items-center gap-3 px-4 py-3.5 ${i < negativeAccounts.length - 1 || totalDebts > 0 ? 'border-b border-gray-50' : ''}`}>
                      <span className="text-xl w-8 flex-shrink-0">{a.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-fin-text">{a.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs">{ci.flag}</span>
                          <span className="text-xs text-fin-muted">{accCurrency}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-manrope font-700 text-fin-red">{formatCurrency(Math.abs(a.balance), accCurrency)}</p>
                        {showEquiv && (
                          <p className="text-xs text-fin-muted">≈ {formatCurrency(baseBalance, baseCurrency)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {debts.map((d, i) => (
                  <div key={d.id} className={`flex items-center gap-3 px-4 py-3.5 ${i < debts.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <span className="text-xl w-8 flex-shrink-0">{d.icon}</span>
                    <div className="flex-1"><p className="text-sm font-semibold text-fin-text">{d.name}</p><p className="text-xs text-fin-muted">{d.institution}</p></div>
                    <p className="text-sm font-manrope font-700 text-fin-red">{formatCurrency(d.balance, baseCurrency)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
