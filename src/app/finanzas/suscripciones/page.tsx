'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  subscriptionsService,
  accountsService,
  addMonthKeepingDay,
  Subscription,
} from '@/lib/supabaseFinance';
import { getFxContext, type FxContext } from '@/lib/supabaseCurrency';
import { formatCurrency, getRateFromMap } from '@/lib/currency';
import type { Account } from '@/lib/financeStore';
import LoadError from '@/components/ui/LoadError';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';
import {
  Plus,
  X,
  Pencil,
  Trash2,
  RefreshCcw,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  CalendarClock,
  PauseCircle,
  Wallet,
} from 'lucide-react';
import SubscriptionServicePicker from '@/components/finance/SubscriptionServicePicker';

const SUB_CATEGORIES = [
  'Entretenimiento',
  'Música',
  'Servicios',
  'Software',
  'Almacenamiento',
  'Salud',
  'Educación',
  'Otro',
];

function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function computeStatus(nextPaymentDate: string | null): 'pending' | 'overdue' {
  if (!nextPaymentDate) return 'pending';
  return nextPaymentDate < todayStr() ? 'overdue' : 'pending';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function monthLabel(yyyyMm: string): string {
  const d = new Date(yyyyMm + '-01T00:00:00');
  const label = d.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// A row in the "this month" list: either a cycle still to pay, or one already paid.
type MonthRow =
  | { kind: 'due'; sub: Subscription; date: string | null; status: 'pending' | 'overdue' }
  | { kind: 'paid'; sub: Subscription; date: string };

// Splits subscriptions into the current month's cycles, upcoming renewals and paused ones.
// - Due this month: next_payment_date falls in (or before) the current month.
// - Paid this month: marked paid and the cycle just paid (next date − 1 month) is this month.
//   It also shows in Renovaciones with its new date until that month arrives.
function groupSubscriptions(subs: Subscription[], currentMonth: string) {
  const month: MonthRow[] = [];
  const renewals: Subscription[] = [];
  const paused: Subscription[] = [];
  for (const sub of subs) {
    if (!sub.active) {
      paused.push(sub);
      continue;
    }
    const next = sub.nextPaymentDate;
    if (!next || next.slice(0, 7) <= currentMonth) {
      month.push({ kind: 'due', sub, date: next, status: computeStatus(next) });
      continue;
    }
    renewals.push(sub);
    if (sub.paymentStatus === 'paid') {
      const paidCycle = addMonthKeepingDay(next, sub.paymentDay, -1);
      if (paidCycle.slice(0, 7) === currentMonth) {
        month.push({ kind: 'paid', sub, date: paidCycle });
      }
    }
  }
  month.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  renewals.sort((a, b) => (a.nextPaymentDate ?? '').localeCompare(b.nextPaymentDate ?? ''));
  return { month, renewals, paused };
}

export default function SuscripcionesPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'Entretenimiento',
    amount: '',
    nextPaymentDate: '',
    active: true,
    icon: '🎬',
    color: '#DC2626',
  });
  const [loadError, setLoadError] = useState<unknown>(null);
  const [formError, setFormError] = useState('');
  const toast = useToast();

  // Pay modal
  const [payingSub, setPayingSub] = useState<Subscription | null>(null);
  const [payAccounts, setPayAccounts] = useState<Account[]>([]);
  const [payFx, setPayFx] = useState<FxContext>({ baseCurrency: 'PEN', ratesMap: {} });
  const [payAccountId, setPayAccountId] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [payLoadError, setPayLoadError] = useState<unknown>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    subscriptionsService
      .getAll()
      .then(setSubs)
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const currentMonth = todayStr().slice(0, 7);
  const { month, renewals, paused } = groupSubscriptions(subs, currentMonth);
  const activeSubs = subs.filter((s) => s.active);
  const monthlyTotal = activeSubs.reduce((s, sub) => s + sub.amount, 0);
  const annualProjection = monthlyTotal * 12;
  const paidRows = month.filter((r) => r.kind === 'paid');
  const paidTotal = paidRows.reduce((s, r) => s + r.sub.amount, 0);
  const monthTotal = month.reduce((s, r) => s + r.sub.amount, 0);
  const pendingCount = month.filter((r) => r.kind === 'due' && r.status === 'pending').length;
  const overdueCount = month.filter((r) => r.kind === 'due' && r.status === 'overdue').length;

  const toggleSub = async (id: string) => {
    const sub = subs.find((s) => s.id === id);
    if (!sub) return;
    try {
      await subscriptionsService.update(id, { active: !sub.active });
      setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
    } catch (err) {
      toast.showError(err);
    }
  };

  const loadPayData = useCallback(() => {
    setPayLoading(true);
    setPayLoadError(null);
    Promise.all([accountsService.getAll(), getFxContext()])
      .then(([accs, fx]) => {
        setPayAccounts(accs);
        setPayFx(fx);
      })
      .catch(setPayLoadError)
      .finally(() => setPayLoading(false));
  }, []);

  const openPay = (sub: Subscription) => {
    setPayingSub(sub);
    setPayAccountId(null);
    setPayError('');
    loadPayData();
  };

  const closePay = () => {
    if (paying) return;
    setPayingSub(null);
  };

  const debitFor = (sub: Subscription, account: Account) =>
    sub.amount * getRateFromMap(payFx.ratesMap, 'PEN', account.currency || 'PEN');

  const confirmPay = async () => {
    const sub = payingSub;
    const account = payAccounts.find((a) => a.id === payAccountId);
    if (!sub || !account) return;
    setPaying(true);
    setPayError('');
    try {
      const { nextPaymentDate, newBalance } = await subscriptionsService.markAsPaid(
        sub,
        account,
        debitFor(sub, account),
        payFx
      );
      setSubs((prev) =>
        prev.map((s) =>
          s.id === sub.id
            ? { ...s, paymentStatus: 'paid', nextPaymentDate, nextDate: nextPaymentDate }
            : s
        )
      );
      setPayAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, balance: newBalance } : a))
      );
      setPayingSub(null);
      toast.showSuccess(
        `${sub.name} pagado desde ${account.name}. Próxima renovación: ${formatDate(nextPaymentDate)}`
      );
    } catch (err) {
      console.error(err);
      setPayError(getErrorMessage(err));
    } finally {
      setPaying(false);
    }
  };

  const openAdd = () => {
    setEditingSub(null);
    setForm({
      name: '',
      category: 'Entretenimiento',
      amount: '',
      nextPaymentDate: '',
      active: true,
      icon: '🎬',
      color: '#DC2626',
    });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (sub: Subscription) => {
    setEditingSub(sub);
    setForm({
      name: sub.name,
      category: sub.category,
      amount: String(sub.amount),
      nextPaymentDate: sub.nextPaymentDate ?? '',
      active: sub.active,
      icon: sub.icon,
      color: sub.color,
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.amount || !form.nextPaymentDate) return;
    setSaving(true);
    setFormError('');
    try {
      const paymentDay = new Date(form.nextPaymentDate + 'T00:00:00').getDate();
      // Keep the "paid" marker when editing a paid subscription without moving its date.
      const keepPaid =
        editingSub?.paymentStatus === 'paid' && editingSub.nextPaymentDate === form.nextPaymentDate;
      const status = keepPaid ? 'paid' : computeStatus(form.nextPaymentDate);
      const subData: Omit<Subscription, 'id'> = {
        name: form.name,
        category: form.category,
        amount: parseFloat(form.amount),
        nextDate: form.nextPaymentDate,
        nextPaymentDate: form.nextPaymentDate,
        paymentDay,
        paymentStatus: status,
        active: form.active,
        icon: form.icon,
        color: '#7C3AED',
      };
      if (editingSub) {
        await subscriptionsService.update(editingSub.id, subData);
        setSubs((prev) => prev.map((s) => (s.id === editingSub.id ? { ...s, ...subData } : s)));
      } else {
        const created = await subscriptionsService.create(subData);
        setSubs((prev) => [...prev, created]);
      }
      setShowForm(false);
    } catch (err) {
      console.error(err);
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await subscriptionsService.delete(id);
      setSubs((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      toast.showError(err);
    }
  };

  const badge = (kind: 'pending' | 'overdue' | 'paid') => {
    if (kind === 'overdue') {
      return (
        <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
          <AlertCircle className="w-3 h-3" strokeWidth={2} />
          Vencido
        </span>
      );
    }
    if (kind === 'pending') {
      return (
        <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          <Clock className="w-3 h-3" strokeWidth={2} />
          Pendiente
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-300">
        <CheckCircle2 className="w-3 h-3" strokeWidth={2} />
        Pagado
      </span>
    );
  };

  const manageButtons = (sub: Subscription) => (
    <>
      <button
        onClick={() => toggleSub(sub.id)}
        title={sub.active ? 'Pausar' : 'Reactivar'}
        aria-label={sub.active ? 'Pausar' : 'Reactivar'}
        className={`group p-1.5 rounded-lg transition-all duration-150 ${sub.active ? 'hover:bg-amber-50' : 'hover:bg-green-50'}`}
      >
        {sub.active ? (
          <ToggleRight
            className="w-4 h-4 text-green-500 group-hover:text-amber-500 transition-colors"
            strokeWidth={1.75}
          />
        ) : (
          <ToggleLeft
            className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors"
            strokeWidth={1.75}
          />
        )}
      </button>
      <button
        onClick={() => openEdit(sub)}
        title="Editar"
        aria-label="Editar"
        className="p-1.5 rounded-lg border-[2px] border-black bg-white hover:bg-gray-100 transition-all"
      >
        <Pencil
          className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-700 transition-colors"
          strokeWidth={1.75}
        />
      </button>
      <button
        onClick={() => handleDelete(sub.id)}
        title="Eliminar"
        aria-label="Eliminar"
        className="p-1.5 rounded-lg border-[2px] border-black bg-white hover:bg-red-50 transition-all"
      >
        <Trash2 className="w-3.5 h-3.5 text-black" strokeWidth={1.75} />
      </button>
    </>
  );

  const subIcon = (sub: Subscription, paid = false) => (
    <div
      className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
      style={{ background: paid ? '#DCFCE7' : '#EDE9FE' }}
    >
      {sub.icon}
    </div>
  );

  const sectionTitle = (icon: React.ReactNode, title: string, extra?: React.ReactNode) => (
    <div className="flex items-center justify-between mb-2 mt-6">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-black text-black uppercase tracking-wide">{title}</h2>
      </div>
      {extra}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-[#FFD43B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-black text-black mb-5 leading-tight">Suscripciones</h1>
        <LoadError what="tus suscripciones" error={loadError} onRetry={load} />
      </div>
    );
  }

  const payingAccount = payAccounts.find((a) => a.id === payAccountId) ?? null;

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-3xl font-black text-black leading-tight">Suscripciones</h1>
        <button
          onClick={openAdd}
          className="group flex items-center gap-2 px-3 py-2 bg-[#FFD43B] text-sm rounded-xl transition-all duration-200 text-black font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
        >
          <Plus
            className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90"
            strokeWidth={2.5}
          />
          Agregar
        </button>
      </div>

      {subs.length > 0 && (
        <div className="bg-white rounded-3xl border-[3px] border-black p-5 shadow-[4px_4px_0px_rgba(0,0,0,1)] mb-2">
          <div className="flex items-center gap-2 mb-1">
            <RefreshCcw className="w-4 h-4 text-purple-500" strokeWidth={1.75} />
            <p className="text-sm text-gray-500">Gasto mensual en suscripciones</p>
          </div>
          <p className="text-3xl font-black text-black">S/ {monthlyTotal.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">
            Proyección anual:{' '}
            <span className="font-semibold text-black">S/ {annualProjection.toFixed(2)}</span>
          </p>
          {month.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
                Pagado S/ {paidTotal.toFixed(2)} de S/ {monthTotal.toFixed(2)}
              </span>
              {overdueCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                  <AlertCircle className="w-3.5 h-3.5" strokeWidth={2} />
                  {overdueCount} vencida{overdueCount > 1 ? 's' : ''}
                </span>
              )}
              {pendingCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                  {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {subs.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <RefreshCcw className="w-12 h-12 text-gray-200 mb-3" strokeWidth={1.25} />
          <p className="text-gray-500 font-medium mb-1">Sin suscripciones registradas</p>
          <p className="text-sm text-gray-400 mb-4">
            Agrega tus suscripciones para controlar gastos recurrentes
          </p>
          <button
            onClick={openAdd}
            className="group flex items-center gap-2 px-4 py-2 bg-[#FFD43B] text-sm rounded-xl transition-all duration-200 text-black font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
          >
            <Plus
              className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90"
              strokeWidth={2.5}
            />
            Agregar suscripción
          </button>
        </div>
      )}

      {/* This month's cycles */}
      {activeSubs.length > 0 && (
        <>
          {sectionTitle(
            <Clock className="w-4 h-4 text-amber-500" strokeWidth={2} />,
            monthLabel(currentMonth)
          )}
          {month.length === 0 ? (
            <p className="text-sm text-gray-500 bg-white rounded-3xl border-[3px] border-black p-4">
              No tienes suscripciones por pagar este mes.
            </p>
          ) : (
            <div className="space-y-3">
              {month.map((row) =>
                row.kind === 'paid' ? (
                  <div
                    key={`paid-${row.sub.id}`}
                    className="bg-green-50 rounded-2xl border border-green-300 p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)]"
                  >
                    <div className="flex items-center gap-3">
                      {subIcon(row.sub, true)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-black">{row.sub.name}</p>
                          {badge('paid')}
                        </div>
                        <p className="text-xs text-green-700 mt-0.5">
                          {row.sub.category} · Cuota del {formatDate(row.date)}
                        </p>
                      </div>
                      <span className="text-sm font-black text-green-700 flex-shrink-0">
                        S/ {row.sub.amount.toFixed(2)}
                      </span>
                      <CheckCircle2
                        className="w-7 h-7 text-green-600 flex-shrink-0"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    key={`due-${row.sub.id}`}
                    className={`bg-white rounded-3xl border-[3px] p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all ${row.status === 'overdue' ? 'border-red-200' : 'border-black'}`}
                  >
                    <div className="flex items-center gap-3">
                      {subIcon(row.sub)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-black">{row.sub.name}</p>
                          {badge(row.status)}
                        </div>
                        <p
                          className={`text-xs font-medium mt-0.5 ${row.status === 'overdue' ? 'text-red-500' : 'text-gray-500'}`}
                        >
                          {row.sub.category} · Pago: {formatDate(row.date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-sm font-black text-black mr-1">
                          S/ {row.sub.amount.toFixed(2)}
                        </span>
                        <button
                          onClick={() => openPay(row.sub)}
                          title="Marcar como pagado"
                          aria-label={`Marcar ${row.sub.name} como pagado`}
                          className="group p-1.5 rounded-lg hover:bg-green-50 transition-all duration-150"
                        >
                          <CheckCircle2
                            className="w-7 h-7 text-gray-400 group-hover:text-green-500 transition-colors"
                            strokeWidth={1.75}
                          />
                        </button>
                        {manageButtons(row.sub)}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}

      {/* Upcoming renewals */}
      {renewals.length > 0 && (
        <>
          {sectionTitle(
            <CalendarClock className="w-4 h-4 text-purple-500" strokeWidth={2} />,
            'Renovaciones'
          )}
          <div className="space-y-2">
            {renewals.map((sub) => (
              <div
                key={`renew-${sub.id}`}
                className="bg-white rounded-2xl border border-dashed border-purple-200 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {subIcon(sub)}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-black">{sub.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {sub.category} · Renueva el {formatDate(sub.nextPaymentDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-sm font-black text-gray-500 mr-1">
                      S/ {sub.amount.toFixed(2)}
                    </span>
                    {manageButtons(sub)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Paused */}
      {paused.length > 0 && (
        <>
          {sectionTitle(
            <PauseCircle className="w-4 h-4 text-gray-400" strokeWidth={2} />,
            'Pausadas'
          )}
          <div className="space-y-2">
            {paused.map((sub) => (
              <div
                key={`paused-${sub.id}`}
                className="bg-white rounded-3xl border-[3px] border-black px-4 py-3 opacity-60"
              >
                <div className="flex items-center gap-3">
                  {subIcon(sub)}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-black">{sub.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{sub.category}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-sm font-black text-gray-500 mr-1">
                      S/ {sub.amount.toFixed(2)}
                    </span>
                    {manageButtons(sub)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pay modal: choose the account to debit */}
      {payingSub && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={closePay}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pay-title"
            className="relative bg-[#FAFAF8] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b-[3px] border-black">
              <div>
                <h2 id="pay-title" className="font-black text-black text-lg">
                  Pagar {payingSub.name}
                </h2>
                <p className="text-xs font-semibold text-gray-600">
                  S/ {payingSub.amount.toFixed(2)} · Cuota del{' '}
                  {formatDate(payingSub.nextPaymentDate)}
                </p>
              </div>
              <button
                onClick={closePay}
                aria-label="Cerrar"
                className="w-9 h-9 rounded-xl bg-black flex items-center justify-center text-white hover:bg-gray-800 transition-all"
              >
                <X className="w-4 h-4" strokeWidth={3} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 overflow-y-auto">
              <p className="text-xs font-black text-black uppercase tracking-wide">
                ¿De qué cuenta se debitará?
              </p>

              {payLoading ? (
                <div className="flex justify-center py-6">
                  <div className="w-8 h-8 border-4 border-[#FFD43B] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : payLoadError ? (
                <LoadError what="tus cuentas" error={payLoadError} onRetry={loadPayData} />
              ) : payAccounts.length === 0 ? (
                <div className="text-sm text-gray-700 bg-white rounded-xl border-[2.5px] border-black p-4">
                  No tienes cuentas registradas.{' '}
                  <Link href="/finanzas/cuentas" className="font-black underline">
                    Agrega una cuenta
                  </Link>{' '}
                  para poder registrar el pago.
                </div>
              ) : (
                <div className="space-y-2" role="radiogroup" aria-label="Cuenta a debitar">
                  {payAccounts.map((acc) => {
                    const selected = acc.id === payAccountId;
                    const currency = acc.currency || 'PEN';
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setPayAccountId(acc.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-[2.5px] text-left transition-all ${selected ? 'border-black bg-[#FFD43B]' : 'border-gray-300 bg-white hover:border-black'}`}
                      >
                        <span className="text-xl">
                          {acc.icon || <Wallet className="w-5 h-5" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-black text-black truncate">
                            {acc.name}
                          </span>
                          <span className="block text-xs font-semibold text-gray-600">
                            Saldo: {formatCurrency(acc.balance, currency)}
                          </span>
                        </span>
                        <span
                          className={`w-5 h-5 rounded-full border-[2.5px] border-black flex items-center justify-center ${selected ? 'bg-black' : 'bg-white'}`}
                        >
                          {selected && <span className="w-2 h-2 rounded-full bg-white" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {payingAccount && (payingAccount.currency || 'PEN') !== 'PEN' && (
                <p className="text-xs font-semibold text-gray-600">
                  Se debitará{' '}
                  {formatCurrency(
                    debitFor(payingSub, payingAccount),
                    payingAccount.currency || 'PEN'
                  )}{' '}
                  de {payingAccount.name} según tu tipo de cambio.
                </p>
              )}

              {payError && (
                <p role="alert" className="text-sm font-semibold text-red-600">
                  {payError}
                </p>
              )}

              <button
                onClick={confirmPay}
                disabled={!payingAccount || paying || payLoading}
                className="w-full py-3.5 bg-[#FFD43B] border-[3px] border-black rounded-2xl text-base shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 text-black font-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)]"
              >
                {paying ? 'Registrando pago...' : `Pagar S/ ${payingSub.amount.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowForm(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative bg-[#FAFAF8] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b-[3px] border-black">
              <h2 className="font-black text-black text-lg">
                {editingSub ? 'Editar suscripción' : 'Nueva suscripción'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-9 h-9 rounded-xl bg-black flex items-center justify-center text-white hover:bg-gray-800 transition-all"
              >
                <X className="w-4 h-4" strokeWidth={3} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 overflow-y-auto">
              {/* Service Picker */}
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">
                  Servicio
                </label>
                <SubscriptionServicePicker
                  value={form.name}
                  onChange={({ name, category, icon }) => {
                    setForm((f) => ({ ...f, name, category, icon }));
                  }}
                />
              </div>

              {/* Category — auto-filled but editable */}
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">
                  Categoría
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-4 py-3 bg-white rounded-xl border-[2.5px] border-black text-sm font-bold text-black outline-none focus:ring-2 focus:ring-[#FFD43B] transition-all"
                >
                  {SUB_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">
                  Monto mensual
                </label>
                <div className="flex items-center gap-2 px-4 py-3 bg-white rounded-xl border-[2.5px] border-black focus-within:ring-2 focus-within:ring-[#FFD43B] transition-all">
                  <span className="text-black font-black text-sm">S/</span>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="flex-1 bg-transparent text-sm font-black text-black outline-none"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">
                  Fecha de pago mensual
                </label>
                <input
                  type="date"
                  value={form.nextPaymentDate}
                  onChange={(e) => setForm((f) => ({ ...f, nextPaymentDate: e.target.value }))}
                  className="w-full px-4 py-3 bg-white rounded-xl border-[2.5px] border-black text-sm font-bold text-black outline-none focus:ring-2 focus:ring-[#FFD43B] transition-all"
                />
                <p className="text-xs font-medium text-gray-500 mt-1">
                  El día del mes se usará para los cobros recurrentes
                </p>
              </div>

              {formError && (
                <p role="alert" className="text-sm font-semibold text-red-600">
                  {formError}
                </p>
              )}

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={!form.name || !form.amount || !form.nextPaymentDate || saving}
                className="w-full py-3.5 bg-[#FFD43B] border-[3px] border-black rounded-2xl font-black text-black text-base shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
              >
                {saving ? 'Guardando...' : editingSub ? 'Guardar cambios' : 'Agregar suscripción'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
