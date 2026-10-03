'use client';
import React, { useState, useEffect } from 'react';
import { transactionsService, accountsService, Transaction } from '@/lib/supabaseFinance';
import { userSettingsService, exchangeRatesService } from '@/lib/supabaseCurrency';
import { getCurrencyInfo, formatCurrency, getRateFromMap } from '@/lib/currency';
import { createClient } from '@/lib/supabase/client';
import { CATEGORY_PRESETS } from '@/lib/financeStore';
import { Plus, Search, X, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Pencil, Trash2, Clock, Calendar, Filter } from 'lucide-react';

type FilterType = 'todos' | 'pagos' | 'ingresos';

interface TransactionFormData {
  name: string;
  type: 'gasto' | 'ingreso' | 'transferencia';
  amount: string;
  category: string;
  categoryIcon: string;
  accountId: string;
  account: string;
  notes: string;
  date: string;
  time: string;
}

interface PendingIncome {
  id: string;
  name: string;
  amount: number;
  category: string;
  categoryIcon: string;
  collectionDate: string;
  notes: string;
}

interface AccountOption {
  id: string;
  name: string;
  icon: string;
  currency: string;
  balance: number;
}

export default function MovimientosPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingIncomes, setPendingIncomes] = useState<PendingIncome[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [filter, setFilter] = useState<FilterType>('todos');
  const [currencyFilter, setCurrencyFilter] = useState<string>('todas');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState('PEN');
  const [ratesMap, setRatesMap] = useState<Record<string, number>>({});
  const [showEquivalents, setShowEquivalents] = useState(true);
  const [form, setForm] = useState<TransactionFormData>({
    name: '', type: 'gasto', amount: '', category: 'Comida', categoryIcon: '🍽️',
    accountId: '', account: '', notes: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
  });

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      transactionsService.getAll(),
      accountsService.getAll(),
      userSettingsService.get(),
      exchangeRatesService.getRatesMap(),
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return [];
        return supabase
          .from('income_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pendiente')
          .order('collection_date', { ascending: true })
          .then(({ data }) => (data || []).map((r) => ({
            id: r.id,
            name: r.name,
            amount: r.amount,
            category: r.category,
            categoryIcon: r.category_icon,
            collectionDate: r.collection_date,
            notes: r.notes || '',
          })));
      }),
    ]).then(([txs, accs, settings, rates, pending]) => {
      const pendingList = pending as PendingIncome[];
      const filteredTxs = (txs as Transaction[]).filter(tx => {
        if (tx.type !== 'ingreso') return true;
        return !pendingList.some(p => p.name === tx.name && Math.abs(p.amount) === Math.abs(tx.amount));
      });
      setTransactions(filteredTxs);
      setAccounts(accs.map(a => ({ id: a.id, name: a.name, icon: a.icon, currency: a.currency || 'PEN', balance: a.balance })));
      setBaseCurrency(settings.baseCurrencyCode);
      setRatesMap(rates);
      setShowEquivalents(settings.showEquivalents);
      setPendingIncomes(pendingList);
      if (accs.length > 0) {
        setForm(f => ({ ...f, accountId: accs[0].id, account: accs[0].name }));
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Get unique currencies from transactions
  const usedCurrencies = [...new Set(transactions.map(tx => (tx as any).currencyCode || 'PEN'))].filter(Boolean);

  const filtered = transactions.filter(tx => {
    const matchesFilter = filter === 'todos' || (filter === 'pagos' && tx.type === 'gasto') || (filter === 'ingresos' && tx.type === 'ingreso');
    const txCurrency = (tx as any).currencyCode || 'PEN';
    const matchesCurrency = currencyFilter === 'todas' || txCurrency === currencyFilter;
    const matchesSearch = !search || tx.name.toLowerCase().includes(search.toLowerCase()) || tx.category.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesCurrency && matchesSearch;
  });

  const filteredPending = (filter === 'todos' || filter === 'ingresos')
    ? pendingIncomes.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()))
    : [];

  const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const grouped = sorted.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const d = new Date(tx.date);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    let label: string;
    if (d.toDateString() === today.toDateString()) label = 'Hoy';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Ayer';
    else label = d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
    if (!acc[label]) acc[label] = [];
    acc[label].push(tx);
    return acc;
  }, {});

  const totalIncome = filtered.filter(t => t.type === 'ingreso').reduce((s, t) => {
    const txCurrency = (t as any).currencyCode || 'PEN';
    const rate = getRateFromMap(ratesMap, txCurrency, baseCurrency);
    return s + Math.abs(t.amount) * rate;
  }, 0);

  const totalExpense = filtered.filter(t => t.type === 'gasto').reduce((s, t) => {
    const txCurrency = (t as any).currencyCode || 'PEN';
    const rate = getRateFromMap(ratesMap, txCurrency, baseCurrency);
    return s + Math.abs(t.amount) * rate;
  }, 0);

  const totalPorCobrar = filteredPending.reduce((s, p) => s + p.amount, 0);

  const formatCollectionDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
  };

  const openAdd = () => {
    setEditingTx(null);
    setForm({
      name: '', type: 'gasto', amount: '', category: 'Comida', categoryIcon: '🍽️',
      accountId: accounts[0]?.id || '', account: accounts[0]?.name || '',
      notes: '', date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
    });
    setShowForm(true);
  };

  const openEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setForm({
      name: tx.name, type: tx.type as 'gasto' | 'ingreso' | 'transferencia',
      amount: String(Math.abs(tx.amount)), category: tx.category, categoryIcon: tx.categoryIcon,
      accountId: tx.accountId, account: tx.account, notes: tx.notes || '',
      date: tx.date.split('T')[0], time: tx.time,
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name || !form.amount) return;
    setSaving(true);
    const amt = parseFloat(form.amount);
    const selectedAcc = accounts.find(a => a.id === form.accountId);
    const accCurrency = selectedAcc?.currency || 'PEN';
    const rate = getRateFromMap(ratesMap, accCurrency, baseCurrency);
    const baseAmt = Math.abs(amt) * rate;

    if (editingTx) {
      transactionsService.update(editingTx.id, {
        name: form.name, type: form.type, amount: form.type === 'gasto' ? -Math.abs(amt) : Math.abs(amt),
        category: form.category, categoryIcon: form.categoryIcon, accountId: form.accountId,
        account: form.account, notes: form.notes, date: form.date, time: form.time,
      }).then(() => {
        setTransactions(prev => prev.map(t => t.id === editingTx.id ? {
          ...t, name: form.name, type: form.type, amount: form.type === 'gasto' ? -Math.abs(amt) : Math.abs(amt),
          category: form.category, categoryIcon: form.categoryIcon, accountId: form.accountId,
          account: form.account, notes: form.notes, date: form.date, time: form.time,
        } : t));
        setShowForm(false);
      }).catch(console.error).finally(() => setSaving(false));
    } else {
      transactionsService.create({
        name: form.name, type: form.type,
        amount: form.type === 'gasto' ? -Math.abs(amt) : Math.abs(amt),
        category: form.category, categoryIcon: form.categoryIcon,
        accountId: form.accountId, account: form.account,
        notes: form.notes, date: form.date, time: form.time,
        currencyCode: accCurrency,
        originalAmount: Math.abs(amt),
        baseCurrencyCode: baseCurrency,
        baseAmount: baseAmt,
        exchangeRate: rate,
        exchangeRateDate: form.date,
      } as any).then((newTx) => {
        if (newTx) setTransactions(prev => [newTx, ...prev]);
        setShowForm(false);
      }).catch(console.error).finally(() => setSaving(false));
    }
  };

  const handleDelete = (id: string) => {
    transactionsService.delete(id).then(() => {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }).catch(console.error);
  };

  const baseCurrInfo = getCurrencyInfo(baseCurrency);

  return (
    <div className="px-4 lg:px-8 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-manrope font-800 text-fin-text">Movimientos</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(s => !s)}
            className="group w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all duration-200"
          >
            <Search className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => setShowFilters(s => !s)}
            className={`group w-9 h-9 rounded-xl border flex items-center justify-center transition-all duration-200 ${showFilters || currencyFilter !== 'todas' ? 'border-fin-green bg-fin-green-light text-fin-green' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          >
            <Filter className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <button
            onClick={openAdd}
            className="group flex items-center gap-2 px-3 py-2 bg-fin-green text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-all duration-200"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Agregar
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="mb-4">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar movimientos, categorías..."
            className="w-full px-4 py-3 bg-white border border-fin-border rounded-xl text-sm text-fin-text placeholder-gray-400 outline-none focus:border-fin-green transition-colors shadow-fin-card"
            autoFocus />
        </div>
      )}

      {/* Currency filter panel */}
      {showFilters && (
        <div className="mb-4 bg-white border border-fin-border rounded-2xl p-4 shadow-fin-card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-fin-muted uppercase tracking-wide">Filtrar por moneda</p>
            {currencyFilter !== 'todas' && (
              <button onClick={() => setCurrencyFilter('todas')} className="text-xs text-fin-green font-semibold">Limpiar</button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCurrencyFilter('todas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${currencyFilter === 'todas' ? 'bg-black text-white border-black' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              Todas
            </button>
            {usedCurrencies.map(code => {
              const ci = getCurrencyInfo(code);
              return (
                <button
                  key={code}
                  onClick={() => setCurrencyFilter(code)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${currencyFilter === code ? 'bg-black text-white border-black' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  <span>{ci.flag}</span>
                  <span>{code}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      {(transactions.length > 0 || pendingIncomes.length > 0) && (
        <div className={`grid gap-3 mb-5 ${totalPorCobrar > 0 && (filter === 'todos' || filter === 'ingresos') ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownLeft className="w-4 h-4 text-green-600" strokeWidth={1.75} />
              <p className="text-xs text-gray-500 font-medium">Ingresos</p>
            </div>
            <p className="text-xl font-bold text-green-700">{formatCurrency(totalIncome, baseCurrency)}</p>
            {currencyFilter !== 'todas' && <p className="text-xs text-gray-400 mt-0.5">{currencyFilter}</p>}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-4 h-4 text-red-500" strokeWidth={1.75} />
              <p className="text-xs text-gray-500 font-medium">Pagos</p>
            </div>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpense, baseCurrency)}</p>
            {currencyFilter !== 'todas' && <p className="text-xs text-gray-400 mt-0.5">{currencyFilter}</p>}
          </div>
          {totalPorCobrar > 0 && (filter === 'todos' || filter === 'ingresos') && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
                <p className="text-xs text-amber-600 font-medium">Por cobrar</p>
              </div>
              <p className="text-xl font-bold text-amber-600">{formatCurrency(totalPorCobrar, baseCurrency)}</p>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['todos', 'pagos', 'ingresos'] as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
              filter === f ? 'bg-fin-green text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f === 'todos' && <ArrowLeftRight className="w-3 h-3" strokeWidth={2} />}
            {f === 'pagos' && <ArrowUpRight className="w-3 h-3" strokeWidth={2} />}
            {f === 'ingresos' && <ArrowDownLeft className="w-3 h-3" strokeWidth={2} />}
            {f === 'todos' ? 'Todos' : f === 'pagos' ? 'Pagos' : 'Ingresos'}
          </button>
        ))}
        {currencyFilter !== 'todas' && (
          <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold">
            {getCurrencyInfo(currencyFilter).flag} {currencyFilter}
            <button onClick={() => setCurrencyFilter('todas')} className="ml-1 hover:text-blue-900">×</button>
          </span>
        )}
      </div>

      {/* Pending incomes section */}
      {filteredPending.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" strokeWidth={2} />
            Por cobrar
          </p>
          <div className="bg-amber-50 rounded-2xl border border-amber-200 overflow-hidden">
            {filteredPending.map((p, i) => (
              <div key={p.id} className={`flex items-center gap-3 px-4 py-3.5 ${i < filteredPending.length - 1 ? 'border-b border-amber-100' : ''}`}>
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-lg flex-shrink-0">{p.categoryIcon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-fin-text truncate">{p.name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded-full font-semibold shrink-0 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" strokeWidth={2} />
                      Por cobrar
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs px-2 py-0.5 bg-amber-100 rounded-full text-amber-700">{p.category}</span>
                    {p.collectionDate && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <Calendar className="w-3 h-3" strokeWidth={1.75} />
                        Cobro: {formatCollectionDate(p.collectionDate)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-manrope font-700 text-amber-600">+{formatCurrency(p.amount, baseCurrency)}</p>
                  <p className="text-[10px] text-amber-500 mt-0.5">No disponible</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction groups */}
      {Object.keys(grouped).length === 0 && filteredPending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-fin-muted font-medium mb-1">Sin movimientos</p>
          <p className="text-xs text-fin-muted mb-4">Registra tu primer ingreso o pago</p>
          <button onClick={openAdd} className="px-5 py-2.5 bg-fin-green text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors">
            Agregar movimiento
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([date, txs]) => (
            <div key={date}>
              <p className="text-xs font-semibold text-fin-muted uppercase tracking-wide mb-3">{date}</p>
              <div className="bg-white rounded-2xl border border-fin-border shadow-fin-card overflow-hidden">
                {txs.map((tx, i) => {
                  const txCurrency = (tx as any).currencyCode || 'PEN';
                  const txCurrInfo = getCurrencyInfo(txCurrency);
                  const rate = getRateFromMap(ratesMap, txCurrency, baseCurrency);
                  const baseEquiv = Math.abs(tx.amount) * rate;
                  const showEquiv = showEquivalents && txCurrency !== baseCurrency;
                  return (
                    <div key={tx.id} className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors group ${i < txs.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">{tx.categoryIcon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-fin-text truncate">{tx.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-fin-muted">{tx.category}</span>
                          <span className="text-xs text-fin-muted">{tx.account}</span>
                          {txCurrency !== 'PEN' && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-semibold flex items-center gap-0.5">
                              {txCurrInfo.flag} {txCurrency}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 flex items-center gap-2">
                        <div>
                          <p className={`text-sm font-manrope font-700 ${tx.type === 'ingreso' ? 'text-fin-green' : 'text-fin-text'}`}>
                            {tx.type === 'ingreso' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount), txCurrency)}
                          </p>
                          {showEquiv && (
                            <p className="text-xs text-fin-muted">≈ {formatCurrency(baseEquiv, baseCurrency)}</p>
                          )}
                          <p className="text-xs text-fin-muted">{tx.time}</p>
                        </div>
                        <div className="hidden group-hover:flex items-center gap-1 ml-2">
                          <button onClick={() => openEdit(tx)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-fin-muted hover:text-blue-600 transition-colors">
                            <Pencil className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-700 transition-colors" strokeWidth={1.75} />
                          </button>
                          <button onClick={() => handleDelete(tx.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-fin-muted hover:text-fin-red transition-colors">
                            <Trash2 className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-500 transition-colors" strokeWidth={1.75} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-black">{editingTx ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-black hover:bg-gray-200 transition-all hover:rotate-90 duration-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 max-h-[80vh] overflow-y-auto">
              {/* Type tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {(['gasto', 'ingreso', 'transferencia'] as const).map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${form.type === t ? 'bg-white shadow-sm text-black' : 'text-black'}`}>
                    {t === 'gasto' ? 'Pago' : t === 'ingreso' ? 'Ingreso' : 'Transferencia'}
                  </button>
                ))}
              </div>
              {/* Account (first to detect currency) */}
              {accounts.length > 0 ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Cuenta</label>
                  <select value={form.accountId} onChange={e => {
                    const acc = accounts.find(a => a.id === e.target.value);
                    setForm(f => ({ ...f, accountId: e.target.value, account: acc?.name || '' }));
                  }} className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-black outline-none focus:border-fin-green transition-colors">
                    {accounts.map(a => {
                      const ci = getCurrencyInfo(a.currency);
                      return <option key={a.id} value={a.id}>{a.icon} {a.name} ({ci.flag} {a.currency})</option>;
                    })}
                  </select>
                  {(() => {
                    const acc = accounts.find(a => a.id === form.accountId);
                    if (!acc || acc.currency === baseCurrency) return null;
                    const ci = getCurrencyInfo(acc.currency);
                    return (
                      <p className="text-xs text-blue-600 mt-1 font-medium">
                        {ci.flag} Esta cuenta está en {ci.name} ({acc.currency})
                      </p>
                    );
                  })()}
                </div>
              ) : (
                <div className="px-4 py-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-700">
                  Primero agrega una cuenta en la sección Cuentas
                </div>
              )}
              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Monto</label>
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl border border-fin-border">
                  <span className="text-black font-semibold">
                    {getCurrencyInfo(accounts.find(a => a.id === form.accountId)?.currency || 'PEN').symbol}
                  </span>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00" className="flex-1 bg-transparent text-xl font-manrope font-800 text-black outline-none" />
                  <span className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded-lg border border-gray-200">
                    {accounts.find(a => a.id === form.accountId)?.currency || 'PEN'}
                  </span>
                </div>
                {(() => {
                  const acc = accounts.find(a => a.id === form.accountId);
                  const amt = parseFloat(form.amount) || 0;
                  if (!acc || acc.currency === baseCurrency || !amt) return null;
                  const rate = getRateFromMap(ratesMap, acc.currency, baseCurrency);
                  return (
                    <p className="text-xs text-blue-600 mt-1">
                      ≈ {formatCurrency(amt * rate, baseCurrency)} · 1 {acc.currency} = {formatCurrency(rate, baseCurrency)}
                    </p>
                  );
                })()}
              </div>
              {/* Name */}
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Descripción (ej: Almuerzo, Sueldo...)"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-black placeholder-gray-400 outline-none focus:border-fin-green transition-colors" />
              {/* Category */}
              <select value={form.category} onChange={e => {
                const cat = CATEGORY_PRESETS.find(c => c.label === e.target.value);
                setForm(f => ({ ...f, category: e.target.value, categoryIcon: cat?.icon || '📦' }));
              }} className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-black outline-none focus:border-fin-green transition-colors">
                {CATEGORY_PRESETS.map(c => <option key={c.id} value={c.label}>{c.icon} {c.label}</option>)}
              </select>
              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="px-3 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-black outline-none focus:border-fin-green transition-colors" />
                <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  className="px-3 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-black outline-none focus:border-fin-green transition-colors" />
              </div>
              {/* Notes */}
              <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Nota (opcional)"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-fin-border text-sm text-black placeholder-gray-400 outline-none focus:border-fin-green transition-colors" />
              <button onClick={handleSave} disabled={!form.name || !form.amount || saving}
                className="w-full py-3.5 bg-fin-green text-white font-manrope font-700 rounded-xl hover:bg-green-700 transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? 'Guardando...' : editingTx ? 'Guardar cambios' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
