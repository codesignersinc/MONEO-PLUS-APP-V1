'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, X, Pencil, Trash2, Clock, CheckCircle2, Calendar, RefreshCw } from 'lucide-react';

interface PagoEntry {
  id: string;
  name: string;
  amount: number;
  category: string;
  categoryIcon: string;
  paymentDate: string;
  notes: string;
  status: 'pendiente' | 'pagado' | 'vencido';
  isRecurring: boolean;
  paymentDay: number | null;
}

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

async function getAll(): Promise<PagoEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pagos')
    .select('*')
    .order('payment_date', { ascending: true });
  if (error) return [];
  return (data || []).map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
    category: r.category,
    categoryIcon: r.category_icon,
    paymentDate: r.payment_date,
    notes: r.notes || '',
    status: r.status,
    isRecurring: r.is_recurring,
    paymentDay: r.payment_day,
  }));
}

async function createPago(entry: Omit<PagoEntry, 'id'>): Promise<PagoEntry | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('pagos')
    .insert({
      user_id: user.id,
      name: entry.name,
      amount: entry.amount,
      category: entry.category,
      category_icon: entry.categoryIcon,
      payment_date: entry.paymentDate,
      notes: entry.notes,
      status: entry.status,
      is_recurring: entry.isRecurring,
      payment_day: entry.paymentDay,
    })
    .select()
    .single();
  if (error) return null;

  // If created as 'pagado', sync to movimientos immediately
  if (entry.status === 'pagado') {
    try {
      await supabase.from('transactions').insert({
        user_id: user.id,
        name: entry.name,
        category: entry.category,
        category_icon: entry.categoryIcon,
        account_name: 'Pagos',
        amount: -Math.abs(entry.amount),
        transaction_date: entry.paymentDate || new Date().toISOString().split('T')[0],
        transaction_time: new Date().toTimeString().slice(0, 5),
        transaction_type: 'gasto',
        notes: entry.notes || '',
      });
    } catch (_) {
      // Non-blocking
    }
  }

  return {
    id: data.id,
    name: data.name,
    amount: data.amount,
    category: data.category,
    categoryIcon: data.category_icon,
    paymentDate: data.payment_date,
    notes: data.notes,
    status: data.status,
    isRecurring: data.is_recurring,
    paymentDay: data.payment_day,
  };
}

async function updatePago(id: string, entry: Partial<PagoEntry>): Promise<void> {
  const supabase = createClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (entry.name !== undefined) updates.name = entry.name;
  if (entry.amount !== undefined) updates.amount = entry.amount;
  if (entry.category !== undefined) updates.category = entry.category;
  if (entry.categoryIcon !== undefined) updates.category_icon = entry.categoryIcon;
  if (entry.paymentDate !== undefined) updates.payment_date = entry.paymentDate;
  if (entry.notes !== undefined) updates.notes = entry.notes;
  if (entry.status !== undefined) updates.status = entry.status;
  if (entry.isRecurring !== undefined) updates.is_recurring = entry.isRecurring;
  if (entry.paymentDay !== undefined) updates.payment_day = entry.paymentDay;
  await supabase.from('pagos').update(updates).eq('id', id);
}

async function deletePago(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from('pagos').delete().eq('id', id);
}

function getNextMonthDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const next = new Date(year, month, day); // month is already 0-indexed after +1
  return next.toISOString().split('T')[0];
}

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

  useEffect(() => {
    getAll().then((data) => {
      // Auto-detect overdue
      const today = new Date().toISOString().split('T')[0];
      const updated = data.map((e) => {
        if (e.status === 'pendiente' && e.paymentDate && e.paymentDate < today) {
          return { ...e, status: 'vencido' as const };
        }
        return e;
      });
      setEntries(updated);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = entries.filter((e) => {
    if (filterStatus === 'todos') return true;
    if (filterStatus === 'pendiente') return e.status === 'pendiente' || e.status === 'vencido';
    return e.status === 'pagado';
  });

  const totalPendiente = entries.filter((e) => e.status === 'pendiente' || e.status === 'vencido').reduce((s, e) => s + e.amount, 0);
  const totalPagado = entries.filter((e) => e.status === 'pagado').reduce((s, e) => s + e.amount, 0);

  const openAdd = () => {
    setEditingEntry(null);
    setForm(defaultForm);
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
    setShowForm(true);
  };

  const handleCategoryChange = (label: string) => {
    const cat = PAGO_CATEGORIES.find((c) => c.label === label);
    setForm((f) => ({ ...f, category: label, categoryIcon: cat?.icon || '📦' }));
  };

  const handleSave = async () => {
    if (!form.name || !form.amount) return;
    setSaving(true);
    try {
      const payDay = form.isRecurring && form.paymentDate
        ? parseInt(form.paymentDate.split('-')[2])
        : null;

      const entryData: Omit<PagoEntry, 'id'> = {
        name: form.name,
        amount: parseFloat(form.amount) || 0,
        category: form.category,
        categoryIcon: form.categoryIcon,
        paymentDate: form.paymentDate,
        notes: form.notes,
        status: form.status,
        isRecurring: form.isRecurring,
        paymentDay: payDay,
      };
      if (editingEntry) {
        await updatePago(editingEntry.id, entryData);
        setEntries((prev) => prev.map((e) => (e.id === editingEntry.id ? { ...e, ...entryData } : e)));
      } else {
        const created = await createPago(entryData);
        if (created) setEntries((prev) => [...prev, created]);
      }
      setShowForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deletePago(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleMarkPagado = async (entry: PagoEntry) => {
    if (entry.status === 'pagado') {
      // Revert to pendiente
      await updatePago(entry.id, { status: 'pendiente' });
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, status: 'pendiente' } : e)));
      return;
    }
    // Mark as paid
    await updatePago(entry.id, { status: 'pagado' });
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, status: 'pagado' } : e)));

    // Sync to movimientos (transactions table)
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('transactions').insert({
          user_id: user.id,
          name: entry.name,
          category: entry.category,
          category_icon: entry.categoryIcon,
          account_name: 'Pagos',
          amount: -Math.abs(entry.amount),
          transaction_date: entry.paymentDate || new Date().toISOString().split('T')[0],
          transaction_time: new Date().toTimeString().slice(0, 5),
          transaction_type: 'gasto',
          notes: entry.notes || '',
        });
      }
    } catch (_) {
      // Non-blocking
    }

    // If recurring, create next month's entry
    if (entry.isRecurring && entry.paymentDate) {
      const nextDate = getNextMonthDate(entry.paymentDate);
      const nextEntry: Omit<PagoEntry, 'id'> = {
        name: entry.name,
        amount: entry.amount,
        category: entry.category,
        categoryIcon: entry.categoryIcon,
        paymentDate: nextDate,
        notes: entry.notes,
        status: 'pendiente',
        isRecurring: true,
        paymentDay: entry.paymentDay,
      };
      const created = await createPago(nextEntry);
      if (created) setEntries((prev) => [...prev, created]);
    }
  };

  const handleSaveAmount = async (entry: PagoEntry) => {
    const newAmount = parseFloat(editAmountValue);
    if (!isNaN(newAmount) && newAmount > 0) {
      await updatePago(entry.id, { amount: newAmount });
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, amount: newAmount } : e)));
    }
    setEditAmountId(null);
    setEditAmountValue('');
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const [year, month, day] = dateStr.split('-');
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
  };

  const isOverdue = (dateStr: string, status: string) => {
    if (!dateStr || status === 'pagado') return false;
    const today = new Date().toISOString().split('T')[0];
    return dateStr < today;
  };

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-manrope font-800 text-fin-text">Pagos</h1>
        <button
          onClick={openAdd}
          className="group flex items-center gap-2 px-3 py-2 bg-fin-green text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-all duration-200"
        >
          <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
          Agregar pago
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
            <p className="text-xs text-gray-500 font-medium">Por pagar</p>
          </div>
          <p className="text-xl font-bold text-amber-600">S/ {totalPendiente.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{entries.filter((e) => e.status === 'pendiente' || e.status === 'vencido').length} pagos</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" strokeWidth={1.75} />
            <p className="text-xs text-gray-500 font-medium">Pagado</p>
          </div>
          <p className="text-xl font-bold text-green-700">S/ {totalPagado.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{entries.filter((e) => e.status === 'pagado').length} pagos</p>
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
                ? 'bg-fin-green text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f === 'todos' ? 'Todos' : f === 'pendiente' ? 'Por pagar' : 'Pagados'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-fin-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-4xl mb-3">💳</p>
          <p className="text-fin-muted font-medium mb-1">Sin pagos registrados</p>
          <p className="text-xs text-fin-muted mb-4">Registra tus pagos y su fecha de vencimiento</p>
          <button
            onClick={openAdd}
            className="px-5 py-2.5 bg-fin-green text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors"
          >
            Agregar pago
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-fin-border shadow-fin-card overflow-hidden">
          {filtered.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors group ${
                i < filtered.length - 1 ? 'border-b border-gray-50' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                {entry.categoryIcon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-semibold truncate ${entry.status === 'pagado' ? 'text-gray-400 line-through' : 'text-fin-text'}`}>
                    {entry.name}
                  </p>
                  {entry.isRecurring && (
                    <RefreshCw className="w-3 h-3 text-blue-400 flex-shrink-0" strokeWidth={2} />
                  )}
                  {entry.status === 'pagado' && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold shrink-0">Pagado</span>
                  )}
                  {isOverdue(entry.paymentDate, entry.status) && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-semibold shrink-0">Vencido</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-fin-muted">{entry.category}</span>
                  {entry.paymentDate && (
                    <span className="flex items-center gap-1 text-xs text-fin-muted">
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
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAmount(entry); if (e.key === 'Escape') { setEditAmountId(null); setEditAmountValue(''); } }}
                      className="w-20 px-2 py-1 border-[2px] border-black rounded-lg text-sm font-bold text-fin-text outline-none text-right"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditAmountId(entry.id); setEditAmountValue(String(entry.amount)); }}
                    className="text-sm font-manrope font-700 text-fin-text hover:text-blue-600 transition-colors"
                    title="Clic para editar monto"
                  >
                    -S/ {entry.amount.toFixed(2)}
                  </button>
                )}
                <div className="hidden group-hover:flex items-center gap-1 ml-1">
                  <button
                    onClick={() => handleMarkPagado(entry)}
                    title={entry.status === 'pagado' ? 'Marcar pendiente' : 'Marcar pagado'}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-50 transition-colors"
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${entry.status === 'pagado' ? 'text-green-500' : 'text-gray-400 hover:text-green-600'}`} strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={() => openEdit(entry)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-gray-400 hover:text-blue-600 transition-colors" strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500 transition-colors" strokeWidth={1.75} />
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
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Descripción</label>
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
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Monto (S/)</label>
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
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Categoría</label>
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
                      <span className="text-[10px] leading-tight text-center text-black">{cat.label}</span>
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
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Tipo de pago</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, isRecurring: false }))}
                    className={`flex-1 py-2.5 rounded-xl border-[2px] text-sm font-semibold transition-all ${
                      !form.isRecurring ? 'border-black bg-[#FFD93D] text-black' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    💳 Único
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, isRecurring: true }))}
                    className={`flex-1 py-2.5 rounded-xl border-[2px] text-sm font-semibold transition-all ${
                      form.isRecurring ? 'border-black bg-[#4ADE80] text-black' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    🔄 Recurrente
                  </button>
                </div>
                {form.isRecurring && (
                  <p className="text-[11px] text-black mt-1.5">
                    Al marcar como pagado, se generará automáticamente el próximo mes en la misma fecha. Puedes cambiar el monto en cada ocasión.
                  </p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Estado</label>
                <div className="flex gap-2">
                  {(['pendiente', 'pagado'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, status: s }))}
                      className={`flex-1 py-2.5 rounded-xl border-[2px] text-sm font-semibold transition-all ${
                        form.status === s
                          ? s === 'pagado'
                            ? 'border-black bg-[#4ADE80] text-black' :'border-black bg-[#FFD93D] text-black' :'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {s === 'pendiente' ? '⏳ Pendiente' : '✅ Pagado'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Notas (opcional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Detalles adicionales..."
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-50 border-[2px] border-gray-200 rounded-xl text-sm text-black placeholder-gray-400 outline-none focus:border-black transition-colors resize-none"
                />
              </div>
            </div>

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
    </div>
  );
}
