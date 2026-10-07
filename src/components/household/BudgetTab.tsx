'use client';
import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { AmountField, CategoryChips, SubmitButton } from '@/components/finance/formKit';
import { card, EmptyNote, type Money } from '@/components/dashboard/ui';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';
import { track } from '@/lib/analytics';
import { CATEGORY_PRESETS } from '@/lib/financeStore';
import {
  budgetProgress,
  categoryTotals,
  householdCategory,
  monthLabel,
  type HouseholdBudget,
  type HouseholdExpense,
} from '@/lib/household';
import { householdBudgetsService } from '@/lib/supabaseHousehold';
import { ErrorNote, Sheet } from '@/components/household/ui';

// Household categories: the presets (without income), with Comida + Supermercado shown
// together as Alimentación, as in every household view.
const CATEGORIES = [
  { label: 'Alimentación', icon: '🛒' },
  ...CATEGORY_PRESETS.filter((c) => !['ingreso', 'comida', 'supermercado'].includes(c.id)).map(
    (c) => ({ label: c.label, icon: c.icon })
  ),
];

const BAR: Record<'ok' | 'warning' | 'over', string> = {
  ok: '#45D98B',
  warning: '#FFD83D',
  over: '#FF806E',
};

export default function BudgetTab({
  householdId,
  budgets,
  monthExpenses,
  month,
  money,
  currencySymbol,
  onChanged,
}: {
  householdId: string;
  budgets: HouseholdBudget[];
  monthExpenses: HouseholdExpense[];
  month: string;
  money: Money;
  currencySymbol: string;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<{ category: string; limit: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const progress = budgetProgress(budgets, monthExpenses);
  const totalLimit = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalSpent = progress.reduce((s, b) => s + b.spent, 0);

  // Categories with spending this month and no limit yet: quick suggestions.
  const suggestions = useMemo(() => {
    const has = new Set(budgets.map((b) => householdCategory(b.category)));
    return categoryTotals(monthExpenses)
      .filter((c) => !has.has(c.category))
      .slice(0, 4);
  }, [budgets, monthExpenses]);

  const save = async () => {
    const limit = parseFloat(editing?.limit ?? '');
    if (!editing?.category) return setError('Elige la categoría.');
    if (!(limit > 0)) return setError('Ingresa un límite mayor que cero.');
    setSaving(true);
    setError('');
    try {
      const isNew = !budgets.some((b) => b.category === editing.category);
      await householdBudgetsService.upsert(householdId, editing.category, limit);
      if (isNew) track('household_budget_created');
      setEditing(null);
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b: HouseholdBudget) => {
    if (!window.confirm(`¿Quitar el presupuesto de ${b.category}?`)) return;
    try {
      await householdBudgetsService.remove(b.id);
      onChanged();
    } catch (err) {
      toast.showError(err);
    }
  };

  return (
    <div className="space-y-4">
      <section className={`${card} p-5`} aria-label="Presupuesto del hogar">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-black">Presupuesto del hogar</h2>
            <p className="text-[13px] font-semibold capitalize text-gray-600">
              {monthLabel(month)}
              {budgets.length > 0 && ` · ${money(totalSpent)} de ${money(totalLimit)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing({ category: '', limit: '' })}
            className="flex h-11 items-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] px-3 text-[14px] font-black shadow-[0_3px_0_#111]"
          >
            <Plus className="h-5 w-5" strokeWidth={3} /> Límite
          </button>
        </div>
        {progress.length === 0 ? (
          <EmptyNote>
            Pongan un límite mensual por categoría y MONEO les avisa al llegar al 80%.
          </EmptyNote>
        ) : (
          <ul className="space-y-3">
            {progress.map((b) => (
              <li key={b.id}>
                <div className="flex items-center gap-2 text-[14px] font-bold">
                  <span className="min-w-0 flex-1 truncate">{b.category}</span>
                  <span className="tabular-nums">
                    {money(b.spent)} / {money(b.monthlyLimit)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({ category: b.category, limit: String(b.monthlyLimit) })
                    }
                    aria-label={`Editar ${b.category}`}
                    className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[#FFF9EC]"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(b)}
                    aria-label={`Quitar ${b.category}`}
                    className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[#FFE1DB]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded-full border-2 border-[#111] bg-[#F1EDE3]">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.min(100, Math.max(2, b.pct))}%`,
                      background: BAR[b.status],
                    }}
                  />
                </div>
                <p
                  className={`mt-0.5 text-xs font-bold ${b.status === 'over' ? 'text-[#B42318]' : 'text-gray-600'}`}
                >
                  {b.status === 'over'
                    ? `Se pasaron por ${money(b.spent - b.monthlyLimit)}`
                    : `Quedan ${money(b.monthlyLimit - b.spent)} · ${b.pct}%`}
                </p>
              </li>
            ))}
          </ul>
        )}
        {suggestions.length > 0 && (
          <div className="mt-4 border-t-2 border-[#111]/10 pt-3">
            <p className="mb-2 text-[13px] font-black text-gray-600">Sin límite todavía</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((c) => (
                <button
                  key={c.category}
                  type="button"
                  onClick={() =>
                    setEditing({ category: c.category, limit: String(Math.ceil(c.total)) })
                  }
                  className="rounded-xl border-2 border-[#111]/20 bg-white px-3 py-1.5 text-[13px] font-bold"
                >
                  + {c.category} ({money(c.total)})
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {editing && (
        <Sheet title="Límite mensual" onClose={() => setEditing(null)} busy={saving}>
          <CategoryChips
            categories={CATEGORIES}
            value={editing.category}
            onChange={(category) => setEditing((e) => (e ? { ...e, category } : e))}
          />
          <AmountField
            label={`Límite mensual (${currencySymbol})`}
            value={editing.limit}
            onChange={(limit) => setEditing((e) => (e ? { ...e, limit } : e))}
            currency={currencySymbol}
          />
          {error && <ErrorNote>{error}</ErrorNote>}
          <SubmitButton onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar límite'}
          </SubmitButton>
        </Sheet>
      )}
    </div>
  );
}
