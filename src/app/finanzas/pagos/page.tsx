'use client';
import React, { useState, useEffect, useCallback } from 'react';
import LoadError from '@/components/ui/LoadError';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';
import { pagosService, type NewPago, type PagoEntry } from '@/lib/supabaseObligations';
import { AccountPickerModal } from '@/components/finance/AccountAmountPicker';
import { todayLocal } from '@/lib/dates';
import { Plus, X, Pencil, Trash2, Clock, CheckCircle2, Calendar, RefreshCw } from 'lucide-react';

interface PagoForm {
  name: string;
  amount: string;
  category: string;
  categoryIcon: string;
  paymentDate: string;
  notes: string;
  status: 'pendiente' | 'pagado';
  isRecurring: boolean;
}

const PAGO_CATEGORIES = [
  { label: 'Servicios', icon: '💡' },
  { label: 'Alquiler', icon: '🏠' },
  { label: 'Alimentación', icon: '🛒' },
  { label: 'Transporte', icon: '🚗' },
  { label: 'Salud', icon: '💊' },
  { label: 'Educación', icon: '📚' },
  { label: 'Entretenimiento', icon: '🎬' },
  { label: 'Otro', icon: '📦' },
];

const defaultForm: PagoForm = {
  name: '',
  amount: '',
  category: 'Servicios',
  categoryIcon: '💡',
  paymentDate: '',
  notes: '',
  status: 'pendiente',
  isRecurring: false,
};

