'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { savingsService, SavingsGoal } from '@/lib/supabaseFinance';
import { Plus, X, Pencil, Trash2, PiggyBank } from 'lucide-react';
import LoadError from '@/components/ui/LoadError';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';
import { useDataChanged } from '@/lib/dataSync';
import { currencySymbol, formatMoney } from '@/lib/format';
import { APP_LOCALE } from '@/lib/locale';
import Glyph from '@/components/ui/Glyph';
import { glyphKey, type GlyphKey } from '@/lib/glyphs';

const GOAL_ICONS: { key: GlyphKey; label: string }[] = [
  { key: 'shield', label: 'Emergencia' },
  { key: 'plane', label: 'Viaje' },
  { key: 'car', label: 'Auto' },
  { key: 'laptop', label: 'Laptop' },
  { key: 'home', label: 'Casa' },
  { key: 'phone', label: 'Celular' },
  { key: 'graduation', label: 'Estudios' },
  { key: 'gem', label: 'Anillo' },
  { key: 'piggy', label: 'Ahorro' },
  { key: 'star', label: 'Otro' },
];

function formatTargetDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(APP_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AhorrosPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [addAmount, setAddAmount] = useState<{ id: string; value: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [formError, setFormError] = useState('');
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    icon: 'piggy',
    current: '0',
    target: '',
    color: '#16A34A',
    targetDate: '',
  });

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    savingsService
      .getAll()
      .then(setGoals)
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, []);

  // Reload when something is added from the quick-add sheet or the global modal.
  useDataChanged(load);

  useEffect(() => {
    load();
  }, [load]);

  const totalSaved = goals.reduce((s, g) => s + g.current, 0);

  const openAdd = () => {
    setEditingGoal(null);
    setForm({
      name: '',
      icon: 'piggy',
      current: '0',
      target: '',
      color: '#16A34A',
      targetDate: '',
    });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setForm({
      name: goal.name,
      icon: goal.icon,
      current: String(goal.current),
      target: String(goal.target),
      color: goal.color,
      targetDate: goal.targetDate,
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.target) return;
    setSaving(true);
    setFormError('');
    try {
      const goalData = {
        ...form,
        current: parseFloat(form.current) || 0,
        target: parseFloat(form.target),
      };
      if (editingGoal) {
        await savingsService.update(editingGoal.id, goalData);
        setGoals((prev) => prev.map((g) => (g.id === editingGoal.id ? { ...g, ...goalData } : g)));
      } else {
        const created = await savingsService.create(goalData);
        setGoals((prev) => [...prev, created]);
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
      await savingsService.delete(id);
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      toast.showError(err);
    }
  };

  const handleAddAmount = async (id: string) => {
    if (!addAmount?.value) return;
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;
    const newCurrent = goal.current + parseFloat(addAmount.value);
    try {
      await savingsService.update(id, { current: newCurrent });
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, current: newCurrent } : g)));
      setAddAmount(null);
    } catch (err) {
      toast.showError(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#FFD43B] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-bold text-gray-500">Cargando metas...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#FAFAF8]">
        <div className="px-4 py-5 max-w-2xl mx-auto">
          <h1 className="text-3xl font-black text-black leading-tight mb-5">Metas de Ahorro</h1>
          <LoadError what="tus metas de ahorro" error={loadError} onRetry={load} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="px-4 py-5 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-3xl font-black text-black leading-tight">Metas de Ahorro</h1>
            <p className="text-sm text-gray-500 font-medium mt-0.5">
              Ahorra con propósito, alcanza tus sueños.
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#FFD43B] border-[3px] border-black rounded-2xl font-black text-black text-sm shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            Nueva meta
          </button>
        </div>

        {/* Total saved card */}
        {goals.length > 0 && (
          <div className="bg-white border-[3px] border-black rounded-3xl p-5 shadow-[4px_4px_0px_rgba(0,0,0,1)] mb-5">
            <div className="flex items-center gap-2 mb-1">
              <PiggyBank className="w-5 h-5 text-black" strokeWidth={2} />
              <p className="text-sm font-bold text-gray-500">Total ahorrado</p>
            </div>
            <p className="text-3xl font-black text-black">{formatMoney(totalSaved)}</p>
          </div>
        )}

        {/* Empty state */}
        {goals.length === 0 && (
          <div className="text-center py-16 px-4">
            <div className="w-24 h-24 bg-[#FFD43B] border-[3px] border-black rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
              <PiggyBank className="w-12 h-12 text-black" strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-black text-black mb-2">Tu primera meta empieza aquí.</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-6 max-w-xs mx-auto">
              Define un objetivo, fija una fecha y empieza a ahorrar con propósito.
            </p>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#FFD43B] border-[3px] border-black rounded-2xl font-black text-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
            >
              <Plus className="w-4 h-4" strokeWidth={3} />
              Crear mi primera meta
            </button>
          </div>
        )}

        {/* Goals list */}
        {goals.length > 0 && (
          <>
            <h2 className="text-lg font-black text-black mb-3">Mis metas</h2>
            <div className="space-y-4">
              {goals.map((goal) => {
                const pct = goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0;
                return (
                  <div
                    key={goal.id}
                    className="bg-white border-[3px] border-black rounded-3xl p-5 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-0 transition-all duration-150 group"
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-12 h-12 rounded-2xl border-[2.5px] border-black flex items-center justify-center text-2xl flex-shrink-0 bg-[#FFD43B] shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                        <Glyph name={goal.icon} fallback="piggy" className="h-6 w-6 text-[#111]" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-black text-black text-base">{goal.name}</p>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-black text-black">{pct}%</span>
                            <div className="hidden group-hover:flex items-center gap-1 ml-1">
                              <button
                                onClick={() => openEdit(goal)}
                                className="p-1.5 rounded-lg border-[2px] border-black bg-white hover:bg-gray-100 transition-all"
                              >
                                <Pencil className="w-3.5 h-3.5 text-black" strokeWidth={2} />
                              </button>
                              <button
                                onClick={() => handleDelete(goal.id)}
                                className="p-1.5 rounded-lg border-[2px] border-black bg-white hover:bg-red-50 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-black" strokeWidth={2} />
                              </button>
                            </div>
                          </div>
                        </div>
                        {goal.targetDate && (
                          <p className="text-xs font-bold text-gray-500 mt-0.5">
                            Meta: {formatTargetDate(goal.targetDate)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="mb-3">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-black text-black">{formatMoney(goal.current)}</span>
                        <span className="font-bold text-gray-500">{formatMoney(goal.target)}</span>
                      </div>
                      <div className="h-3 bg-gray-100 border-[2px] border-black rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#4ADE80] rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-500">
                        Faltan {formatMoney(Math.max(goal.target - goal.current, 0))}
                      </p>
                      {addAmount?.id === goal.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={addAmount.value}
                            onChange={(e) => setAddAmount({ id: goal.id, value: e.target.value })}
                            placeholder="Monto"
                            className="w-24 px-2 py-1.5 text-xs font-bold border-[2px] border-black rounded-lg outline-none focus:ring-2 focus:ring-[#FFD43B]"
                            autoFocus
                          />
                          <button
                            onClick={() => handleAddAmount(goal.id)}
                            className="text-xs font-black px-3 py-1.5 bg-[#FFD43B] border-[2px] border-black rounded-lg shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all"
                          >
                            OK
                          </button>
                          <button
                            onClick={() => setAddAmount(null)}
                            className="text-xs font-black px-2 py-1.5 border-[2px] border-black rounded-lg bg-white hover:bg-gray-100 transition-all"
                            aria-label="Cancelar"
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddAmount({ id: goal.id, value: '' })}
                          className="text-xs font-black px-3 py-1.5 rounded-xl border-[2.5px] border-black bg-white hover:bg-[#FFD43B] shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all"
                        >
                          + Agregar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowForm(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative bg-[#FAFAF8] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border-[3px] border-black shadow-[6px_6px_0px_rgba(0,0,0,1)] flex flex-col sheet-max"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b-[3px] border-black">
              <h2 className="font-black text-black text-lg">
                {editingGoal ? 'Editar meta' : 'Nueva meta de ahorro'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-9 h-9 rounded-xl bg-black flex items-center justify-center text-white hover:bg-gray-800 transition-all"
              >
                <X className="w-4 h-4" strokeWidth={3} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 overflow-y-auto">
              {/* Name */}
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">
                  Nombre de la meta
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="ej: Fondo de emergencia, Viaje a Europa"
                  className="w-full px-4 py-3 bg-white rounded-xl border-[2.5px] border-black text-sm font-bold text-black placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#FFD43B] transition-all"
                />
              </div>

              {/* Icon */}
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">
                  Ícono
                </label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_ICONS.map(({ key: ic, label }) => (
                    <button
                      key={ic}
                      onClick={() => setForm((f) => ({ ...f, icon: ic }))}
                      className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center border-[2.5px] transition-all ${
                        glyphKey(form.icon) === ic
                          ? 'bg-[#FFD43B] border-black shadow-[2px_2px_0px_rgba(0,0,0,1)]'
                          : 'bg-white border-gray-300 hover:border-black'
                      }`}
                      aria-label={label}
                      aria-pressed={glyphKey(form.icon) === ic}
                    >
                      <Glyph name={ic} className="h-5 w-5 text-[#111]" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Target amount */}
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">
                  Monto meta
                </label>
                <div className="flex items-center gap-2 px-4 min-h-[56px] bg-white rounded-2xl border-[3px] border-[#111] focus-within:shadow-[0_0_0_3px_#FFD83D]">
                  <span className="text-black font-black text-sm">{currencySymbol()}</span>
                  <input
                    type="number"
                    value={form.target}
                    onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                    placeholder="0.00"
                    className="flex-1 min-w-0 bg-transparent text-[16px] font-black text-[#111] outline-none"
                  />
                </div>
              </div>

              {/* Current amount */}
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">
                  Monto actual
                </label>
                <div className="flex items-center gap-2 px-4 min-h-[56px] bg-white rounded-2xl border-[3px] border-[#111] focus-within:shadow-[0_0_0_3px_#FFD83D]">
                  <span className="text-black font-black text-sm">{currencySymbol()}</span>
                  <input
                    type="number"
                    value={form.current}
                    onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
                    placeholder="0.00"
                    className="flex-1 min-w-0 bg-transparent text-[16px] font-black text-[#111] outline-none"
                  />
                </div>
              </div>

              {/* Target date — calendar date picker */}
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wide mb-1.5">
                  Fecha meta
                </label>
                <input
                  type="date"
                  value={form.targetDate}
                  onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
                  className="w-full px-4 h-14 bg-white rounded-2xl border-[3px] border-[#111] text-[16px] font-bold text-[#111] placeholder:font-semibold placeholder:text-gray-400 outline-none focus:shadow-[0_0_0_3px_#FFD83D] transition-shadow"
                />
                <p className="text-xs font-medium text-gray-500 mt-1">
                  ¿Cuándo quieres alcanzar esta meta?
                </p>
              </div>

              {formError && (
                <p role="alert" className="text-sm font-bold text-red-600">
                  {formError}
                </p>
              )}

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={!form.name || !form.target || saving}
                className="w-full py-3.5 bg-[#FFD43B] border-[3px] border-black rounded-2xl font-black text-black text-base shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:shadow-none active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
              >
                {saving ? 'Guardando...' : editingGoal ? 'Guardar cambios' : 'Crear meta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
