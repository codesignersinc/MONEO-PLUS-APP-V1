'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { subscriptionsService, Subscription } from '@/lib/supabaseFinance';
import LoadError from '@/components/ui/LoadError';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';
import { Plus, X, Pencil, Trash2, RefreshCcw, ToggleLeft, ToggleRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import SubscriptionServicePicker from '@/components/finance/SubscriptionServicePicker';

const SUB_CATEGORIES = ['Entretenimiento', 'Música', 'Servicios', 'Software', 'Almacenamiento', 'Salud', 'Educación', 'Otro'];

function computeStatus(nextPaymentDate: string | null): 'pending' | 'overdue' | 'paid' {
  if (!nextPaymentDate) return 'pending';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextPaymentDate + 'T00:00:00');
  if (due < today) return 'overdue';
  return 'pending';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SuscripcionesPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', category: 'Entretenimiento', amount: '',
    nextPaymentDate: '', active: true, icon: '🎬', color: '#DC2626',
  });
  const [loadError, setLoadError] = useState<unknown>(null);
  const [formError, setFormError] = useState('');
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    subscriptionsService.getAll().then(data => {
      const updated = data.map(s => ({
        ...s,
        paymentStatus: s.paymentStatus === 'paid' ? 'paid' : computeStatus(s.nextPaymentDate),
      }));
      setSubs(updated as Subscription[]);
    }).catch(setLoadError).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeSubs = subs.filter(s => s.active);
  const monthlyTotal = activeSubs.reduce((s, sub) => s + sub.amount, 0);
  const annualProjection = monthlyTotal * 12;
  const pendingCount = subs.filter(s => s.active && s.paymentStatus === 'pending').length;
  const overdueCount = subs.filter(s => s.active && s.paymentStatus === 'overdue').length;

  const toggleSub = async (id: string) => {
    const sub = subs.find(s => s.id === id);
    if (!sub) return;
    try {
      await subscriptionsService.update(id, { active: !sub.active });
      setSubs(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
    } catch (err) { toast.showError(err); }
  };

  const handleMarkPaid = async (sub: Subscription) => {
    setMarkingPaid(sub.id);
    try {
      const nextDateStr = await subscriptionsService.markAsPaid(sub.id, sub.paymentDay);
      setSubs(prev => prev.map(s => s.id === sub.id
        ? { ...s, paymentStatus: 'pending', nextPaymentDate: nextDateStr }
        : s));
    } catch (err) { toast.showError(err); } finally { setMarkingPaid(null); }
  };

  const openAdd = () => {
    setEditingSub(null);
    setForm({ name: '', category: 'Entretenimiento', amount: '', nextPaymentDate: '', active: true, icon: '🎬', color: '#DC2626' });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (sub: Subscription) => {
    setEditingSub(sub);
    setForm({
      name: sub.name, category: sub.category, amount: String(sub.amount),
      nextPaymentDate: sub.nextPaymentDate ?? '', active: sub.active, icon: sub.icon, color: sub.color,
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
      const status = computeStatus(form.nextPaymentDate);
      const subData: Omit<Subscription, 'id'> = {
        name: form.name, category: form.category,
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
        setSubs(prev => prev.map(s => s.id === editingSub.id ? { ...s, ...subData } : s));
      } else {
        const created = await subscriptionsService.create(subData);
        setSubs(prev => [...prev, { ...created, paymentStatus: status }]);
      }
      setShowForm(false);
    } catch (err) {
      console.error(err);
      setFormError(getErrorMessage(err));
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await subscriptionsService.delete(id);
      setSubs(prev => prev.filter(s => s.id !== id));
    } catch (err) { toast.showError(err); }
  };

  const statusBadge = (sub: Subscription) => {
    if (!sub.active) return null;
    if (sub.paymentStatus === 'overdue') {
      return (
        <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
          <AlertCircle className="w-3 h-3" strokeWidth={2} />
          Vencido
        </span>
      );
    }
    if (sub.paymentStatus === 'pending') {
      return (
        <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          <Clock className="w-3 h-3" strokeWidth={2} />
          Pendiente
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
        <CheckCircle2 className="w-3 h-3" strokeWidth={2} />
        Pagado
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-fin-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-manrope font-800 text-fin-text mb-5">Suscripciones</h1>
        <LoadError what="tus suscripciones" error={loadError} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-manrope font-800 text-fin-text">Suscripciones</h1>
        <button
          onClick={openAdd}
          className="group flex items-center gap-2 px-3 py-2 bg-fin-green text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-all duration-200"
        >
          <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
          Agregar
        </button>
      </div>

      {subs.length > 0 && (
        <div className="bg-white rounded-2xl border border-fin-border p-5 shadow-fin-card mb-5">
          <div className="flex items-center gap-2 mb-1">
            <RefreshCcw className="w-4 h-4 text-purple-500" strokeWidth={1.75} />
            <p className="text-sm text-fin-muted">Gasto mensual en suscripciones</p>
          </div>
          <p className="text-3xl font-manrope font-800 text-fin-text">S/ {monthlyTotal.toFixed(2)}</p>
          <p className="text-sm text-fin-muted mt-1">Proyección anual: <span className="font-semibold text-fin-text">S/ {annualProjection.toFixed(2)}</span></p>
          {(pendingCount > 0 || overdueCount > 0) && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
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
          <p className="text-sm text-gray-400 mb-4">Agrega tus suscripciones para controlar gastos recurrentes</p>
          <button onClick={openAdd} className="group flex items-center gap-2 px-4 py-2 bg-fin-green text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-all duration-200">
            <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
            Agregar suscripción
          </button>
        </div>
      )}

      {subs.length > 0 && (
        <div className="space-y-3">
          {subs.map(sub => (
            <div key={sub.id} className={`bg-white rounded-2xl border p-4 shadow-fin-card transition-all group ${sub.paymentStatus === 'overdue' && sub.active ? 'border-red-200' : sub.active ? 'border-fin-border' : 'border-gray-100 opacity-60'}`}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: '#EDE9FE' }}>{sub.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-manrope font-700 text-fin-text">{sub.name}</p>
                    {statusBadge(sub)}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-fin-muted">{sub.category}</span>
                    {sub.nextPaymentDate && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span className={`text-xs font-medium ${sub.paymentStatus === 'overdue' ? 'text-red-500' : 'text-fin-muted'}`}>
                          Pago: {formatDate(sub.nextPaymentDate)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-sm font-manrope font-700 text-fin-text mr-1">S/ {sub.amount.toFixed(2)}</span>
                  {sub.active && (sub.paymentStatus === 'pending' || sub.paymentStatus === 'overdue') && (
                    <button
                      onClick={() => handleMarkPaid(sub)}
                      disabled={markingPaid === sub.id}
                      title="Marcar como pagado"
                      className="group p-1.5 rounded-lg hover:bg-green-50 transition-all duration-150 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors" strokeWidth={1.75} />
                    </button>
                  )}
                  <button onClick={() => toggleSub(sub.id)} className={`group p-1.5 rounded-lg transition-all duration-150 ${sub.active ? 'hover:bg-amber-50' : 'hover:bg-green-50'}`}>
                    {sub.active
                      ? <ToggleRight className="w-4 h-4 text-green-500 group-hover:text-amber-500 transition-colors" strokeWidth={1.75} />
                      : <ToggleLeft className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors" strokeWidth={1.75} />}
                  </button>
                  <button onClick={() => openEdit(sub)} className="group p-1.5 rounded-lg hover:bg-gray-100 transition-all duration-150">
                    <Pencil className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-700 transition-colors" strokeWidth={1.75} />
                  </button>
                  <button onClick={() => handleDelete(sub.id)} className="group p-1.5 rounded-lg hover:bg-red-50 transition-all duration-150">
                    <Trash2 className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-500 transition-colors" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative bg-[#FAFAF8] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] flex flex-col max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b-[3px] border-black">
              <h2 className="font-black text-black text-lg">{editingSub ? 'Editar suscripción' : 'Nueva suscripción'}</h2>
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
                <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">Servicio</label>
                <SubscriptionServicePicker
                  value={form.name}
                  onChange={({ name, category, icon }) => {
                    setForm(f => ({ ...f, name, category, icon }));
                  }}
                />
              </div>

              {/* Category — auto-filled but editable */}
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">Categoría</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-4 py-3 bg-white rounded-xl border-[2.5px] border-black text-sm font-bold text-black outline-none focus:ring-2 focus:ring-[#FFD43B] transition-all"
                >
                  {SUB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">Monto mensual</label>
                <div className="flex items-center gap-2 px-4 py-3 bg-white rounded-xl border-[2.5px] border-black focus-within:ring-2 focus-within:ring-[#FFD43B] transition-all">
                  <span className="text-black font-black text-sm">S/</span>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="flex-1 bg-transparent text-sm font-black text-black outline-none"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">Fecha de pago mensual</label>
                <input
                  type="date"
                  value={form.nextPaymentDate}
                  onChange={e => setForm(f => ({ ...f, nextPaymentDate: e.target.value }))}
                  className="w-full px-4 py-3 bg-white rounded-xl border-[2.5px] border-black text-sm font-bold text-black outline-none focus:ring-2 focus:ring-[#FFD43B] transition-all"
                />
                <p className="text-xs font-medium text-gray-500 mt-1">El día del mes se usará para los cobros recurrentes</p>
              </div>

              {formError && <p role="alert" className="text-sm font-semibold text-red-600">{formError}</p>}

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
