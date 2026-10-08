'use client';
import React, { useState, useEffect, useCallback } from 'react';
import LoadError from '@/components/ui/LoadError';
import Glyph from '@/components/ui/Glyph';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';
import { incomeService, type IncomeEntry, type NewIncome } from '@/lib/supabaseObligations';
import { AccountPickerModal } from '@/components/finance/AccountAmountPicker';
import { todayLocal } from '@/lib/dates';
import { Plus, X, Pencil, Trash2, Clock, CheckCircle2, Calendar } from 'lucide-react';
import { useDataChanged } from '@/lib/dataSync';
import { currencySymbol, formatMoney, monthNames } from '@/lib/format';

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
  { label: 'Salario', icon: 'briefcase' },
  { label: 'Freelance', icon: 'laptop' },
  { label: 'Negocio', icon: 'store' },
  { label: 'Inversión', icon: 'trending' },
  { label: 'Alquiler', icon: 'home' },
  { label: 'Bono', icon: 'gift' },
  { label: 'Comisión', icon: 'handshake' },
  { label: 'Otro', icon: 'coins' },
];

const defaultForm: IncomeForm = {
  name: '',
  amount: '',
  category: 'Salario',
  categoryIcon: 'briefcase',
  collectionDate: '',
  notes: '',
  status: 'pendiente',
};

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
  // Entry waiting for the user to choose the account it is collected into.
  const [picking, setPicking] = useState<IncomeEntry | null>(null);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    incomeService
      .getAll()
      .then(setEntries)
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, []);

  // Reload when something is added from the quick-add sheet or the global modal.
  useDataChanged(load);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = entries.filter((e) => filterStatus === 'todos' || e.status === filterStatus);

  const totalPendiente = entries
    .filter((e) => e.status === 'pendiente')
    .reduce((s, e) => s + e.amount, 0);
  const totalCobrado = entries
    .filter((e) => e.status === 'cobrado')
    .reduce((s, e) => s + e.amount, 0);

  const openAdd = () => {
    setEditingEntry(null);
    setForm({ ...defaultForm, collectionDate: todayLocal() });
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
    setForm((f) => ({ ...f, category: label, categoryIcon: cat?.icon || 'coins' }));
  };

  const setStatus = (id: string, status: IncomeEntry['status'], transactionId: string | null) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status, transactionId } : e)));

  const handleSave = async () => {
    if (!form.name || !form.amount) return;
    setSaving(true);
    setFormError('');
    try {
      const entryData: NewIncome = {
        name: form.name,
        amount: parseFloat(form.amount) || 0,
        category: form.category,
        categoryIcon: form.categoryIcon,
        collectionDate: form.collectionDate,
        notes: form.notes,
      };
      if (editingEntry) {
        // Editing a collected entry also updates its movement (database trigger).
        await incomeService.update(editingEntry.id, entryData);
        const updated = { ...editingEntry, ...entryData };
        setEntries((prev) => prev.map((e) => (e.id === editingEntry.id ? updated : e)));
        if (form.status !== editingEntry.status) {
          if (form.status === 'pendiente') {
            await incomeService.markPending(editingEntry.id);
            setStatus(editingEntry.id, 'pendiente', null);
          } else {
            setPicking(updated);
          }
        }
      } else {
        const created = await incomeService.create(entryData);
        setEntries((prev) => [...prev, created]);
        if (form.status === 'cobrado') setPicking(created);
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
      await incomeService.delete(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      toast.showError(err);
    }
  };

  // Collecting asks for the account; going back to pending deletes its movement.
  const handleMarkCobrado = async (entry: IncomeEntry) => {
    if (entry.status !== 'cobrado') {
      setPicking(entry);
      return;
    }
    try {
      await incomeService.markPending(entry.id);
      setStatus(entry.id, 'pendiente', null);
    } catch (err) {
      toast.showError(err);
    }
  };

  const confirmCollected = async (accountId: string, accountAmount?: number) => {
    if (!picking) return;
    const transactionId = await incomeService.markCollected(picking.id, accountId, accountAmount);
    setStatus(picking.id, 'cobrado', transactionId);
    setPicking(null);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const [year, month, day] = dateStr.split('-');
    const months = monthNames('short');
    return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
  };

  const isOverdue = (dateStr: string, status: string) => {
    if (!dateStr || status === 'cobrado') return false;
    return dateStr < todayLocal();
  };

  if (loadError) {
    return (
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-black text-black mb-5 leading-tight">Ingresos</h1>
        <LoadError what="tus ingresos" error={loadError} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-3xl font-black text-black leading-tight">Ingresos</h1>
        <button
          onClick={openAdd}
          className="group flex items-center gap-2 px-3 py-2 bg-[#FFD43B] text-sm rounded-xl transition-all duration-200 text-black font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
        >
          <Plus
            className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90"
            strokeWidth={2.5}
          />
          Agregar ingreso
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-3xl border-[3px] border-black p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
            <p className="text-xs text-gray-500 font-medium">Por cobrar</p>
          </div>
          <p className="text-[2rem] leading-tight font-black tabular-nums break-words text-amber-600">
            {formatMoney(totalPendiente)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {entries.filter((e) => e.status === 'pendiente').length} ingresos
          </p>
        </div>
        <div className="bg-white rounded-3xl border-[3px] border-black p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" strokeWidth={1.75} />
            <p className="text-xs text-gray-500 font-medium">Cobrado</p>
          </div>
          <p className="text-[2rem] leading-tight font-black tabular-nums break-words text-green-700">
            {formatMoney(totalCobrado)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {entries.filter((e) => e.status === 'cobrado').length} ingresos
          </p>
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
                ? 'bg-[#FFD43B] text-black border-[2px] border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                : 'bg-white border-[2px] border-black text-black hover:bg-gray-50'
            }`}
          >
            {f === 'todos' ? 'Todos' : f === 'pendiente' ? 'Por cobrar' : 'Cobrados'}
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
          <Glyph name="coins" className="h-10 w-10 mb-3 text-[#111]" />
          <p className="text-gray-500 font-medium mb-1">Sin ingresos registrados</p>
          <p className="text-xs text-gray-500 mb-4">Registra tus ingresos y su fecha de cobro</p>
          <button
            onClick={openAdd}
            className="px-5 py-2.5 bg-[#FFD43B] text-sm rounded-xl transition-colors text-black font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
          >
            Agregar ingreso
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
                <Glyph name={entry.categoryIcon} fallback="coins" className="h-5 w-5 text-[#111]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p
                    className={`text-sm font-semibold truncate ${entry.status === 'cobrado' ? 'text-gray-400 line-through' : 'text-black'}`}
                  >
                    {entry.name}
                  </p>
                  {entry.status === 'cobrado' && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold shrink-0">
                      Cobrado
                    </span>
                  )}
                  {isOverdue(entry.collectionDate, entry.status) && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-semibold shrink-0">
                      Vencido
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs px-2 py-0.5 rounded-full text-gray-500 bg-white border-[1.5px] border-black font-bold">
                    {entry.category}
                  </span>
                  {entry.collectionDate && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" strokeWidth={1.75} />
                      {formatDate(entry.collectionDate)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0 flex items-center gap-2">
                <p
                  className={`text-sm font-black ${entry.status === 'cobrado' ? 'text-gray-400' : 'text-fin-green'}`}
                >
                  +{formatMoney(entry.amount)}
                </p>
                <div className="hidden group-hover:flex items-center gap-1 ml-1">
                  <button
                    onClick={() => handleMarkCobrado(entry)}
                    title={entry.status === 'cobrado' ? 'Marcar pendiente' : 'Marcar cobrado'}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border-[2px] border-black bg-white hover:bg-green-50 transition-colors"
                  >
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${entry.status === 'cobrado' ? 'text-green-500' : 'text-black'}`}
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
          <div className="bg-white rounded-3xl border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-full max-w-md sheet-max overflow-y-auto">
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
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">
                  Descripción
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Sueldo enero, Proyecto freelance..."
                  className="w-full px-4 h-14 bg-white rounded-2xl border-[3px] border-[#111] text-[16px] font-bold text-[#111] placeholder:font-semibold placeholder:text-gray-400 outline-none focus:shadow-[0_0_0_3px_#FFD83D] transition-shadow"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">
                  Monto ({currencySymbol()})
                </label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full px-4 h-14 bg-white rounded-2xl border-[3px] border-[#111] text-[16px] font-bold text-[#111] placeholder:font-semibold placeholder:text-gray-400 outline-none focus:shadow-[0_0_0_3px_#FFD83D] transition-shadow"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">
                  Categoría
                </label>
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
                      <Glyph name={cat.icon} fallback="coins" className="h-5 w-5 text-[#111]" />
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
                  className="w-full px-4 h-14 bg-white rounded-2xl border-[3px] border-[#111] text-[16px] font-bold text-[#111] placeholder:font-semibold placeholder:text-gray-400 outline-none focus:shadow-[0_0_0_3px_#FFD83D] transition-shadow"
                />
                <p className="text-[11px] text-black mt-1">Fecha en que recibirás este ingreso</p>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wide">
                  Estado
                </label>
                <div className="flex gap-2">
                  {(['pendiente', 'cobrado'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, status: s }))}
                      className={`flex-1 py-2.5 rounded-xl border-[2px] text-sm font-semibold transition-all ${
                        form.status === s
                          ? s === 'cobrado'
                            ? 'border-black bg-[#4ADE80] text-black'
                            : 'border-black bg-[#FFD93D] text-black'
                          : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <Glyph
                          name={s === 'pendiente' ? 'hourglass' : 'check'}
                          className="h-4 w-4"
                        />
                        {s === 'pendiente' ? 'Por cobrar' : 'Cobrado'}
                      </span>
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
                  className="w-full px-4 py-3 bg-white rounded-2xl border-[3px] border-[#111] text-[16px] font-bold text-[#111] placeholder:font-semibold placeholder:text-gray-400 outline-none focus:shadow-[0_0_0_3px_#FFD83D] transition-shadow resize-none"
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
                {saving ? 'Guardando...' : editingEntry ? 'Actualizar' : 'Guardar ingreso'}
              </button>
            </div>
          </div>
        </div>
      )}
      {picking && (
        <AccountPickerModal
          title={`¿En qué cuenta cobraste «${picking.name}»?`}
          amount={picking.amount}
          confirmLabel="Marcar cobrado"
          onConfirm={confirmCollected}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}
