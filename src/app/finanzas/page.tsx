'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { transactionsService, loadFinanceData } from '@/lib/supabaseFinance';
import { FinanceData } from '@/lib/financeStore';
import { Search, ChevronRight, Info, Receipt, Plus, ArrowLeftRight, ScanLine, Utensils, Car, Home, ShoppingCart, MoreHorizontal, Sun, X, TrendingUp, Wallet, Target } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { userSettingsService, exchangeRatesService } from '@/lib/supabaseCurrency';
import { getCurrencyInfo, formatCurrency, getRateFromMap, groupAccountsByCurrency } from '@/lib/currency';
import NotificationBell from '@/components/notifications/NotificationBell';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `S/ ${Math.abs(n).toFixed(2)}`;
}

function getMonthTxs(txs: Transaction[], month: number, year: number) {
  return txs.filter(tx => {
    const d = new Date(tx.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });
}

const MONTHS_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  name: string;
  category: string;
  categoryIcon: string;
  account: string;
  accountId: string;
  amount: number;
  date: string;
  time: string;
  type: 'gasto' | 'ingreso' | 'transferencia';
  notes?: string;
}

// ─── Category Bar Chart ───────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  Comida:       { icon: <Utensils className="w-3.5 h-3.5" />, color: '#4ADE80', label: 'Comida' },
  Transporte:   { icon: <Car className="w-3.5 h-3.5" />, color: '#FB923C', label: 'Transporte' },
  Vivienda:     { icon: <Home className="w-3.5 h-3.5" />, color: '#60A5FA', label: 'Vivienda' },
  Compras:      { icon: <ShoppingCart className="w-3.5 h-3.5" />, color: '#F472B6', label: 'Compras' },
  Otros:        { icon: <MoreHorizontal className="w-3.5 h-3.5" />, color: '#D1D5DB', label: 'Otros' },
  Supermercado: { icon: <ShoppingCart className="w-3.5 h-3.5" />, color: '#FBBF24', label: 'Super' },
  Salud:        { icon: <Plus className="w-3.5 h-3.5" />, color: '#34D399', label: 'Salud' },
  Entretenimiento: { icon: <MoreHorizontal className="w-3.5 h-3.5" />, color: '#A78BFA', label: 'Entret.' },
};

function getCategoryConfig(cat: string) {
  return CATEGORY_CONFIG[cat] || { icon: <MoreHorizontal className="w-3.5 h-3.5" />, color: '#D1D5DB', label: cat };
}

// ─── Quick Action Button ──────────────────────────────────────────────────────

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  bg: string;
  onClick?: () => void;
  href?: string;
}

