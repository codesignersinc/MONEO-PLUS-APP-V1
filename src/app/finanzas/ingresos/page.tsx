'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import LoadError from '@/components/ui/LoadError';
import { useToast } from '@/components/ui/Toast';
import { assertAffected, authRequired, getErrorMessage, toDataError } from '@/lib/dataError';
import { Plus, X, Pencil, Trash2, Clock, CheckCircle2, Calendar } from 'lucide-react';

interface IncomeEntry {
  id: string;
  name: string;
  amount: number;
  category: string;
  categoryIcon: string;
  collectionDate: string;
  notes: string;
  status: 'pendiente' | 'cobrado';
}

interface IncomeForm {
  name: string;
  amount: string;
  category: string;
  categoryIcon: string;
  collectionDate: string;
  notes: string;
  status: 'pendiente' | 'cobrado';
}

const INCOME_CATEGORIES = [
  { label: 'Salario', icon: '💼' },
  { label: 'Freelance', icon: '💻' },
  { label: 'Negocio', icon: '🏪' },
  { label: 'Inversión', icon: '📈' },
  { label: 'Alquiler', icon: '🏠' },
  { label: 'Bono', icon: '🎁' },
  { label: 'Comisión', icon: '🤝' },
  { label: 'Otro', icon: '💰' },
];

const defaultForm: IncomeForm = {
  name: '',
  amount: '',
  category: 'Salario',
  categoryIcon: '💼',
  collectionDate: '',
  notes: '',
  status: 'pendiente',
};

const SYNC_WARNING = 'El ingreso se guardó, pero no se pudo registrar en Movimientos.';

// All helpers throw a DataError on failure; [] only means "no income entries".
async function getAll(): Promise<IncomeEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('income_entries')
    .select('*')
    .order('collection_date', { ascending: true });
  if (error) throw toDataError(error);
  return (data || []).map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount,
    category: r.category,
    categoryIcon: r.category_icon,
    collectionDate: r.collection_date,
    notes: r.notes || '',
    status: r.status,
  }));
}

// Resolves with the saved entry plus whether the follow-up sync to `transactions`
// failed (the entry itself is saved either way).
async function createEntry(
  entry: Omit<IncomeEntry, 'id'>
): Promise<{ entry: IncomeEntry; syncFailed: boolean }> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw toDataError(authError);
  if (!user) throw authRequired();
  const { data, error } = await supabase
    .from('income_entries')
    .insert({
      user_id: user.id,
      name: entry.name,
      amount: entry.amount,
      category: entry.category,
      category_icon: entry.categoryIcon,
      collection_date: entry.collectionDate,
      notes: entry.notes,
      status: entry.status,
    })
    .select()
    .single();
  if (error) throw toDataError(error);

  // Only sync to transactions (movimientos) if already cobrado
  let syncFailed = false;
  if (entry.status === 'cobrado') {
    const { error: syncError } = await supabase.from('transactions').insert({
        user_id: user.id,
        name: entry.name,
        category: entry.category,
        category_icon: entry.categoryIcon,
        account_name: 'Ingresos',
        amount: Math.abs(entry.amount),
        transaction_date: entry.collectionDate || new Date().toISOString().split('T')[0],
        transaction_time: new Date().toTimeString().slice(0, 5),
        transaction_type: 'ingreso',
        notes: entry.notes || '',
    });
    if (syncError) {
      console.error('income → transactions sync failed:', syncError);
      syncFailed = true;
    }
  }

  return {
    entry: { id: data.id, name: data.name, amount: data.amount, category: data.category, categoryIcon: data.category_icon, collectionDate: data.collection_date, notes: data.notes, status: data.status },
    syncFailed,
  };
}

async function updateEntry(id: string, entry: Partial<IncomeEntry>): Promise<void> {
  const supabase = createClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (entry.name !== undefined) updates.name = entry.name;
  if (entry.amount !== undefined) updates.amount = entry.amount;
  if (entry.category !== undefined) updates.category = entry.category;
  if (entry.categoryIcon !== undefined) updates.category_icon = entry.categoryIcon;
  if (entry.collectionDate !== undefined) updates.collection_date = entry.collectionDate;
  if (entry.notes !== undefined) updates.notes = entry.notes;
  if (entry.status !== undefined) updates.status = entry.status;
  const { data, error } = await supabase.from('income_entries').update(updates).eq('id', id).select('id');
  if (error) throw toDataError(error);
  assertAffected(data);
}

