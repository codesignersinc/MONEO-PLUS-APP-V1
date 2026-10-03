'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { transactionsService, subscriptionsService } from '@/lib/supabaseFinance';
import LoadError from '@/components/ui/LoadError';
import { toDataError } from '@/lib/dataError';
import { Transaction, Subscription } from '@/lib/financeStore';
import { createClient } from '@/lib/supabase/client';
import { userSettingsService, exchangeRatesService } from '@/lib/supabaseCurrency';
import { getCurrencyInfo, formatCurrency, getRateFromMap } from '@/lib/currency';

interface PagoEntry {
  id: string;
  name: string;
  amount: number;
  category: string;
  categoryIcon: string;
  paymentDate: string;
  status: 'pendiente' | 'pagado' | 'vencido';
}

interface IncomeEntry {
  id: string;
  name: string;
  amount: number;
  category: string;
  categoryIcon: string;
  collectionDate: string;
  status: 'pendiente' | 'cobrado';
}

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const MONTHS_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

export default function ReportesPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagos, setPagos] = useState<PagoEntry[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [baseCurrency, setBaseCurrency] = useState('PEN');
  const [ratesMap, setRatesMap] = useState<Record<string, number>>({});
  const [showCurrencyBreakdown, setShowCurrencyBreakdown] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);

  const load = useCallback(() => {
    const supabase = createClient();
    setLoading(true);
    setLoadError(null);
    Promise.all([
      transactionsService.getAll(),
      supabase.from('pagos').select('*').order('payment_date', { ascending: true }),
      subscriptionsService.getAll(),
      supabase.from('income_entries').select('*').order('collection_date', { ascending: true }),
      userSettingsService.get(),
      exchangeRatesService.getRatesMap(),
    ])
      .then(([txs, pagosRes, subs, incomesRes, settings, rates]) => {
        if (pagosRes.error) throw toDataError(pagosRes.error);
        if (incomesRes.error) throw toDataError(incomesRes.error);
        setTransactions(txs);
        setPagos(
          (pagosRes.data || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            amount: r.amount,
            category: r.category,
            categoryIcon: r.category_icon,
            paymentDate: r.payment_date,
            status: r.status,
          }))
        );
        setSubscriptions(subs);
        setIncomeEntries(
          (incomesRes.data || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            amount: r.amount,
            category: r.category,
            categoryIcon: r.category_icon,
            collectionDate: r.collection_date,
            status: r.status,
          }))
        );
        setBaseCurrency(settings.baseCurrencyCode);
        setRatesMap(rates);
      })
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const monthTxs = transactions.filter((tx) => {
    const d = new Date(tx.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  const monthPagos = pagos.filter((p) => {
    if (!p.paymentDate) return false;
    const d = new Date(p.paymentDate);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  // Income entries for selected month
  const monthIncomes = incomeEntries.filter((inc) => {
    if (!inc.collectionDate) return false;
    const d = new Date(inc.collectionDate);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  // Dinero efectivamente cobrado (income_entries con status='cobrado' del mes)
  const cobradosDelMes = monthIncomes.filter((inc) => inc.status === 'cobrado');
  const totalCobrado = cobradosDelMes.reduce((s, inc) => s + Math.abs(inc.amount), 0);

  // Dinero por cobrar (income_entries con status='pendiente' del mes)
  const porCobrarDelMes = monthIncomes.filter((inc) => inc.status === 'pendiente');
  const totalPorCobrar = porCobrarDelMes.reduce((s, inc) => s + Math.abs(inc.amount), 0);

  const totalGastos = monthTxs
    .filter((t) => t.type === 'gasto')
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const totalTransferencias = monthTxs
    .filter((t) => t.type === 'transferencia')
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const pagosPendientes = monthPagos.filter(
    (p) => p.status === 'pendiente' || p.status === 'vencido'
  );
  const totalPagosPendientes = pagosPendientes.reduce((s, p) => s + p.amount, 0);

  const pagosPagados = monthPagos.filter((p) => p.status === 'pagado');
  const totalPagosPagados = pagosPagados.reduce((s, p) => s + p.amount, 0);

  const totalSuscripciones = subscriptions
    .filter((s) => s.active)
    .reduce((s, sub) => s + sub.amount, 0);

  // Balance = cobrado - gastos - pagos realizados
  const balance = totalCobrado - totalGastos - totalPagosPagados;

  const savingsRate =
    totalCobrado > 0
      ? Math.round(((totalCobrado - totalGastos - totalPagosPagados) / totalCobrado) * 100)
      : 0;

  const categoryMap: Record<string, { amount: number; icon: string }> = {};
  monthTxs
    .filter((t) => t.type === 'gasto')
    .forEach((t) => {
      if (!categoryMap[t.category])
        categoryMap[t.category] = { amount: 0, icon: t.categoryIcon || '📦' };
      categoryMap[t.category].amount += Math.abs(t.amount);
    });
  const categoryData = Object.entries(categoryMap)
    .map(([name, data]) => ({ name, amount: data.amount, icon: data.icon }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);
  const maxCatAmount = categoryData[0]?.amount || 1;

  const trendMonths: { label: string; cobrado: number; gastos: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(selectedYear, selectedMonth - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const mIncomes = incomeEntries.filter((inc) => {
      if (!inc.collectionDate) return false;
      const td = new Date(inc.collectionDate);
      return td.getMonth() === m && td.getFullYear() === y && inc.status === 'cobrado';
    });
    const mTxs = transactions.filter((tx) => {
      const td = new Date(tx.date);
      return td.getMonth() === m && td.getFullYear() === y;
    });
    trendMonths.push({
      label: MONTHS_SHORT[m],
      cobrado: mIncomes.reduce((s, inc) => s + Math.abs(inc.amount), 0),
      gastos: mTxs.filter((t) => t.type === 'gasto').reduce((s, t) => s + Math.abs(t.amount), 0),
    });
  }
  const maxTrend = Math.max(...trendMonths.map((m) => Math.max(m.cobrado, m.gastos)), 1);

  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else setSelectedMonth((m) => m - 1);
  };
  const goToNextMonth = () => {
    const now = new Date();
    if (
      selectedYear > now.getFullYear() ||
      (selectedYear === now.getFullYear() && selectedMonth >= now.getMonth())
    )
      return;
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else setSelectedMonth((m) => m + 1);
  };
  const isCurrentMonth =
    selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear();

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
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <LoadError what="tus reportes" error={loadError} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      {/* ── Header ── */}
      <div className="rounded-2xl border-[3px] border-black bg-[#FFD43B] shadow-[6px_6px_0px_#000] p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-black">📊 REPORTES</h1>
            <p className="text-xs font-bold text-black/70 uppercase tracking-widest mt-0.5">
              ANÁLISIS FINANCIERO
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevMonth}
              className="rounded-lg border-[2px] border-black bg-white w-8 h-8 flex items-center justify-center font-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_#000]"
            >
              ‹
            </button>
            <span className="font-black text-black text-xs uppercase tracking-wide min-w-[70px] text-center">
              {MONTHS_SHORT[selectedMonth]} {selectedYear}
            </span>
            <button
              onClick={goToNextMonth}
              disabled={isCurrentMonth}
              className="rounded-lg border-[2px] border-black bg-white w-8 h-8 flex items-center justify-center font-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0px_#000] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* ── Balance principal ── */}
      <div
        className={`rounded-2xl border-[3px] border-black p-5 mb-4 shadow-[6px_6px_0px_#000] ${balance >= 0 ? 'bg-[#d4edda]' : 'bg-[#f8d7da]'}`}
      >
        <p className="text-xs font-black uppercase tracking-widest text-black/60 mb-1">
          BALANCE DEL MES
        </p>
        <p className={`text-4xl font-black text-black`}>
          {balance >= 0 ? '+' : ''}S/ {balance.toFixed(2)}
        </p>
        <p className="text-xs font-bold text-black/50 mt-1 uppercase">
          {balance >= 0 ? '✅ MES POSITIVO' : '⚠️ MES NEGATIVO'} · TASA AHORRO: {savingsRate}%
        </p>
      </div>

      {/* ── Desglose por moneda ── */}
      {(() => {
        const monthGastos = monthTxs.filter((t) => t.type === 'gasto');
        const currencyGroups: Record<string, { amount: number; baseAmount: number }> = {};
        monthGastos.forEach((t) => {
          const txCurrency = (t as any).currencyCode || baseCurrency;
          const rate = getRateFromMap(ratesMap, txCurrency, baseCurrency);
          const baseAmt = Math.abs(t.amount) * rate;
          if (!currencyGroups[txCurrency])
            currencyGroups[txCurrency] = { amount: 0, baseAmount: 0 };
          currencyGroups[txCurrency].amount += Math.abs(t.amount);
          currencyGroups[txCurrency].baseAmount += baseAmt;
        });
        const groups = Object.entries(currencyGroups);
        if (groups.length <= 1) return null;
        const totalBase = groups.reduce((s, [, g]) => s + g.baseAmount, 0);
        return (
          <div className="rounded-2xl border-[3px] border-black bg-[#EFF6FF] shadow-[4px_4px_0px_#000] mb-4 overflow-hidden">
            <button
              onClick={() => setShowCurrencyBreakdown((s) => !s)}
              className="w-full border-b-[3px] border-black px-4 py-2 bg-black flex items-center justify-between"
            >
              <p className="text-xs font-black uppercase tracking-widest text-[#FFD43B]">
                💱 DESGLOSE POR MONEDA
              </p>
              <span className="text-[#FFD43B] text-sm">{showCurrencyBreakdown ? '▲' : '▼'}</span>
            </button>
            {showCurrencyBreakdown && (
              <div className="p-4 space-y-3">
                <p className="text-xs font-black text-black/60 uppercase">
                  Total gastos: {formatCurrency(totalBase, baseCurrency)}
                </p>
                {groups
                  .sort((a, b) => b[1].baseAmount - a[1].baseAmount)
                  .map(([code, g]) => {
                    const ci = getCurrencyInfo(code);
                    const pct = totalBase > 0 ? Math.round((g.baseAmount / totalBase) * 100) : 0;
                    return (
                      <div key={code}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{ci.flag}</span>
                            <span className="text-xs font-black text-black">{ci.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-black">
                              {formatCurrency(g.amount, code)}
                            </p>
                            {code !== baseCurrency && (
                              <p className="text-[10px] text-black/50">
                                ≈ {formatCurrency(g.baseAmount, baseCurrency)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="h-3 rounded-full border-[2px] border-black bg-white overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#2563EB] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] font-black text-black/40 mt-0.5 text-right">
                          {pct}%
                        </p>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── 4 indicadores principales ── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Dinero cobrado */}
        <div className="rounded-2xl border-[3px] border-black bg-[#DCFCE7] p-4 shadow-[4px_4px_0px_#000]">
          <p className="text-[10px] font-black uppercase tracking-widest text-black/60 mb-1">
            💰 DINERO COBRADO
          </p>
          <p className="text-xl font-black text-black">S/ {totalCobrado.toFixed(2)}</p>
          <p className="text-[10px] font-bold text-black/50 mt-1">
            {cobradosDelMes.length} ingreso(s) cobrado(s)
          </p>
        </div>

        {/* Por cobrar */}
        <div className="rounded-2xl border-[3px] border-black bg-[#FEF9C3] p-4 shadow-[4px_4px_0px_#000]">
          <p className="text-[10px] font-black uppercase tracking-widest text-black/60 mb-1">
            🕐 POR COBRAR
          </p>
          <p className="text-xl font-black text-black">S/ {totalPorCobrar.toFixed(2)}</p>
          <p className="text-[10px] font-bold text-black/50 mt-1">
            {porCobrarDelMes.length} ingreso(s) pendiente(s)
          </p>
        </div>

        {/* Gastos */}
        <div className="rounded-2xl border-[3px] border-black bg-[#FEE2E2] p-4 shadow-[4px_4px_0px_#000]">
          <p className="text-[10px] font-black uppercase tracking-widest text-black/60 mb-1">
            💸 GASTOS
          </p>
          <p className="text-xl font-black text-black">S/ {totalGastos.toFixed(2)}</p>
          <p className="text-[10px] font-bold text-black/50 mt-1">
            {monthTxs.filter((t) => t.type === 'gasto').length} gasto(s)
          </p>
        </div>

        {/* Pagos realizados */}
        <div className="rounded-2xl border-[3px] border-black bg-[#DBEAFE] p-4 shadow-[4px_4px_0px_#000]">
          <p className="text-[10px] font-black uppercase tracking-widest text-black/60 mb-1">
            ✅ PAGOS REALIZADOS
          </p>
          <p className="text-xl font-black text-black">S/ {totalPagosPagados.toFixed(2)}</p>
          <p className="text-[10px] font-bold text-black/50 mt-1">
            {pagosPagados.length} pago(s) completado(s)
          </p>
        </div>
      </div>

      {/* ── Resumen detallado ── */}
      <div className="rounded-2xl border-[3px] border-black bg-[#FAFAF8] shadow-[4px_4px_0px_#000] mb-4 overflow-hidden">
        <div className="border-b-[3px] border-black px-4 py-2 bg-black">
          <p className="text-xs font-black uppercase tracking-widest text-[#FFD43B]">
            📋 RESUMEN DETALLADO
          </p>
        </div>
        <div className="p-4 space-y-2">
          <div className="flex justify-between items-center py-2 border-b-[2px] border-dashed border-black/20">
            <span className="text-xs font-black uppercase text-black/60">Dinero cobrado</span>
            <span className="text-sm font-black text-black">+S/ {totalCobrado.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b-[2px] border-dashed border-black/20">
            <span className="text-xs font-black uppercase text-black/60">
              Por cobrar (pendiente)
            </span>
            <span className="text-sm font-black text-black/50">S/ {totalPorCobrar.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b-[2px] border-dashed border-black/20">
            <span className="text-xs font-black uppercase text-black/60">
              Gastos (transacciones)
            </span>
            <span className="text-sm font-black text-black">-S/ {totalGastos.toFixed(2)}</span>
          </div>
          {totalTransferencias > 0 && (
            <div className="flex justify-between items-center py-2 border-b-[2px] border-dashed border-black/20">
              <span className="text-xs font-black uppercase text-black/60">Transferencias</span>
              <span className="text-sm font-black text-black">
                S/ {totalTransferencias.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center py-2 border-b-[2px] border-dashed border-black/20">
            <span className="text-xs font-black uppercase text-black/60">Pagos realizados</span>
            <span className="text-sm font-black text-black">
              -S/ {totalPagosPagados.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b-[2px] border-dashed border-black/20">
            <span className="text-xs font-black uppercase text-black/60">Pagos pendientes</span>
            <span className="text-sm font-black text-black">
              S/ {totalPagosPendientes.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b-[2px] border-dashed border-black/20">
            <span className="text-xs font-black uppercase text-black/60">
              Suscripciones activas/mes
            </span>
            <span className="text-sm font-black text-black">
              -S/ {totalSuscripciones.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center pt-3">
            <span className="text-sm font-black uppercase text-black">BALANCE NETO</span>
            <span className="text-base font-black text-black">
              {balance >= 0 ? '+' : ''}S/ {balance.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Tendencia últimos 6 meses ── */}
      <div className="rounded-2xl border-[3px] border-black bg-[#F3E8FF] shadow-[4px_4px_0px_#000] mb-4 overflow-hidden">
        <div className="border-b-[3px] border-black px-4 py-2 bg-black rounded-t-xl">
          <p className="text-xs font-black uppercase tracking-widest text-[#FFD43B]">
            📈 TENDENCIA 6 MESES
          </p>
        </div>
        <div className="p-4">
          <div className="flex items-end gap-2 h-24">
            {trendMonths.map((m, i) => {
              const ingPct = Math.round((m.cobrado / maxTrend) * 100);
              const gasPct = Math.round((m.gastos / maxTrend) * 100);
              const isSelected = i === 5;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex gap-0.5 items-end h-16">
                    <div
                      className={`flex-1 rounded-t border-[2px] border-black ${isSelected ? 'bg-[#16A34A]' : 'bg-[#d4edda]'} transition-all`}
                      style={{ height: `${Math.max(ingPct, 4)}%` }}
                    />
                    <div
                      className={`flex-1 rounded-t border-[2px] border-black ${isSelected ? 'bg-[#DC2626]' : 'bg-[#f8d7da]'} transition-all`}
                      style={{ height: `${Math.max(gasPct, 4)}%` }}
                    />
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase ${isSelected ? 'text-black' : 'text-black/40'}`}
                  >
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 pt-2 border-t-[2px] border-dashed border-black/20">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border-[2px] border-black bg-[#d4edda]" />
              <span className="text-[10px] font-black uppercase text-black/60">Cobrado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border-[2px] border-black bg-[#f8d7da]" />
              <span className="text-[10px] font-black uppercase text-black/60">Gastos</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Gastos por categoría ── */}
      {categoryData.length > 0 && (
        <div className="rounded-2xl border-[3px] border-black bg-[#FEF3C7] shadow-[4px_4px_0px_#000] mb-4 overflow-hidden">
          <div className="border-b-[3px] border-black px-4 py-2 bg-black rounded-t-xl">
            <p className="text-xs font-black uppercase tracking-widest text-[#FFD43B]">
              🏷️ GASTOS POR CATEGORÍA
            </p>
          </div>
          <div className="p-4 space-y-3">
            {categoryData.map((cat) => {
              const pct = Math.round((cat.amount / maxCatAmount) * 100);
              return (
                <div key={cat.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-black uppercase text-black">
                      {cat.icon} {cat.name}
                    </span>
                    <span className="font-black text-black">S/ {cat.amount.toFixed(2)}</span>
                  </div>
                  <div className="h-3 rounded-full border-[2px] border-black bg-white overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#D97706] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pagos del mes ── */}
      {monthPagos.length > 0 && (
        <div className="rounded-2xl border-[3px] border-black bg-[#DBEAFE] shadow-[4px_4px_0px_#000] mb-4 overflow-hidden">
          <div className="border-b-[3px] border-black px-4 py-2 bg-black rounded-t-xl">
            <p className="text-xs font-black uppercase tracking-widest text-[#FFD43B]">
              📅 PAGOS DEL MES
            </p>
          </div>
          <div className="divide-y-[2px] divide-dashed divide-black/20">
            {monthPagos.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">{p.categoryIcon}</span>
                  <div>
                    <p className="text-xs font-black uppercase text-black">{p.name}</p>
                    <p className="text-[10px] font-bold text-black/50">{p.paymentDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-black">S/ {p.amount.toFixed(2)}</span>
                  <span
                    className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border-[2px] border-black ${
                      p.status === 'pagado'
                        ? 'bg-[#d4edda] text-black'
                        : p.status === 'vencido'
                          ? 'bg-[#f8d7da] text-black'
                          : 'bg-[#fff3cd] text-black'
                    }`}
                  >
                    {p.status === 'pagado'
                      ? '✓ PAGADO'
                      : p.status === 'vencido'
                        ? '⚠ VENCIDO'
                        : '⏳ PENDIENTE'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Movimientos del mes ── */}
      <div className="rounded-2xl border-[3px] border-black bg-[#ECFDF5] shadow-[4px_4px_0px_#000] mb-4 overflow-hidden">
        <div className="border-b-[3px] border-black px-4 py-2 bg-black rounded-t-xl">
          <p className="text-xs font-black uppercase tracking-widest text-[#FFD43B]">
            🔄 MOVIMIENTOS DEL MES
          </p>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border-[2px] border-black p-3 bg-[#DCFCE7] shadow-[2px_2px_0px_#000]">
              <p className="text-lg font-black text-black">{cobradosDelMes.length}</p>
              <p className="text-[9px] font-black uppercase text-black/60">Cobrados</p>
            </div>
            <div className="rounded-xl border-[2px] border-black p-3 bg-[#FEE2E2] shadow-[2px_2px_0px_#000]">
              <p className="text-lg font-black text-black">
                {monthTxs.filter((t) => t.type === 'gasto').length}
              </p>
              <p className="text-[9px] font-black uppercase text-black/60">Gastos</p>
            </div>
            <div className="rounded-xl border-[2px] border-black p-3 bg-[#DBEAFE] shadow-[2px_2px_0px_#000]">
              <p className="text-lg font-black text-black">
                {monthTxs.filter((t) => t.type === 'transferencia').length}
              </p>
              <p className="text-[9px] font-black uppercase text-black/60">Transfer.</p>
            </div>
          </div>
          {monthTxs.length === 0 && cobradosDelMes.length === 0 && (
            <p className="text-center text-xs font-black uppercase text-black/40 mt-4 py-4">
              SIN MOVIMIENTOS ESTE MES
            </p>
          )}
        </div>
      </div>

      {/* ── Suscripciones activas ── */}
      {subscriptions.filter((s) => s.active).length > 0 && (
        <div className="rounded-2xl border-[3px] border-black bg-[#F3E8FF] shadow-[4px_4px_0px_#000] mb-4 overflow-hidden">
          <div className="border-b-[3px] border-black px-4 py-2 bg-black rounded-t-xl">
            <p className="text-xs font-black uppercase tracking-widest text-[#FFD43B]">
              📱 SUSCRIPCIONES ACTIVAS
            </p>
          </div>
          <div className="p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-black uppercase text-black/60">
                {subscriptions.filter((s) => s.active).length} suscripción(es) activa(s)
              </span>
              <span className="text-sm font-black text-black">
                -S/ {totalSuscripciones.toFixed(2)}/mes
              </span>
            </div>
            <div className="space-y-2">
              {subscriptions
                .filter((s) => s.active)
                .slice(0, 4)
                .map((sub) => (
                  <div key={sub.id} className="flex justify-between items-center">
                    <span className="text-xs font-bold text-black/70">
                      {sub.icon} {sub.name}
                    </span>
                    <span className="text-xs font-black text-black">
                      S/ {sub.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              {subscriptions.filter((s) => s.active).length > 4 && (
                <p className="text-[10px] font-black uppercase text-black/40 text-center pt-1">
                  +{subscriptions.filter((s) => s.active).length - 4} más...
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