function QuickAction({ icon, label, bg, onClick, href }: QuickActionProps) {
  const cls = `flex flex-col items-center justify-center gap-2 rounded-2xl border-[3px] border-black p-3 h-[88px] flex-1 active:scale-95 transition-all duration-150 cursor-pointer select-none ${bg}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        <span className="text-2xl">{icon}</span>
        <span className="text-xs font-bold text-black">{label}</span>
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-bold text-black">{label}</span>
    </button>
  );
}

// ─── Account Card ─────────────────────────────────────────────────────────────

interface AccountCardProps {
  name: string;
  institution: string;
  balance: number;
  bg: string;
  textColor?: string;
  logo?: React.ReactNode;
}

function AccountCard({ name, institution, balance, bg, textColor = 'text-white', logo }: AccountCardProps) {
  return (
    <div className={`flex-shrink-0 w-40 rounded-2xl border-[3px] border-black p-3.5 ${bg} flex flex-col justify-between h-[100px]`}>
      <div className="flex items-center justify-between">
        {logo && <div className="text-sm font-black">{logo}</div>}
      </div>
      <div>
        <p className={`text-[10px] font-medium opacity-80 ${textColor}`}>{institution}</p>
        <p className={`text-sm font-black ${textColor} leading-tight`}>{fmt(balance)}</p>
      </div>
    </div>
  );
}

// ─── Add Transaction Modal ────────────────────────────────────────────────────

const CATEGORY_PRESETS = [
  { id: '1', label: 'Comida', icon: '🍽️' },
  { id: '2', label: 'Transporte', icon: '🚗' },
  { id: '3', label: 'Supermercado', icon: '🛒' },
  { id: '4', label: 'Vivienda', icon: '🏠' },
  { id: '5', label: 'Salud', icon: '💊' },
  { id: '6', label: 'Entretenimiento', icon: '🎬' },
  { id: '7', label: 'Educación', icon: '📚' },
  { id: '8', label: 'Suscripciones', icon: '📱' },
  { id: '9', label: 'Servicios', icon: '🔧' },
  { id: '10', label: 'Otros', icon: '📦' },
];

type ModalType = 'gasto' | 'ingreso' | null;

interface QuickAddModalProps {
  type: ModalType;
  data: FinanceData;
  onClose: () => void;
  onSave: (data: FinanceData) => void;
}

function QuickAddModal({ type, data, onClose, onSave }: QuickAddModalProps) {
  const [form, setForm] = useState({
    name: '', amount: '', category: 'Comida', categoryIcon: '🍽️',
    account: data.accounts[0]?.name || '', accountId: data.accounts[0]?.id || '',
    date: new Date().toISOString().split('T')[0], notes: '',
  });
  const [saving, setSaving] = useState(false);

  if (!type) return null;

  function handleCategoryChange(label: string) {
    const preset = CATEGORY_PRESETS.find(p => p.label === label);
    setForm(f => ({ ...f, category: label, categoryIcon: preset?.icon || '📦' }));
  }

  function handleAccountChange(name: string) {
    const acc = data.accounts.find(a => a.name === name);
    setForm(f => ({ ...f, account: name, accountId: acc?.id || '' }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    transactionsService.create({
      name: form.name, category: form.category, categoryIcon: form.categoryIcon,
      account: form.account, accountId: form.accountId,
      amount: type === 'gasto' ? -Math.abs(parseFloat(form.amount)) : parseFloat(form.amount),
      date: new Date(form.date).toISOString(),
      time: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
      type: type === 'gasto' ? 'gasto' : 'ingreso', notes: form.notes,
    }).then(newTx => {
      if (newTx) onSave({ ...data, transactions: [newTx, ...data.transactions] });
      setSaving(false);
      onClose();
    }).catch(() => setSaving(false));
  }

  const isGasto = type === 'gasto';
  const accentBg = isGasto ? 'bg-[#4ADE80]' : 'bg-[#C084FC]';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-[#FAFAF8] w-full max-w-lg rounded-t-3xl shadow-2xl border-t-2 border-x-2 border-black"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className={`mx-4 mb-4 rounded-2xl border-[3px] border-black p-4 flex items-center justify-between ${accentBg}`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{isGasto ? '🧾' : '💰'}</span>
            <h2 className="font-black text-lg text-black">
              {isGasto ? 'Registrar gasto' : 'Registrar ingreso'}
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20 transition-colors">
            <X className="w-4 h-4 text-black" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-4 pb-6 space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Descripción *</label>
            <input
              required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={isGasto ? 'Ej: Almuerzo' : 'Ej: Sueldo'}
              className="w-full px-4 py-3 rounded-xl border-[3px] border-black text-base font-medium focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white text-black"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Monto (S/) *</label>
            <input
              required type="number" step="0.01" min="0.01" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
              className="w-full px-4 py-3 rounded-xl border-[3px] border-black text-2xl font-black focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white text-black"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Categoría</label>
              <select
                value={form.category} onChange={e => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border-[3px] border-black text-base font-medium focus:outline-none bg-white text-black"
              >
                {CATEGORY_PRESETS.map(p => (
                  <option key={p.id} value={p.label}>{p.icon} {p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Cuenta</label>
              {data.accounts.length === 0 ? (
                <div className="px-3 py-2.5 rounded-xl border-[3px] border-black text-xs text-gray-400 bg-white">
                  <Link href="/finanzas/cuentas" onClick={onClose} className="text-black font-bold">Agregar cuenta</Link>
                </div>
              ) : (
                <select
                  value={form.account} onChange={e => handleAccountChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border-[3px] border-black text-base font-medium focus:outline-none bg-white text-black"
                >
                  {data.accounts.map(a => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={saving || (data.accounts.length === 0)}
            className={`w-full py-4 rounded-2xl border-[3px] border-black text-base font-black transition-all active:scale-95 disabled:opacity-50 ${accentBg} text-black`}
          >
            {saving ? 'Guardando...' : isGasto ? 'Registrar gasto' : 'Registrar ingreso'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const { user } = useAuth();
  const [baseCurrency, setBaseCurrency] = useState('PEN');
  const [ratesMap, setRatesMap] = useState<Record<string, number>>({});
  const [showDesglose, setShowDesglose] = useState(false);

  const [viewMonth] = useState(new Date().getMonth());
  const [viewYear] = useState(new Date().getFullYear());

  useEffect(() => {
    Promise.all([
      loadFinanceData(),
      userSettingsService.get(),
      exchangeRatesService.getRatesMap(),
    ]).then(([d, settings, rates]) => {
      setData(d);
      setBaseCurrency(settings.baseCurrencyCode);
      setRatesMap(rates);
    }).catch(console.error);
  }, []);

  const handleSave = useCallback(async (newData: FinanceData) => {
    setData(newData);
  }, []);

  if (!data) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-gray-600">Cargando tus finanzas...</p>
      </div>
    </div>
  );

  const now = new Date();
  // Multimoneda: consolidate all account balances to base currency
  const totalBalance = data.accounts.reduce((s, a) => {
    const accCurrency = (a as any).currency || 'PEN';
    const rate = getRateFromMap(ratesMap, accCurrency, baseCurrency);
    return s + a.balance * rate;
  }, 0);
  const uniqueCurrencies = [...new Set(data.accounts.map(a => (a as any).currency || 'PEN'))];
  const currencyGroups = groupAccountsByCurrency(
    data.accounts.filter(a => a.balance > 0).map(a => ({ balance: a.balance, currency: (a as any).currency || 'PEN' })),
    baseCurrency,
    ratesMap
  );
  const monthTxs = getMonthTxs(data.transactions, viewMonth, viewYear);
  const monthIncome = monthTxs.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTxs.filter(t => t.type === 'gasto').reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalBudget = data.budgetCategories.reduce((s, c) => s + c.budget, 0);
  const budgetUsedPct = totalBudget > 0 ? Math.min(Math.round((monthExpense / totalBudget) * 100), 100) : 0;

  // Today's spending
  const todayTxs = data.transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const todaySpent = todayTxs.filter(t => t.type === 'gasto').reduce((s, t) => s + Math.abs(t.amount), 0);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const dailyBudget = totalBudget > 0 ? totalBudget / daysInMonth : 170;
  const todayPct = Math.min(Math.round((todaySpent / dailyBudget) * 100), 100);

  // Can spend today
  const daysRemaining = Math.max(daysInMonth - now.getDate(), 1);
  const upcomingPaymentsTotal = data.subscriptions.filter(s => s.active).reduce((s, sub) => s + sub.amount, 0);
  const savingsCommitted = data.savingsGoals.reduce((s, g) => {
    if (!g.targetDate) return s;
    const monthsLeft = Math.max(1, Math.ceil((new Date(g.targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    return s + (g.target - g.current) / monthsLeft;
  }, 0);
  const canSpendToday = Math.max(
    (totalBalance - upcomingPaymentsTotal - savingsCommitted) / daysRemaining - todaySpent,
    0
  );

  // Category spending
  const categorySpend: Record<string, { amount: number; icon: string }> = {};
  monthTxs.filter(t => t.type === 'gasto').forEach(t => {
    if (!categorySpend[t.category]) categorySpend[t.category] = { amount: 0, icon: t.categoryIcon };
    categorySpend[t.category].amount += Math.abs(t.amount);
  });
  const topCategories = Object.entries(categorySpend)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 5);
  const maxCatAmount = topCategories.length > 0 ? topCategories[0][1].amount : 1;

  // Upcoming payments
  const upcomingPayments = data.subscriptions
    .filter(s => s.active)
    .sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime())
    .slice(0, 5);
  const nextPayment = upcomingPayments[0];

  // Recent transactions
  const recentTxs = [...data.transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  // Main savings goal
  const mainGoal = data.savingsGoals[0];

  // User name
  const userName = user?.email?.split('@')[0] || 'Usuario';
  const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);

  // Insight
  const restaurantSpend = monthTxs
    .filter(t => t.type === 'gasto' && (t.category === 'Comida' || t.category === 'Restaurante'))
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  // Patrimonio
  const totalAssets = totalBalance + data.investments.reduce((s, i) => s + (i.currentValue || 0), 0);
  const totalDebts = data.debts.reduce((s, d) => s + d.balance, 0);
  const netWorth = totalAssets - totalDebts;

  const formatNextPaymentDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return `Mañana, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
    if (d.toDateString() === now.toDateString()) return 'Hoy';
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  };

  const formatTxTime = (tx: Transaction) => {
    const d = new Date(tx.date);
    if (d.toDateString() === now.toDateString()) return `Hoy, ${tx.time || ''}`;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `Ayer, ${tx.time || ''}`;
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ${tx.time || ''}`;
  };

  // Payment icon colors
  const paymentColors = ['bg-red-600', 'bg-blue-600', 'bg-orange-500', 'bg-green-600', 'bg-yellow-500'];

  return (
    <>
      {modal && (
        <QuickAddModal
          type={modal} data={data} onClose={() => setModal(null)} onSave={handleSave}
        />
      )}

      <div className="bg-[#FAFAF8] min-h-screen">

        {/* ══════════════════════════════════════════════════════════
            DESKTOP HEADER (lg+)
        ══════════════════════════════════════════════════════════ */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 bg-[#FAFAF8] border-b border-gray-100 sticky top-0 z-20">
          {/* Search bar */}
          <div className="flex-1 max-w-md">
            <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-full px-4 py-2.5 hover:border-gray-300 transition-colors">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Buscar movimientos, cuentas, categorías..."
                className="flex-1 text-sm text-gray-600 bg-transparent outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Right: avatar */}
          <div className="flex items-center gap-3 ml-6">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="w-9 h-9 rounded-full bg-[#4ADE80] border-[3px] border-black flex items-center justify-center text-sm font-black text-black">
                {displayName[0]}
              </div>
              <span className="text-sm font-bold text-gray-800">{displayName}</span>
              <ChevronRight className="w-4 h-4 text-gray-400 rotate-90" />
            </div>
            <button className="w-9 h-9 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center hover:border-gray-300 transition-colors">
              <span className="text-base">☀️</span>
            </button>
          </div>
        </header>

        {/* ══════════════════════════════════════════════════════════
            MOBILE HEADER
        ══════════════════════════════════════════════════════════ */}
        <div className="lg:hidden flex items-center justify-between px-4 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full border-[3px] border-black bg-[#4ADE80] flex items-center justify-center text-lg font-black text-black flex-shrink-0">
              {displayName[0]}
            </div>
            <div>
              <h1 className="text-base font-black text-black leading-tight">Hola, {displayName} 👋</h1>
              <p className="text-xs text-gray-500 font-medium">Tu dinero, más simple.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-10 h-10 rounded-full bg-white border-[3px] border-black flex items-center justify-center hover:bg-gray-50 transition-colors active:scale-95">
              <Search className="w-4 h-4 text-black" />
            </button>
            <NotificationBell />
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            DESKTOP: 2-COLUMN MAIN LAYOUT
        ══════════════════════════════════════════════════════════ */}
        <div className="lg:flex lg:gap-0">

          {/* ── CENTER CONTENT ── */}
          <div className="flex-1 lg:px-8 lg:py-6 px-4 pt-3 pb-28 lg:pb-8">

            {/* Desktop greeting */}
            <div className="hidden lg:block mb-6">
              <h1 className="text-3xl font-black text-black">Hola, {displayName} 👋</h1>
              <p className="text-base text-gray-500 font-medium mt-0.5">Tu dinero, más simple.</p>
            </div>

            {/* ── ROW 1: DISPONIBLE HOY + QUICK ACTIONS ── */}
            <div className="lg:flex lg:gap-4 mb-4">

              {/* MAIN CARD: DISPONIBLE HOY */}
              <div className="bg-[#FFD93D] rounded-3xl border-[3px] border-black p-5 mb-4 lg:mb-0 relative overflow-hidden lg:flex-1">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-bold text-black/70">Tu patrimonio</span>
                      <Info className="w-3.5 h-3.5 text-black/50" />
                    </div>
                    <p className="text-4xl font-black text-black leading-none mb-1 tracking-tight">
                      {formatCurrency(totalBalance, baseCurrency)}
                    </p>
                    {uniqueCurrencies.length > 1 && (
                      <p className="text-xs font-bold text-black/60 mb-2">
                        {data.accounts.length} cuentas · {uniqueCurrencies.length} monedas
                      </p>
                    )}
                    {/* Desglose por moneda */}
                    {currencyGroups.length > 1 && (
                      <button
                        onClick={() => setShowDesglose(s => !s)}
                        className="flex items-center gap-1 text-xs font-black text-black bg-black/10 px-2 py-1 rounded-lg hover:bg-black/20 transition-colors mb-2"
                      >
                        {showDesglose ? '▲' : '▼'} Ver desglose
                      </button>
                    )}
                    {showDesglose && currencyGroups.length > 1 && (
                      <div className="bg-white/80 rounded-xl p-3 mb-2 space-y-1.5">
                        {currencyGroups.map(g => {
                          const ci = getCurrencyInfo(g.currencyCode);
                          return (
                            <div key={g.currencyCode} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">{ci.flag}</span>
                                <span className="text-xs font-bold text-black">{ci.name}</span>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-black text-black">{formatCurrency(g.totalOriginal, g.currencyCode)}</p>
                                {g.currencyCode !== baseCurrency && (
                                  <p className="text-[10px] text-black/50">≈ {formatCurrency(g.totalInBase, baseCurrency)}</p>
                                )}
                              </div>
                              <span className="text-xs font-black text-black/60 w-8 text-right">{g.percentage}%</span>
                            </div>
                          );
                        })}
                        <div className="pt-1.5 border-t border-black/10 flex justify-between">
                          <span className="text-xs font-black text-black">Total</span>
                          <span className="text-xs font-black text-black">{formatCurrency(totalBalance, baseCurrency)}</span>
                        </div>
                      </div>
                    )}
                    <div className="h-3 bg-black/10 rounded-full overflow-hidden mb-2 mr-4">
                      <div
                        className="h-full bg-[#4ADE80] rounded-full transition-all duration-700"
                        style={{ width: `${todayPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mr-4">
                      <span className="text-[11px] font-semibold text-black/70">Gastado hoy: {formatCurrency(todaySpent, baseCurrency)}</span>
                      <span className="text-[11px] font-semibold text-black/70">Límite diario: {formatCurrency(dailyBudget, baseCurrency)}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-[120px] h-[110px] relative -mr-1 -mt-1">
                    <Image
                      src="/assets/images/magen1-1790835729987.jpg"
                      alt="Ilustración de teléfono con dinero"
                      fill
                      className="object-contain"
                      priority
                    />
                  </div>
                </div>
                <button className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-black flex items-center justify-center hover:scale-110 transition-transform active:scale-95">
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* QUICK ACTIONS */}
              <div className="flex gap-2.5 lg:flex-col lg:gap-2 lg:w-auto">
                <div className="flex gap-2.5 lg:grid lg:grid-cols-2 lg:gap-2 flex-1">
                  <QuickAction
                    icon={<Receipt className="w-6 h-6 text-black" />}
                    label="Gasto"
                    bg="bg-[#4ADE80]"
                    onClick={() => setModal('gasto')}
                  />
                  <QuickAction
                    icon={<Plus className="w-6 h-6 text-black" />}
                    label="Ingreso"
                    bg="bg-[#C084FC]"
                    onClick={() => setModal('ingreso')}
                  />
                  <QuickAction
                    icon={<ArrowLeftRight className="w-6 h-6 text-black" />}
                    label="Transferir"
                    bg="bg-[#FB923C]"
                    href="/finanzas/movimientos"
                  />
                  <QuickAction
                    icon={<ScanLine className="w-6 h-6 text-black" />}
                    label="Convertir"
                    bg="bg-[#93C5FD]"
                    href="/finanzas/convertir"
                  />
                </div>
              </div>
            </div>

            {/* ── ROW 2: METRICS GRID (desktop only) ── */}
            <div className="hidden lg:grid grid-cols-4 gap-3 mb-4">
              <div className="bg-white rounded-2xl border-[3px] border-black p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#4ADE80]/20 border border-[#4ADE80] flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-medium">Total en cuentas</p>
                  <p className="text-sm font-black text-black">{fmt(totalBalance)}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border-[3px] border-black p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">📅</span>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-medium">Pagos próximos</p>
                  <p className="text-sm font-black text-red-500">{fmt(upcomingPaymentsTotal)}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border-[3px] border-black p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#C084FC]/20 border border-[#C084FC] flex items-center justify-center flex-shrink-0">
                  <Target className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-medium">Metas y ahorros</p>
                  <p className="text-sm font-black text-black">{fmt(data.savingsGoals.reduce((s, g) => s + g.current, 0))}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border-[3px] border-black p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 font-medium">Patrimonio neto</p>
                  <p className="text-sm font-black text-blue-600">{fmt(netWorth)}</p>
                </div>
              </div>
            </div>

            {/* ── ROW 3: TU MES + PUEDES GASTAR HOY + MI META ── */}
            {/* Mobile: 60/40 grid (Tu mes left, Puedes gastar hoy right). Desktop: 3-col grid */}
            <div className="mb-4">
              <div className="lg:hidden grid gap-3" style={{ gridTemplateColumns: '60% 40%' }}>

              {/* TU MES */}
              <div className="bg-white rounded-2xl border-[3px] border-black p-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-black text-black">Tu mes</h3>
                  <Link href="/finanzas/presupuesto" className="flex items-center gap-0.5 text-[10px] font-bold text-blue-600 hover:underline">
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="flex items-baseline gap-1 mb-0.5 flex-wrap">
                  <span className="text-base font-black text-black">{fmt(monthExpense)}</span>
                  <span className="text-[9px] text-gray-400">de {fmt(totalBudget > 0 ? totalBudget : 5000)}</span>
                </div>
                <div className="flex justify-end mb-2">
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border border-black ${budgetUsedPct > 80 ? 'bg-[#FB923C]' : 'bg-[#4ADE80]'}`}>
                    {budgetUsedPct}%
                  </span>
                </div>
                {topCategories.length > 0 ? (
                  <div className="flex items-end gap-1 h-12 mb-2">
                    {topCategories.slice(0, 5).map(([cat, catData]) => {
                      const cfg = getCategoryConfig(cat as string);
                      const maxAmt = topCategories[0]?.[1]?.amount || 1;
                      const pct = Math.max(10, (catData.amount / maxAmt) * 100);
                      return (
                        <div key={cat as string} className="flex-1 rounded-t-md" style={{ height: `${pct}%`, backgroundColor: cfg.color }} />
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-end gap-1 h-12 mb-2">
                    {['#4ADE80','#FB923C','#60A5FA','#F472B6','#D1D5DB'].map((c, i) => (
                      <div key={i} className="flex-1 rounded-t-md opacity-20" style={{ height: `${[80,55,70,45,30][i]}%`, backgroundColor: c }} />
                    ))}
                  </div>
                )}
                <div className="flex gap-0.5">
                  {(topCategories.length > 0 ? topCategories : [['Comida'],['Transporte'],['Vivienda'],['Compras'],['Otros']]).map(([cat]) => {
                    const cfg = getCategoryConfig(cat as string);
                    const spend = topCategories.find(([c]) => c === cat)?.[1].amount;
                    return (
                      <div key={cat as string} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="text-gray-500 scale-75">{cfg.icon}</div>
                        <span className="text-[7px] text-gray-400 font-medium truncate w-full text-center">{cfg.label}</span>
                        {spend ? <span className="text-[7px] text-gray-500 font-bold truncate w-full text-center">S/{Math.round(spend)}</span> : null}
                      </div>
                    );
                  })}
                </div>
              </div>

{/* PUEDES GASTAR HOY — mobile */}
              <div className="rounded-2xl border-[3px] border-black relative overflow-hidden flex flex-col" style={{ minHeight: '140px' }}>
                {/* Background image covering full card */}
                <Image
                  src="/assets/images/magen-1790843084323.jpg"
                  alt="Chico relajado administrando sus finanzas"
                  fill
                  className="object-cover object-right-bottom"
                />
                {/* Text content on top */}
                <div className="relative z-10 p-3 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <Sun className="w-3.5 h-3.5 text-[#FFD93D]" />
                      <span className="text-[10px] font-bold text-black leading-tight">Puedes gastar hoy</span>
                    </div>
                    <button className="w-5 h-5 rounded-full border border-black/60 flex items-center justify-center flex-shrink-0">
                      <ChevronRight className="w-3 h-3 text-black" />
                    </button>
                  </div>
                  <p className="text-xl font-black text-black leading-tight mb-1">
                    {fmt(canSpendToday)}
                  </p>
                  <p className="text-[9px] text-black leading-tight">
                    Sin comprometer tus pagos y metas.
                  </p>
                </div>
              </div>

              </div>{/* end mobile 60/40 grid */}

              {/* Desktop 3-col grid */}
              <div className="hidden lg:grid grid-cols-3 gap-4">

              {/* TU MES — desktop only */}
              <div className="bg-white rounded-2xl border-[3px] border-black p-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-black text-black">Tu mes</h3>
                  <Link href="/finanzas/presupuesto" className="flex items-center gap-0.5 text-xs font-bold text-blue-600 hover:underline">
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="flex items-baseline gap-1 mb-0.5 flex-wrap">
                  <span className="text-xl font-black text-black">{fmt(monthExpense)}</span>
                  <span className="text-xs text-gray-400">de {fmt(totalBudget > 0 ? totalBudget : 5000)}</span>
                </div>
                <div className="flex justify-end mb-2">
                  <span className={`text-xs font-black px-1.5 py-0.5 rounded-full border border-black ${budgetUsedPct > 80 ? 'bg-[#FB923C]' : 'bg-[#4ADE80]'}`}>
                    {budgetUsedPct}%
                  </span>
                </div>
                {topCategories.length > 0 ? (
                  <div className="flex items-end gap-1 h-16 mb-2">
                    {topCategories.slice(0, 5).map(([cat, catData]) => {
                      const cfg = getCategoryConfig(cat as string);
                      const maxAmt = topCategories[0]?.[1]?.amount || 1;
                      const pct = Math.max(10, (catData.amount / maxAmt) * 100);
                      return (
                        <div key={cat as string} className="flex-1 rounded-t-md" style={{ height: `${pct}%`, backgroundColor: cfg.color }} />
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-end gap-1 h-16 mb-2">
                    {['#4ADE80','#FB923C','#60A5FA','#F472B6','#D1D5DB'].map((c, i) => (
                      <div key={i} className="flex-1 rounded-t-md opacity-20" style={{ height: `${[80,55,70,45,30][i]}%`, backgroundColor: c }} />
                    ))}
                  </div>
                )}
                <div className="flex gap-1">
                  {(topCategories.length > 0 ? topCategories : [['Comida'],['Transporte'],['Vivienda'],['Compras'],['Otros']]).map(([cat]) => {
                    const cfg = getCategoryConfig(cat as string);
                    const spend = topCategories.find(([c]) => c === cat)?.[1].amount;
                    return (
                      <div key={cat as string} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="text-gray-500">{cfg.icon}</div>
                        <span className="text-[8px] text-gray-400 font-medium truncate w-full text-center">{cfg.label}</span>
                        {spend ? <span className="text-[8px] text-gray-500 font-bold truncate w-full text-center">S/{Math.round(spend)}</span> : null}
                      </div>
                    );
                  })}
                </div>
              </div>

{/* PUEDES GASTAR HOY — desktop */}
              <div className="rounded-2xl border-[3px] border-black relative overflow-hidden flex flex-col">
                {/* Background image covering full card */}
                <Image
                  src="/assets/images/magen-1790843084323.jpg"
                  alt="Chico relajado administrando sus finanzas"
                  fill
                  className="object-cover object-right-bottom"
                />
                {/* Text content on top */}
                <div className="relative z-10 p-4 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <Sun className="w-4 h-4 text-[#FFD93D]" />
                      <span className="text-xs font-bold text-black leading-tight">Puedes gastar hoy</span>
                    </div>
                    <button className="w-6 h-6 rounded-full border border-black/60 flex items-center justify-center flex-shrink-0">
                      <ChevronRight className="w-3 h-3 text-black" />
                    </button>
                  </div>
                  <p className="text-3xl font-black text-black leading-tight mb-1">
                    {fmt(canSpendToday)}
                  </p>
                  <p className="text-[11px] text-black leading-tight">
                    Sin comprometer tus pagos y metas.
                  </p>
                </div>
              </div>

              {/* MI META — desktop only in this row */}
              <div className="bg-white rounded-2xl border-[3px] border-black p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-black">Mi meta</h3>
                  <Link href="/finanzas/ahorros" className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                    Ver todas <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                {mainGoal ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-[#DCFCE7] border-[3px] border-black flex items-center justify-center text-2xl flex-shrink-0">
                        {mainGoal.icon || '🎯'}
                      </div>
                      <div>
                        <p className="text-sm font-black text-black leading-tight">{mainGoal.name}</p>
                        <p className="text-xs text-gray-500">{fmt(mainGoal.current)} <span className="text-gray-400">de {fmt(mainGoal.target)}</span></p>
                      </div>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2 border border-black/10">
                      <div
                        className="h-full bg-[#4ADE80] rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(mainGoal.target > 0 ? Math.round((mainGoal.current / mainGoal.target) * 100) : 0, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-gray-400">Para lograrlo necesitas:</p>
                        <p className="text-xs font-black text-black">S/ 520 / mes</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">Faltan</p>
                        <p className="text-xs font-black text-black">3 meses</p>
                      </div>
                      <span className="text-sm font-black text-black bg-[#4ADE80] px-2 py-0.5 rounded-full border border-black">
                        {mainGoal.target > 0 ? Math.round((mainGoal.current / mainGoal.target) * 100) : 0}%
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-center">
                    <span className="text-3xl mb-2">🎯</span>
                    <p className="text-xs text-gray-500 mb-2">Sin metas aún</p>
                    <Link href="/finanzas/ahorros" className="text-xs font-bold text-black hover:underline">Crear meta →</Link>
                  </div>
                )}
              </div>
              </div>{/* end desktop 3-col grid */}
            </div>

            {/* ── MIS CUENTAS + MI META (mobile: 2-col grid) ── */}
            {/* Mobile: Mis cuentas left, Mi meta right. Desktop: Mis cuentas full width */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 mb-4">

              {/* MIS CUENTAS */}
              <div className="bg-white rounded-2xl border-[3px] border-black p-3 lg:p-4">
                <div className="flex items-center justify-between mb-2 lg:mb-3">
                  <h3 className="text-xs lg:text-sm font-black text-black">Mis cuentas</h3>
                  <Link href="/finanzas/cuentas" className="flex items-center gap-0.5 text-[10px] lg:text-xs font-bold text-blue-600 hover:underline">
                    Ver todas <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                {data.accounts.length === 0 ? (
                  <div className="flex gap-3 overflow-x-auto pb-1 fin-scroll">
                    <div className="flex-shrink-0 w-full rounded-2xl border-2 border-dashed border-gray-300 p-3 h-[80px] lg:h-[100px] flex flex-col items-center justify-center gap-1">
                      <Plus className="w-4 h-4 text-gray-400" />
                      <span className="text-[10px] text-gray-400 font-medium">Agregar cuenta</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 lg:flex-row lg:overflow-x-auto lg:pb-1 fin-scroll">
                    {data.accounts.slice(0, 3).map((acc, i) => {
                      const bgs = ['bg-[#1B3A6B]','bg-[#6B21A8]','bg-[#FFC0CB]','bg-[#4ADE80]','bg-[#FB923C]'];
                      const textColors = ['text-white','text-white','text-black','text-black','text-black'];
                      return (
                        <div key={acc.id} className={`rounded-xl border-[3px] border-black p-2.5 lg:flex-shrink-0 lg:w-40 lg:h-[100px] flex flex-col justify-between ${bgs[i % bgs.length]}`}>
                          <span className={`text-[10px] font-black ${textColors[i % textColors.length]}`}>{acc.name}</span>
                          <div>
                            <p className={`text-[9px] font-medium opacity-80 ${textColors[i % textColors.length]}`}>{acc.institution || acc.name}</p>
                            <p className={`text-xs font-black ${textColors[i % textColors.length]} leading-tight`}>{fmt(acc.balance)}</p>
                          </div>
                        </div>
                      );
                    })}
                    <Link href="/finanzas/cuentas" className="hidden lg:flex flex-shrink-0 w-32 rounded-2xl border-2 border-dashed border-gray-300 flex-col items-center justify-center gap-1 h-[100px] hover:border-gray-400 transition-colors">
                      <Plus className="w-5 h-5 text-gray-400" />
                      <span className="text-[10px] text-gray-400 font-medium">Agregar</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* MI META (mobile only in this row — desktop is in ROW 3) */}
              <div className="lg:hidden bg-[#DCFCE7] rounded-2xl border-[3px] border-black p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black text-black">Mi meta</h3>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </div>
                {mainGoal ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-9 h-9 rounded-xl bg-white border border-black/10 flex items-center justify-center text-lg flex-shrink-0">
                        {mainGoal.icon || '🎯'}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-black leading-tight">{mainGoal.name}</p>
                        <p className="text-[9px] text-gray-600 font-semibold">{fmt(mainGoal.current)}</p>
                        <p className="text-[9px] text-gray-400">de {fmt(mainGoal.target)}</p>
                      </div>
                    </div>
                    <div className="h-2 bg-black/10 rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full bg-[#4ADE80] rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(mainGoal.target > 0 ? Math.round((mainGoal.current / mainGoal.target) * 100) : 0, 100)}%` }}
                      />
                    </div>
                    <p className="text-right text-[10px] font-black text-black">
                      {mainGoal.target > 0 ? Math.round((mainGoal.current / mainGoal.target) * 100) : 0}%
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-3 text-center">
                    <span className="text-2xl mb-1">🎯</span>
                    <p className="text-[10px] text-gray-500">Sin metas aún</p>
                    <Link href="/finanzas/ahorros" className="text-[10px] font-bold text-black hover:underline mt-1">Crear meta →</Link>
                  </div>
                )}
              </div>
            </div>

            {/* ── ROW 4: INSIGHT + TU PATRIMONIO (desktop only for insight, always for patrimonio) ── */}
            <div className="lg:grid lg:grid-cols-2 lg:gap-4 mb-4 space-y-3 lg:space-y-0">

              {/* INSIGHT FINANCIERO (desktop only — mobile has it in bottom 2-col grid) */}
              <div className="hidden lg:flex bg-[#FECACA] rounded-2xl border-[3px] border-black p-4 items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#FFD93D] border-[3px] border-black flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">💡</span>
                </div>
                <div className="flex-1 min-w-0">
                  {restaurantSpend > 0 ? (
                    <>
                      <p className="text-sm font-black text-black leading-tight">
                        Has gastado 18% más en restaurantes
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        respecto al promedio de los últimos 3 meses.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-black text-black leading-tight">
                        ¡Buen comienzo del mes!
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Registra tus gastos para ver insights personalizados.
                      </p>
                    </>
                  )}
                </div>
                <button className="w-8 h-8 rounded-full border-[3px] border-black bg-white flex items-center justify-center flex-shrink-0 hover:bg-gray-50 transition-colors">
                  <ChevronRight className="w-4 h-4 text-black" />
                </button>
              </div>

              {/* TU PATRIMONIO */}
              <div className="bg-white rounded-2xl border-[3px] border-black p-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-black text-black">Tu patrimonio</h3>
                  <Link href="/finanzas/patrimonio" className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                    Ver detalle <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <p className="text-2xl font-black text-black">{fmt(netWorth)}</p>
                  <span className="text-xs font-bold text-green-600 flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" /> 12.5%
                  </span>
                </div>
                {/* Simple sparkline */}
                <div className="h-10 flex items-end gap-0.5 mb-2">
                  {[40, 55, 45, 60, 52, 70, 65, 80, 72, 88].map((h, i) => (
                    <div key={i} className="flex-1 rounded-sm bg-blue-200" style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Activos <span className="font-bold text-black">{fmt(totalAssets)}</span></span>
                  <span>Pasivos <span className="font-bold text-black">{fmt(totalDebts)}</span></span>
                  <span>Neto <span className="font-bold text-black">{fmt(netWorth)}</span></span>
                </div>
              </div>
            </div>

            {/* ── ÚLTIMOS MOVIMIENTOS ── */}
            <div className="bg-white rounded-2xl border-[3px] border-black overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black">
                <h3 className="text-sm font-black text-black">Últimos movimientos</h3>
                <Link href="/finanzas/movimientos" className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                  Ver todos <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {recentTxs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <span className="text-4xl mb-2">💸</span>
                  <p className="text-sm font-bold text-gray-600">Tu dinero está esperando su primera historia.</p>
                  <button
                    onClick={() => setModal('gasto')}
                    className="mt-3 px-4 py-2 bg-[#FFD93D] border-[3px] border-black rounded-xl text-xs font-black hover:bg-yellow-400 transition-colors active:scale-95"
                  >
                    Registrar movimiento
                  </button>
                </div>
              ) : (
                <div className="lg:grid lg:grid-cols-2">
                  {/* Left column: transactions */}
                  <div className="divide-y divide-gray-100 lg:border-r-2 lg:border-black">
                    {recentTxs.slice(0, 3).map(tx => {
                      const isIngreso = tx.type === 'ingreso';
                      return (
                        <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-lg flex-shrink-0">
                            {tx.categoryIcon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-black truncate">{tx.name}</p>
                            <p className="text-xs text-gray-400">{formatTxTime(tx)}</p>
                          </div>
                          <p className={`text-sm font-black flex-shrink-0 ${isIngreso ? 'text-[#16A34A]' : 'text-black'}`}>
                            {isIngreso ? '+' : '−'} {fmt(tx.amount)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  {/* Right column: more transactions + scan card */}
                  <div className="divide-y divide-gray-100">
                    {recentTxs.slice(3, 5).map(tx => {
                      const isIngreso = tx.type === 'ingreso';
                      return (
                        <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-lg flex-shrink-0">
                            {tx.categoryIcon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-black truncate">{tx.name}</p>
                            <p className="text-xs text-gray-400">{formatTxTime(tx)}</p>
                          </div>
                          <p className={`text-sm font-black flex-shrink-0 ${isIngreso ? 'text-[#16A34A]' : 'text-black'}`}>
                            {isIngreso ? '+' : '−'} {fmt(tx.amount)}
                          </p>
                        </div>
                      );
                    })}
                    {/* Scan receipt card */}
                    <div className="px-4 py-3 bg-[#DCFCE7] flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-black text-black leading-tight">Dale superpoderes a tus finanzas</p>
                        <p className="text-xs text-gray-600 mt-0.5">Escanea tus recibos y registra tus gastos en segundos.</p>
                        <button
                          onClick={() => {}}
                          className="mt-2 px-4 py-2 bg-black text-white text-xs font-black rounded-xl hover:bg-gray-800 transition-colors active:scale-95 flex items-center gap-1.5"
                        >
                          <ScanLine className="w-3.5 h-3.5" />
                          Escanear recibo
                        </button>
                      </div>
                      <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
                        <span className="text-4xl">📱</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* ── RIGHT COLUMN (desktop only) ── */}
          <div className="hidden lg:flex flex-col w-72 xl:w-80 flex-shrink-0 border-l-2 border-black bg-[#FAFAF8] px-5 py-6 gap-4 min-h-screen">

            {/* PRÓXIMOS PAGOS */}
            <div className="bg-white rounded-2xl border-[3px] border-black p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-black">Próximos pagos</h3>
                <Link href="/finanzas/suscripciones" className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                  Ver todos <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {upcomingPayments.length === 0 ? (
                <div className="flex flex-col items-center py-4 text-center">
                  <span className="text-2xl mb-1">✅</span>
                  <p className="text-xs text-gray-400">Sin pagos próximos</p>
                  <Link href="/finanzas/suscripciones" className="text-xs font-bold text-black hover:underline mt-1">Agregar →</Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingPayments.map((payment, i) => (
                    <div key={payment.id} className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl ${paymentColors[i % paymentColors.length]} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-base">{payment.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-black truncate">{payment.name}</p>
                        <p className="text-[10px] text-gray-400">{formatNextPaymentDate(payment.nextDate)}</p>
                      </div>
                      <p className="text-xs font-black text-black flex-shrink-0">{fmt(payment.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PRÓXIMO PAGO DESTACADO (mobile-style card) */}
            {nextPayment && (
              <div className="bg-white rounded-2xl border-[3px] border-black p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-sm">📅</span>
                  <h3 className="text-xs font-black text-black">Próximo pago</h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl border-[3px] border-black bg-black flex items-center justify-center text-xl flex-shrink-0">
                    <span className="text-lg">{nextPayment.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-black truncate">{nextPayment.name}</p>
                    <p className="text-[10px] text-gray-400">{formatNextPaymentDate(nextPayment.nextDate)}</p>
                    <p className="text-sm font-black text-black">{fmt(nextPayment.amount)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </div>
              </div>
            )}

            {/* QUICK STATS */}
            <div className="bg-[#FFD93D] rounded-2xl border-[3px] border-black p-4">
              <h3 className="text-sm font-black text-black mb-3">Resumen rápido</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-black/70">Ingresos del mes</span>
                  <span className="text-xs font-black text-black">{fmt(monthIncome)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-black/70">Gastos del mes</span>
                  <span className="text-xs font-black text-black">{fmt(monthExpense)}</span>
                </div>
                <div className="h-px bg-black/20 my-1" />
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-black">Balance</span>
                  <span className={`text-sm font-black ${monthIncome - monthExpense >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {monthIncome - monthExpense >= 0 ? '+' : ''}{fmt(monthIncome - monthExpense)}
                  </span>
                </div>
              </div>
            </div>

            {/* ACCESO RÁPIDO */}
            <div className="bg-white rounded-2xl border-[3px] border-black p-4">
              <h3 className="text-xs font-black text-black mb-3">Acceso rápido</h3>
              <div className="space-y-1.5">
                {[
                  { href: '/finanzas/movimientos', label: 'Movimientos', icon: '↔️' },
                  { href: '/finanzas/presupuesto', label: 'Presupuesto', icon: '📊' },
                  { href: '/finanzas/ahorros', label: 'Metas', icon: '🎯' },
                  { href: '/finanzas/cuentas', label: 'Cuentas', icon: '🏦' },
                  { href: '/finanzas/deudas', label: 'Deudas', icon: '💳' },
                ].map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors group"
                  >
                    <span className="text-base">{item.icon}</span>
                    <span className="text-xs font-medium text-gray-700 group-hover:text-black transition-colors">{item.label}</span>
                    <ChevronRight className="w-3 h-3 text-gray-300 ml-auto group-hover:text-gray-500 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            MOBILE: ADDITIONAL SECTIONS (below main content)
        ══════════════════════════════════════════════════════════ */}
        <div className="lg:hidden px-4 pb-4">
          {/* Próximo pago + Insight: 2-col grid on mobile */}
          <div className="grid grid-cols-2 gap-3">
            {/* Próximo pago (mobile) */}
            <div className="bg-white rounded-2xl border-[3px] border-black p-3">
              <div className="flex items-center gap-1 mb-2">
                <span className="text-xs">📅</span>
                <h3 className="text-[10px] font-black text-black">Próximo pago</h3>
              </div>
              {nextPayment ? (
                <div className="flex flex-col gap-1.5">
                  <div className="w-9 h-9 rounded-xl border-[3px] border-black bg-black flex items-center justify-center text-lg flex-shrink-0">
                    <span className="text-base">{nextPayment.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-black truncate">{nextPayment.name}</p>
                    <p className="text-[9px] text-gray-400">{formatNextPaymentDate(nextPayment.nextDate)}</p>
                    <p className="text-sm font-black text-black">{fmt(nextPayment.amount)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-3 text-center">
                  <span className="text-2xl mb-1">✅</span>
                  <p className="text-[10px] text-gray-500">Sin pagos próximos</p>
                  <Link href="/finanzas/suscripciones" className="text-[10px] font-bold text-black hover:underline mt-1">Agregar →</Link>
                </div>
              )}
            </div>

            {/* Insight (mobile) */}
            <div className="bg-[#FECACA] rounded-2xl border-[3px] border-black p-3 flex flex-col gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#FFD93D] border-[3px] border-black flex items-center justify-center flex-shrink-0">
                <span className="text-lg">💡</span>
              </div>
              <div className="flex-1 min-w-0">
                {restaurantSpend > 0 ? (
                  <>
                    <p className="text-[10px] font-black text-black leading-tight">
                      Has gastado 18% más en restaurantes
                    </p>
                    <p className="text-[9px] text-gray-600 mt-0.5">
                      respecto al promedio de los últimos 3 meses.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] font-black text-black leading-tight">
                      ¡Buen comienzo del mes!
                    </p>
                    <p className="text-[9px] text-gray-600 mt-0.5">
                      Registra tus gastos para ver insights.
                    </p>
                  </>
                )}
              </div>
              <button className="w-7 h-7 rounded-full border-[3px] border-black bg-white flex items-center justify-center self-end hover:bg-gray-50 transition-colors">
                <ChevronRight className="w-3 h-3 text-black" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