export default function PagosPage() {
  const [entries, setEntries] = useState<PagoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PagoEntry | null>(null);
  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendiente' | 'pagado'>('todos');
  const [form, setForm] = useState<PagoForm>(defaultForm);
  const [editAmountId, setEditAmountId] = useState<string | null>(null);
  const [editAmountValue, setEditAmountValue] = useState('');
  const [loadError, setLoadError] = useState<unknown>(null);
  const [formError, setFormError] = useState('');
  // Payment waiting for the user to choose the account it is paid from.
  const [picking, setPicking] = useState<PagoEntry | null>(null);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    pagosService
      .getAll()
      .then((data) => {
        // Auto-detect overdue (display only; never stored)
        const today = todayLocal();
        const updated = data.map((e) => {
          if (e.status === 'pendiente' && e.paymentDate && e.paymentDate < today) {
            return { ...e, status: 'vencido' as const };
          }
          return e;
        });
        setEntries(updated);
      })
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = entries.filter((e) => {
    if (filterStatus === 'todos') return true;
    if (filterStatus === 'pendiente') return e.status === 'pendiente' || e.status === 'vencido';
    return e.status === 'pagado';
  });

  const totalPendiente = entries
    .filter((e) => e.status === 'pendiente' || e.status === 'vencido')
    .reduce((s, e) => s + e.amount, 0);
  const totalPagado = entries
    .filter((e) => e.status === 'pagado')
    .reduce((s, e) => s + e.amount, 0);

  const openAdd = () => {
    setEditingEntry(null);
    setForm(defaultForm);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (entry: PagoEntry) => {
    setEditingEntry(entry);
    setForm({
      name: entry.name,
      amount: String(entry.amount),
      category: entry.category,
      categoryIcon: entry.categoryIcon,
      paymentDate: entry.paymentDate,
      notes: entry.notes,
      status: entry.status === 'vencido' ? 'pendiente' : entry.status,
      isRecurring: entry.isRecurring,
    });
    setFormError('');
    setShowForm(true);
  };

  const handleCategoryChange = (label: string) => {
    const cat = PAGO_CATEGORIES.find((c) => c.label === label);
    setForm((f) => ({ ...f, category: label, categoryIcon: cat?.icon || '📦' }));
  };

  const handleSave = async () => {
    if (!form.name || !form.amount) return;
    setSaving(true);
    setFormError('');
    try {
      const payDay =
        form.isRecurring && form.paymentDate ? parseInt(form.paymentDate.split('-')[2]) : null;

      const entryData: NewPago = {
        name: form.name,
        amount: parseFloat(form.amount) || 0,
        category: form.category,
        categoryIcon: form.categoryIcon,
        paymentDate: form.paymentDate,
        notes: form.notes,
        isRecurring: form.isRecurring,
        paymentDay: payDay,
      };
      if (editingEntry) {
        // Editing a paid entry also updates its movement (database trigger).
        await pagosService.update(editingEntry.id, entryData);
        const updated = { ...editingEntry, ...entryData };
        setEntries((prev) => prev.map((e) => (e.id === editingEntry.id ? updated : e)));
        const wasPaid = editingEntry.status === 'pagado';
        if (wasPaid && form.status === 'pendiente') {
          await pagosService.markPending(editingEntry.id);
          load();
        } else if (!wasPaid && form.status === 'pagado') {
          setPicking(updated);
        }
      } else {
        const created = await pagosService.create(entryData);
        setEntries((prev) => [...prev, created]);
        if (form.status === 'pagado') setPicking(created);
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
      await pagosService.delete(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      toast.showError(err);
    }
  };

  // Paying asks for the account; going back to pending deletes its movement.
  const handleMarkPagado = async (entry: PagoEntry) => {
    if (entry.status !== 'pagado') {
      setPicking(entry);
      return;
    }
    try {
      await pagosService.markPending(entry.id);
      load();
    } catch (err) {
      toast.showError(err);
    }
  };

  // The database records the expense, moves the balance and, for a recurring
  // payment, creates next month's one; reload to show it.
  const confirmPaid = async (accountId: string, accountAmount?: number) => {
    if (!picking) return;
    await pagosService.markPaid(picking.id, accountId, accountAmount);
    setPicking(null);
    load();
  };

  const handleSaveAmount = async (entry: PagoEntry) => {
    const newAmount = parseFloat(editAmountValue);
    if (!isNaN(newAmount) && newAmount > 0) {
      try {
        await pagosService.update(entry.id, { amount: newAmount });
      } catch (err) {
        // Keep the inline editor open so the user can retry.
        toast.showError(err);
        return;
      }
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, amount: newAmount } : e)));
    }
    setEditAmountId(null);
    setEditAmountValue('');
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const [year, month, day] = dateStr.split('-');
    const months = [
      'ene',
      'feb',
      'mar',
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sep',
      'oct',
      'nov',
      'dic',
    ];
    return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
  };

  const isOverdue = (dateStr: string, status: string) => {
    if (!dateStr || status === 'pagado') return false;
    const today = todayLocal();
    return dateStr < today;
  };

  if (loadError) {
    return (
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-black text-black mb-5 leading-tight">Pagos</h1>
        <LoadError what="tus pagos" error={loadError} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-3xl font-black text-black leading-tight">Pagos</h1>
        <button
          onClick={openAdd}
          className="group flex items-center gap-2 px-3 py-2 bg-[#FFD43B] text-sm rounded-xl transition-all duration-200 text-black font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
        >
          <Plus
            className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90"
            strokeWidth={2.5}
          />
          Agregar pago
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-3xl border-[3px] border-black p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
            <p className="text-xs text-gray-500 font-medium">Por pagar</p>
          </div>
          <p className="text-[2rem] leading-tight font-black tabular-nums break-words text-amber-600">
            S/ {totalPendiente.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {entries.filter((e) => e.status === 'pendiente' || e.status === 'vencido').length} pagos
          </p>
        </div>
        <div className="bg-white rounded-3xl border-[3px] border-black p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" strokeWidth={1.75} />
            <p className="text-xs text-gray-500 font-medium">Pagado</p>
          </div>
          <p className="text-[2rem] leading-tight font-black tabular-nums break-words text-green-700">
            S/ {totalPagado.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {entries.filter((e) => e.status === 'pagado').length} pagos
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['todos', 'pendiente', 'pagado'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
              filterStatus === f
                ? 'bg-[#FFD43B] text-black border-[2px] border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                : 'bg-white border-[2px] border-black text-black hover:bg-gray-50'
            }`}
          >
            {f === 'todos' ? 'Todos' : f === 'pendiente' ? 'Por pagar' : 'Pagados'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#FFD43B] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-4xl mb-3">💳</p>
          <p className="text-gray-500 font-medium mb-1">Sin pagos registrados</p>
          <p className="text-xs text-gray-500 mb-4">Registra tus pagos y su fecha de vencimiento</p>
          <button
            onClick={openAdd}
            className="px-5 py-2.5 bg-[#FFD43B] text-sm rounded-xl transition-colors text-black font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
          >
            Agregar pago
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border-[3px] border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] overflow-hidden">
          {filtered.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors group ${
                i < filtered.length - 1 ? 'border-b border-gray-50' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-white border-[2px] border-black flex items-center justify-center text-lg flex-shrink-0">
                {entry.categoryIcon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p
                    className={`text-sm font-semibold truncate ${entry.status === 'pagado' ? 'text-gray-400 line-through' : 'text-black'}`}
                  >
                    {entry.name}
                  </p>
                  {entry.isRecurring && (
                    <RefreshCw className="w-3 h-3 text-blue-400 flex-shrink-0" strokeWidth={2} />
                  )}
                  {entry.status === 'pagado' && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold shrink-0">
                      Pagado
                    </span>
                  )}
                  {isOverdue(entry.paymentDate, entry.status) && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-semibold shrink-0">
                      Vencido
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs px-2 py-0.5 rounded-full text-gray-500 bg-white border-[1.5px] border-black font-bold">
                    {entry.category}
                  </span>
                  {entry.paymentDate && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" strokeWidth={1.75} />
                      {formatDate(entry.paymentDate)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0 flex items-center gap-2">
                {editAmountId === entry.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">S/</span>
                    <input
                      type="number"
                      value={editAmountValue}
                      onChange={(e) => setEditAmountValue(e.target.value)}
                      onBlur={() => handleSaveAmount(entry)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveAmount(entry);
                        if (e.key === 'Escape') {
                          setEditAmountId(null);
                          setEditAmountValue('');
                        }
                      }}
                      className="w-20 px-2 py-1 border-[2px] border-black rounded-lg text-sm font-bold text-black outline-none text-right"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditAmountId(entry.id);
                      setEditAmountValue(String(entry.amount));
                    }}
                    className="text-sm font-black text-black hover:text-blue-600 transition-colors"
                    title="Clic para editar monto"
                  >
                    -S/ {entry.amount.toFixed(2)}
                  </button>
                )}
                <div className="hidden group-hover:flex items-center gap-1 ml-1">
                  <button
                    onClick={() => handleMarkPagado(entry)}
                    title={entry.status === 'pagado' ? 'Marcar pendiente' : 'Marcar pagado'}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border-[2px] border-black bg-white hover:bg-green-50 transition-colors"
                  >
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${entry.status === 'pagado' ? 'text-green-500' : 'text-black'}`}
                      strokeWidth={1.75}
                    />
                  </button>
                  <button
                    onClick={() => openEdit(entry)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border-[2px] border-black bg-white hover:bg-gray-100 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-black" strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border-[2px] border-black bg-white hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-black" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b-[3px] border-black">
              <h2 className="text-lg font-black text-black">
                {editingEntry ? 'Editar pago' : 'Nuevo pago'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-black" strokeWidth={2} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">
                  Descripción
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Luz, Agua, Internet..."
                  className="w-full px-4 py-3 bg-gray-50 border-[2px] border-gray-200 rounded-xl text-sm text-black placeholder-gray-400 outline-none focus:border-black transition-colors"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">
                  Monto (S/)
                </label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 bg-gray-50 border-[2px] border-gray-200 rounded-xl text-sm text-black placeholder-gray-400 outline-none focus:border-black transition-colors"
                />
                {form.isRecurring && (
                  <p className="text-[11px] text-blue-500 mt-1 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" strokeWidth={2} />
                    Puedes cambiar el monto en cada pago haciendo clic en el monto
                  </p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">
                  Categoría
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PAGO_CATEGORIES.map((cat) => (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => handleCategoryChange(cat.label)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border-[2px] transition-all text-xs font-semibold ${
                        form.category === cat.label
                          ? 'border-black bg-[#FFD93D]'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-lg">{cat.icon}</span>
                      <span className="text-[10px] leading-tight text-center text-black">
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fecha de pago */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">
                  Fecha de pago
                </label>
                <input
                  type="date"
                  value={form.paymentDate}
                  onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border-[2px] border-gray-200 rounded-xl text-sm text-black outline-none focus:border-black transition-colors"
                />
              </div>

              {/* Recurrente */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">
                  Tipo de pago
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, isRecurring: false }))}
                    className={`flex-1 py-2.5 rounded-xl border-[2px] text-sm font-semibold transition-all ${
                      !form.isRecurring
                        ? 'border-black bg-[#FFD93D] text-black'
                        : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    💳 Único
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, isRecurring: true }))}
                    className={`flex-1 py-2.5 rounded-xl border-[2px] text-sm font-semibold transition-all ${
                      form.isRecurring
                        ? 'border-black bg-[#4ADE80] text-black'
                        : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    🔄 Recurrente
                  </button>
                </div>
                {form.isRecurring && (
                  <p className="text-[11px] text-black mt-1.5">
                    Al marcar como pagado, se generará automáticamente el próximo mes en la misma
                    fecha. Puedes cambiar el monto en cada ocasión.
                  </p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">
                  Estado
                </label>
                <div className="flex gap-2">
                  {(['pendiente', 'pagado'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, status: s }))}
                      className={`flex-1 py-2.5 rounded-xl border-[2px] text-sm font-semibold transition-all ${
                        form.status === s
                          ? s === 'pagado'
                            ? 'border-black bg-[#4ADE80] text-black'
                            : 'border-black bg-[#FFD93D] text-black'
                          : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {s === 'pendiente' ? '⏳ Pendiente' : '✅ Pagado'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">
                  Notas (opcional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Detalles adicionales..."
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 border-[2px] border-gray-200 rounded-xl text-sm text-black placeholder-gray-400 outline-none focus:border-black transition-colors resize-none"
                />
              </div>
            </div>

            {formError && (
              <p role="alert" className="px-6 pb-3 text-sm font-semibold text-red-600">
                {formError}
              </p>
            )}

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl border-[2px] border-gray-300 text-sm font-semibold text-black hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.amount}
                className="flex-1 py-3 rounded-xl border-[2px] border-black bg-[#FFD93D] text-sm font-black text-black hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                {saving ? 'Guardando...' : editingEntry ? 'Actualizar' : 'Guardar pago'}
              </button>
            </div>
          </div>
        </div>
      )}
      {picking && (
        <AccountPickerModal
          title={`¿Desde qué cuenta pagaste «${picking.name}»?`}
          amount={picking.amount}
          confirmLabel="Marcar pagado"
          onConfirm={confirmPaid}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}
