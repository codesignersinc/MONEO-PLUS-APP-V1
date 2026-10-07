'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { SubmitButton, TextField } from '@/components/finance/formKit';
import { card, EmptyNote, type Money } from '@/components/dashboard/ui';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';
import { track } from '@/lib/analytics';
import {
  simulatedSaving,
  simulatorLines,
  type Cut,
  type HouseholdExpense,
  type HouseholdMember,
} from '@/lib/household';
import { householdSimulationsService, type SavedSimulation } from '@/lib/supabaseHousehold';
import { ErrorNote } from '@/components/household/ui';

// "¿Qué pasa si…?": turn expenses off (or reduce them) and see the estimated saving.
// Nothing real changes: only the chosen cuts can be saved.
export default function SimulatorTab({
  householdId,
  me,
  monthExpenses,
  money,
}: {
  householdId: string;
  me: HouseholdMember;
  monthExpenses: HouseholdExpense[];
  money: Money;
}) {
  const toast = useToast();
  const base = useMemo(() => simulatorLines(monthExpenses), [monthExpenses]);
  const [cuts, setCuts] = useState<Cut[]>(base);
  const [saved, setSaved] = useState<SavedSimulation[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setCuts(base), [base]);

  const loadSaved = () =>
    householdSimulationsService
      .list(householdId)
      .then(setSaved)
      .catch(() => setSaved([]));
  useEffect(() => {
    loadSaved();
  }, [householdId]); // eslint-disable-line react-hooks/exhaustive-deps

  const result = simulatedSaving(cuts);
  const setCut = (key: string, cut: number) =>
    setCuts((list) => list.map((c) => (c.key === key ? { ...c, cut } : c)));

  const save = async () => {
    if (!(result.monthly > 0)) return setError('Elige al menos un gasto para recortar.');
    if (!name.trim()) return setError('Ponle un nombre a la simulación.');
    setSaving(true);
    setError('');
    try {
      await householdSimulationsService.save(
        householdId,
        name,
        cuts.map((c) => ({ label: c.label, cut: c.cut })),
        result.monthly
      );
      track('household_simulation_created', { lines: cuts.filter((c) => c.cut > 0).length });
      setName('');
      loadSaved();
      toast.showSuccess('Simulación guardada.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
      <section className={`${card} p-5`} aria-label="Simulador de ahorro">
        <h2 className="text-[17px] font-black">¿Qué pasa si…?</h2>
        <p className="mb-3 text-[13px] font-semibold text-gray-600">
          Activa un gasto para dejar de pagarlo o ajusta cuánto recortarían. No cambia ningún
          movimiento real.
        </p>
        {cuts.length === 0 ? (
          <EmptyNote>Agreguen gastos del hogar este mes para simular.</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {cuts.map((c) => {
              const on = c.cut > 0;
              return (
                <li
                  key={c.key}
                  className={`rounded-2xl border-2 px-3 py-2.5 ${on ? 'border-[#111] bg-[#DDF7E9]' : 'border-[#111]/15 bg-white'}`}
                >
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => setCut(c.key, e.target.checked ? c.monthly : 0)}
                      className="h-5 w-5 accent-[#111]"
                    />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-black">
                      {c.label}
                    </span>
                    <span className="text-[13px] font-bold tabular-nums text-gray-600">
                      {money(c.monthly)}/mes
                    </span>
                  </label>
                  {on && (
                    <div className="mt-2 flex items-center gap-3 pl-8">
                      <input
                        type="range"
                        min={0}
                        max={c.monthly}
                        step={Math.max(1, Math.round(c.monthly / 50))}
                        value={c.cut}
                        onChange={(e) => setCut(c.key, Number(e.target.value))}
                        aria-label={`Recorte de ${c.label}`}
                        className="min-w-0 flex-1 accent-[#111]"
                      />
                      <span className="w-28 text-right text-[13px] font-black tabular-nums">
                        − {money(c.cut)}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside className="min-w-0 space-y-4">
        <section className="rounded-[24px] border-2 border-[#111] bg-[#FFD83D] p-5 shadow-[0_3px_0_#111]">
          <p className="text-[14px] font-black">Ahorro estimado</p>
          <p className="text-[34px] font-black leading-none tabular-nums">
            {money(result.monthly)}
          </p>
          <p className="text-[14px] font-bold">/ mes · {money(result.yearly)} al año</p>
        </section>
        <section className={`${card} space-y-3 p-5`}>
          <TextField
            label="Nombre de la simulación"
            value={name}
            onChange={setName}
            placeholder="Ej. Menos delivery"
          />
          {error && <ErrorNote>{error}</ErrorNote>}
          <SubmitButton onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar simulación'}
          </SubmitButton>
        </section>
        {saved.length > 0 && (
          <section className={`${card} p-5`}>
            <h3 className="mb-2 text-[15px] font-black">Simulaciones guardadas</h3>
            <ul className="space-y-2">
              {saved.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-[14px] font-bold">
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="tabular-nums">{money(s.monthlySaving)}/mes</span>
                  {(s.createdBy === me.userId || me.role === 'owner') && (
                    <button
                      type="button"
                      onClick={() =>
                        householdSimulationsService
                          .remove(s.id)
                          .then(loadSaved)
                          .catch((err) => toast.showError(err))
                      }
                      aria-label={`Eliminar ${s.name}`}
                      className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[#FFE1DB]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
