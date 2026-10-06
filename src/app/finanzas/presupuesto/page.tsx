'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { budgetService, BudgetCategory, transactionsService } from '@/lib/supabaseFinance';
import { CATEGORY_PRESETS } from '@/lib/financeStore';
import { Plus, X, Pencil, Trash2, Wallet, BarChart3 } from 'lucide-react';
import LoadError from '@/components/ui/LoadError';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';
import { useDataChanged } from '@/lib/dataSync';

export default function PresupuestoPage() {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [transactions, setTransactions] = useState<
    { type: string; amount: number; category: string }[]
  >([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCat, setEditingCat] = useState<BudgetCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [formError, setFormError] = useState('');
  const toast = useToast();
  const [form, setForm] = useState({
    name: 'Comida',
    icon: '🍽️',
    budget: '',
    color: '#D97706',
    bgColor: '#FEF3C7',
  });
  const [month] = useState(() => {
    const now = new Date();
    const months = [
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
    return `${months[now.getMonth()]} ${now.getFullYear()}`;
  });

  const load = useCallback(() => {
    const now = new Date();
    setLoading(true);
    setLoadError(null);
    Promise.all([budgetService.getAll(), transactionsService.getAll()])
      .then(([cats, txs]) => {
        setCategories(cats);
        setTransactions(
          txs
            .filter((tx) => {
              const txDate = new Date(tx.date);
              return (
                txDate.getMonth() === now.getMonth() &&
                txDate.getFullYear() === now.getFullYear() &&
                tx.type === 'gasto'
              );
            })
            .map((tx) => ({ type: tx.type, amount: Math.abs(tx.amount), category: tx.category }))
        );
      })
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, []);

  // Reload when something is added from the quick-add sheet or the global modal.
  useDataChanged(load);

  useEffect(() => {
    load();
  }, [load]);

  const getSpent = (catName: string) =>
    transactions.filter((t) => t.category === catName).reduce((s, t) => s + t.amount, 0);

  const totalBudget = categories.reduce((s, c) => s + c.budget, 0);
  const totalSpent = categories.reduce((s, c) => s + getSpent(c.name), 0);
  const totalPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const openAdd = () => {
    setEditingCat(null);
    setForm({ name: 'Comida', icon: '🍽️', budget: '', color: '#D97706', bgColor: '#FEF3C7' });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (cat: BudgetCategory) => {
    setEditingCat(cat);
    setForm({
      name: cat.name,
      icon: cat.icon,
      budget: String(cat.budget),
      color: cat.color,
      bgColor: cat.bgColor,
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.budget) return;
    setSaving(true);
    setFormError('');
    try {
      const catData = { ...form, budget: parseFloat(form.budget) };
      if (editingCat) {
        await budgetService.update(editingCat.id, catData);
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCat.id ? { ...c, ...catData } : c))
        );
      } else {
        const created = await budgetService.create(catData);
        setCategories((prev) => [...prev, created]);
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
      await budgetService.delete(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      toast.showError(err);
    }
  };

  const handleCategoryPreset = (label: string) => {
    const preset = CATEGORY_PRESETS.find((c) => c.label === label);
    if (preset)
      setForm((f) => ({
        ...f,
        name: preset.label,
        icon: preset.icon,
        color: preset.color,
        bgColor: preset.color + '20',
      }));
  };

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
        <h1 className="text-3xl font-black text-black mb-5 leading-tight">Presupuesto</h1>
        <LoadError what="tu presupuesto" error={loadError} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-3xl font-black text-black leading-tight">Presupuesto</h1>
          <p className="text-sm text-gray-500 mt-0.5">{month}</p>
        </div>
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

      {categories.length > 0 && (
        <div className="bg-white rounded-3xl border-[3px] border-black p-5 shadow-[4px_4px_0px_rgba(0,0,0,1)] mb-5">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-gray-500" strokeWidth={1.75} />
            <p className="text-sm text-gray-500">Presupuesto total</p>
          </div>
          <p className="text-3xl font-black text-black mb-3">S/ {totalBudget.toFixed(2)}</p>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${totalPct > 90 ? 'bg-red-500' : totalPct > 70 ? 'bg-amber-400' : 'bg-fin-green'}`}
              style={{ width: `${Math.min(totalPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Gastado: S/ {totalSpent.toFixed(2)}</span>
            <span>{totalPct}% usado</span>
          </div>
        </div>
      )}

      {categories.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Wallet className="w-12 h-12 text-gray-200 mb-3" strokeWidth={1.25} />
          <p className="text-gray-500 font-medium mb-1">Sin categorías de presupuesto</p>
          <p className="text-sm text-gray-400 mb-4">Agrega categorías para controlar tus gastos</p>
          <button
            onClick={openAdd}
            className="group flex items-center gap-2 px-4 py-2 bg-[#FFD43B] text-sm rounded-xl transition-all duration-200 text-black font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
          >
            <Plus
              className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90"
              strokeWidth={2.5}
            />
            Agregar categoría
          </button>
        </div>
      )}

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-3xl mb-4">
            📊
          </div>
          <h2 className="text-lg font-black text-black mb-2">Sin presupuesto</h2>
          <p className="text-sm text-gray-500 max-w-xs mb-6">
            Crea categorías de presupuesto para controlar cuánto gastas en cada área.
          </p>
          <button
            onClick={openAdd}
            className="px-5 py-3 bg-[#FFD43B] text-sm rounded-xl transition-colors text-black font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
          >
            Crear primera categoría
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const spent = getSpent(cat.name);
            const pct = cat.budget > 0 ? Math.round((spent / cat.budget) * 100) : 0;
            const isOver = pct >= 90;
            const isWarning = pct >= 65 && pct < 90;
            const barColor = isOver ? '#DC2626' : isWarning ? '#D97706' : '#16A34A';
            return (
              <div
                key={cat.id}
                className="bg-white rounded-3xl border-[3px] border-black p-4 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] transition-shadow group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: cat.bgColor }}
                  >
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-black">{cat.name}</span>
                      <div className="flex items-center gap-2">
                        {isOver && (
                          <span className="text-xs px-2 py-0.5 bg-red-50 text-fin-red rounded-full font-semibold">
                            Sobrepasado
                          </span>
                        )}
                        {isWarning && !isOver && (
                          <span className="text-xs px-2 py-0.5 bg-amber-50 text-fin-amber rounded-full font-semibold">
                            Advertencia
                          </span>
                        )}
                        <div className="hidden group-hover:flex items-center gap-1">
                          <button
                            onClick={() => openEdit(cat)}
                            className="p-1.5 rounded-lg border-[2px] border-black bg-white hover:bg-gray-100 transition-all"
                          >
                            <Pencil
                              className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-700 transition-colors"
                              strokeWidth={1.75}
                            />
                          </button>
                          <button
                            onClick={() => handleDelete(cat.id)}
                            className="p-1.5 rounded-lg border-[2px] border-black bg-white hover:bg-red-50 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-black" strokeWidth={1.75} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-gray-500">
                        S/ {spent.toFixed(2)} / S/ {cat.budget.toFixed(2)}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: barColor }}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(pct, 100)}%`, background: barColor }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Restante: S/ {Math.max(cat.budget - spent, 0).toFixed(2)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={openAdd}
        className="w-full mt-4 py-3 border-2 border-dashed border-black rounded-2xl text-sm font-semibold text-gray-500 hover:border-fin-green hover:text-fin-green transition-colors flex items-center justify-center gap-2"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-4 h-4"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Nueva categoría de presupuesto
      </button>

      {/* Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowForm(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] flex flex-col sheet-max"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b-[3px] border-black">
              <h2 className="font-semibold text-gray-900">
                {editingCat ? 'Editar categoría' : 'Nueva categoría'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 flex items-center justify-center transition-all hover:rotate-90 duration-200 rounded-xl text-black hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <select
                value={form.name}
                onChange={(e) => handleCategoryPreset(e.target.value)}
                className="w-full px-4 h-14 bg-white rounded-2xl border-[3px] border-[#111] text-[16px] font-bold text-[#111] placeholder:font-semibold placeholder:text-gray-400 outline-none focus:shadow-[0_0_0_3px_#FFD83D] transition-shadow"
              >
                {CATEGORY_PRESETS.map((c) => (
                  <option key={c.id} value={c.label}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 px-4 min-h-[56px] bg-white rounded-2xl border-[3px] border-[#111] focus-within:shadow-[0_0_0_3px_#FFD83D]">
                <span className="text-gray-500 font-semibold text-sm">S/</span>
                <input
                  type="number"
                  value={form.budget}
                  onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                  placeholder="Presupuesto mensual"
                  className="flex-1 min-w-0 bg-transparent text-[16px] font-bold text-[#111] outline-none"
                />
              </div>
              {formError && (
                <p role="alert" className="text-sm font-semibold text-red-600">
                  {formError}
                </p>
              )}
              <button
                onClick={handleSave}
                disabled={!form.name || !form.budget || saving}
                className="w-full py-3.5 bg-[#FFD43B] rounded-xl transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed text-black font-black border-[3px] border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
              >
                {saving ? 'Guardando...' : editingCat ? 'Guardar cambios' : 'Agregar categoría'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