async function deleteEntry(id: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.from('income_entries').delete().eq('id', id).select('id');
  if (error) throw toDataError(error);
  assertAffected(data);
}

export default function IngresosPage() {
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<IncomeEntry | null>(null);
  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendiente' | 'cobrado'>('todos');
  const [form, setForm] = useState<IncomeForm>(defaultForm);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [formError, setFormError] = useState('');
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getAll().then(setEntries).catch(setLoadError).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = entries.filter((e) => filterStatus === 'todos' || e.status === filterStatus);

  const totalPendiente = entries.filter((e) => e.status === 'pendiente').reduce((s, e) => s + e.amount, 0);
  const totalCobrado = entries.filter((e) => e.status === 'cobrado').reduce((s, e) => s + e.amount, 0);

  const openAdd = () => {
    setEditingEntry(null);
    setForm(defaultForm);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (entry: IncomeEntry) => {
    setEditingEntry(entry);
    setForm({
      name: entry.name,
      amount: String(entry.amount),
      category: entry.category,
      categoryIcon: entry.categoryIcon,
      collectionDate: entry.collectionDate,
      notes: entry.notes,
      status: entry.status,
    });
    setFormError('');
    setShowForm(true);
  };

  const handleCategoryChange = (label: string) => {
    const cat = INCOME_CATEGORIES.find((c) => c.label === label);
    setForm((f) => ({ ...f, category: label, categoryIcon: cat?.icon || '💰' }));
  };

  const handleSave = async () => {
    if (!form.name || !form.amount) return;
    setSaving(true);
    setFormError('');
    try {
      const entryData: Omit<IncomeEntry, 'id'> = {
        name: form.name,
        amount: parseFloat(form.amount) || 0,
        category: form.category,
        categoryIcon: form.categoryIcon,
        collectionDate: form.collectionDate,
        notes: form.notes,
        status: form.status,
      };
      if (editingEntry) {
        await updateEntry(editingEntry.id, entryData);
        setEntries((prev) => prev.map((e) => (e.id === editingEntry.id ? { ...e, ...entryData } : e)));
      } else {
        const { entry: created, syncFailed } = await createEntry(entryData);
        setEntries((prev) => [...prev, created]);
        if (syncFailed) toast.showError(SYNC_WARNING);
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
      await deleteEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      toast.showError(err);
    }
  };

  const handleMarkCobrado = async (entry: IncomeEntry) => {
    const newStatus = entry.status === 'cobrado' ? 'pendiente' : 'cobrado';
    try {
      await updateEntry(entry.id, { status: newStatus });
    } catch (err) {
      toast.showError(err);
      return;
    }
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, status: newStatus } : e)));

    // Create or delete transaction as needed
    const syncWarning =
      newStatus === 'cobrado'
        ? SYNC_WARNING
        : 'El ingreso volvió a pendiente, pero no se pudo actualizar Movimientos.';
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw toDataError(authError);
      if (!user) throw authRequired();

      if (newStatus === 'cobrado') {
        // Create transaction
        const { error } = await supabase.from('transactions').insert({
          user_id: user.id,
          name: entry.name,
          category: entry.category,
          category_icon: entry.categoryIcon,
          account_name: 'Ingresos',
          amount: Math.abs(entry.amount),
          transaction_date: entry.collectionDate || new Date().toISOString().split('T')[0],
          transaction_time: new Date().toTimeString().slice(0, 5),
          transaction_type: 'ingreso',
          notes: entry.notes || '',
        });
        if (error) throw toDataError(error);
      } else {
        // Delete transaction by matching name+amount+type
        // NOTE: known data-loss bug (audit C-08) — fixed separately, unchanged here.
        const { error } = await supabase
          .from('transactions')
          .delete()
          .match({
            name: entry.name,
            amount: Math.abs(entry.amount),
            transaction_type: 'ingreso',
          });
        if (error) throw toDataError(error);
      }
    } catch (err) {
      console.error(err);
      toast.showError(syncWarning);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const [year, month, day] = dateStr.split('-');
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
  };

  const isOverdue = (dateStr: string, status: string) => {
    if (!dateStr || status === 'cobrado') return false;
    const today = new Date().toISOString().split('T')[0];
    return dateStr < today;
  };

  if (loadError) {
    return (
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-manrope font-800 text-fin-text mb-5">Ingresos</h1>
        <LoadError what="tus ingresos" error={loadError} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-manrope font-800 text-fin-text">Ingresos</h1>
        <button
          onClick={openAdd}
          className="group flex items-center gap-2 px-3 py-2 bg-fin-green text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-all duration-200"
        >
          <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
          Agregar ingreso
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
            <p className="text-xs text-gray-500 font-medium">Por cobrar</p>
          </div>
          <p className="text-xl font-bold text-amber-600">S/ {totalPendiente.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{entries.filter((e) => e.status === 'pendiente').length} ingresos</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" strokeWidth={1.75} />
            <p className="text-xs text-gray-500 font-medium">Cobrado</p>
          </div>
          <p className="text-xl font-bold text-green-700">S/ {totalCobrado.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{entries.filter((e) => e.status === 'cobrado').length} ingresos</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['todos', 'pendiente', 'cobrado'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
              filterStatus === f
                ? 'bg-fin-green text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f === 'todos' ? 'Todos' : f === 'pendiente' ? 'Por cobrar' : 'Cobrados'}
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
          <p className="text-4xl mb-3">💰</p>
          <p className="text-fin-muted font-medium mb-1">Sin ingresos registrados</p>
          <p className="text-xs text-fin-muted mb-4">Registra tus ingresos y su fecha de cobro</p>
          <button
            onClick={openAdd}
            className="px-5 py-2.5 bg-fin-green text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors"
          >
            Agregar ingreso
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
                  <p className={`text-sm font-semibold truncate ${entry.status === 'cobrado' ? 'text-gray-400 line-through' : 'text-fin-text'}`}>
                    {entry.name}
                  </p>
                  {entry.status === 'cobrado' && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold shrink-0">Cobrado</span>
                  )}
                  {isOverdue(entry.collectionDate, entry.status) && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-semibold shrink-0">Vencido</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-fin-muted">{entry.category}</span>
                  {entry.collectionDate && (
                    <span className="flex items-center gap-1 text-xs text-fin-muted">
                      <Calendar className="w-3 h-3" strokeWidth={1.75} />
                      {formatDate(entry.collectionDate)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0 flex items-center gap-2">
                <p className={`text-sm font-manrope font-700 ${entry.status === 'cobrado' ? 'text-gray-400' : 'text-fin-green'}`}>
                  +S/ {entry.amount.toFixed(2)}
                </p>
                <div className="hidden group-hover:flex items-center gap-1 ml-1">
                  <button
                    onClick={() => handleMarkCobrado(entry)}
                    title={entry.status === 'cobrado' ? 'Marcar pendiente' : 'Marcar cobrado'}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-50 transition-colors"
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${entry.status === 'cobrado' ? 'text-green-500' : 'text-gray-400 hover:text-green-600'}`} strokeWidth={1.75} />
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
                {editingEntry ? 'Editar ingreso' : 'Nuevo ingreso'}
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
                  placeholder="Ej: Sueldo enero, Proyecto freelance..."
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
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Categoría</label>
                <div className="grid grid-cols-4 gap-2">
                  {INCOME_CATEGORIES.map((cat) => (
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
                      <span className="text-[10px] leading-tight text-center">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fecha de cobro */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">
                  Fecha de cobro
                </label>
                <input
                  type="date"
                  value={form.collectionDate}
                  onChange={(e) => setForm((f) => ({ ...f, collectionDate: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border-[2px] border-gray-200 rounded-xl text-sm text-black outline-none focus:border-black transition-colors"
                />
                <p className="text-[11px] text-black mt-1">Fecha en que recibirás este ingreso</p>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">Estado</label>
                <div className="flex gap-2">
                  {(['pendiente', 'cobrado'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, status: s }))}
                      className={`flex-1 py-2.5 rounded-xl border-[2px] text-sm font-semibold transition-all ${
                        form.status === s
                          ? s === 'cobrado'
                            ? 'border-black bg-[#4ADE80] text-black' :'border-black bg-[#FFD93D] text-black' :'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {s === 'pendiente' ? '⏳ Por cobrar' : '✅ Cobrado'}
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

            {formError && (
              <p role="alert" className="px-6 pb-3 text-sm font-semibold text-red-600">{formError}</p>
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
                {saving ? 'Guardando...' : editingEntry ? 'Actualizar' : 'Guardar ingreso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
