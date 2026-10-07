'use client';
import React, { useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { SubmitButton } from '@/components/finance/formKit';
import { type Money } from '@/components/dashboard/ui';
import { CATEGORY_PRESETS } from '@/lib/financeStore';
import { todayLocal } from '@/lib/dates';
import { getErrorMessage } from '@/lib/dataError';
import { track } from '@/lib/analytics';
import {
  householdShares,
  nextOccurrence,
  type Frequency,
  type Household,
  type HouseholdMember,
} from '@/lib/household';
import { readSheet, readSpreadsheetFile, summarize, type ImportRow } from '@/lib/householdImport';
import { householdExpensesService, householdService } from '@/lib/supabaseHousehold';
import { ErrorNote, Sheet } from '@/components/household/ui';

const CATEGORIES = CATEGORY_PRESETS.filter((c) => c.id !== 'ingreso').map((c) => c.label);
const FREQ: { value: Frequency | 'once'; label: string }[] = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'yearly', label: 'Anual' },
  { value: 'once', label: 'Única vez' },
];

// "Importar desde Excel": read the file on the device, review "Esto encontramos" and
// import only after confirming. Each row becomes a household expense paid by that person
// and shared with the household's split; recurring ones start this month.
export default function ImportSheet({
  household,
  members,
  me,
  money,
  onClose,
  onDone,
}: {
  household: Household;
  members: HouseholdMember[];
  me: HouseholdMember;
  money: Money;
  onClose: () => void;
  onDone: (count: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const active = members.filter((m) => m.status === 'active');
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState('');
  const summary = useMemo(() => (rows ? summarize(rows, members) : null), [rows, members]);
  const unassigned = rows?.filter((r) => r.include && !r.person).length ?? 0;

  const read = async (file: File) => {
    setReading(true);
    setError('');
    setFileName(file.name);
    track('household_excel_import_started');
    try {
      const found = readSheet(await readSpreadsheetFile(file), members);
      if (found.length === 0) {
        setError(
          'No encontramos gastos en el archivo. Revisa que tenga una columna de descripción y otra de monto (o una columna por persona).'
        );
        setRows(null);
      } else setRows(found);
    } catch (err) {
      setError(err instanceof Error && !('kind' in err) ? err.message : getErrorMessage(err));
      setRows(null);
    } finally {
      setReading(false);
    }
  };

  const update = (key: string, patch: Partial<ImportRow>) =>
    setRows((list) => list?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? list);

  const save = async () => {
    if (!rows) return;
    const todo = rows.filter((r) => r.include);
    if (todo.length === 0) return setError('Marca al menos un gasto.');
    if (unassigned > 0) return setError('Elige quién paga cada gasto marcado.');
    // The household's split; equal parts when it cannot be applied yet (e.g. incomes not
    // declared).
    const def = householdShares(household.splitMethod, members);
    const eq = householdShares('equal', members);
    const split = def.ok ? def.shares : eq.ok ? eq.shares : null;
    if (!split) return setError('Revisa el reparto del hogar.');
    const date = `${todayLocal().slice(0, 7)}-01`;
    setSaving(0);
    setError('');
    let done = 0;
    try {
      for (const r of todo) {
        await householdExpensesService.save(household.id, null, {
          paidBy: r.person === 'shared' || !r.person ? me.id : r.person,
          name: r.description.slice(0, 80),
          category: r.category,
          amount: r.amount,
          currency: household.baseCurrency,
          exchangeRate: 1,
          date,
          responsibility: 'shared',
          shares: split,
          isRecurring: r.frequency !== null,
          frequency: r.frequency,
          nextDate: r.frequency ? nextOccurrence(date, r.frequency) : null,
          notes: 'Importado desde Excel',
          transactionId: null,
          source: 'excel',
        });
        done++;
        setSaving(done);
      }
      track('household_excel_import_completed', { rows: done });
      householdService.notify(
        household.id,
        'household_expense',
        'Gastos importados al hogar',
        `${me.displayName} importó ${done} gastos desde un Excel.`
      );
      onDone(done);
    } catch (err) {
      setError(
        `${done > 0 ? `Se importaron ${done} de ${todo.length}. ` : ''}${getErrorMessage(err)}`
      );
      setSaving(null);
    }
  };

  return (
    <Sheet title="Importar desde Excel" onClose={onClose} busy={saving !== null}>
      <input
        ref={input}
        type="file"
        accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) read(f);
          e.target.value = '';
        }}
      />
      {!rows ? (
        <div className="space-y-3">
          <p className="text-[15px] font-semibold text-[#111]/80">
            Sube el Excel donde llevan los gastos de la casa. MONEO detecta persona, categoría,
            descripción, monto y periodicidad. El archivo se lee en tu teléfono y no se guarda.
          </p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={reading}
            className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border-[3px] border-dashed border-[#111] bg-white text-[16px] font-black disabled:opacity-60"
          >
            {reading ? (
              'Leyendo…'
            ) : (
              <>
                <Upload className="h-7 w-7" /> Elegir archivo (.xlsx o .csv)
              </>
            )}
          </button>
          <p className="text-xs font-semibold text-gray-600">
            Ej.: columnas Persona · Descripción · Categoría · Monto · Periodicidad, o una columna
            por persona (Concepto · Félix · Sophia).
          </p>
          {error && <ErrorNote>{error}</ErrorNote>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-[#111] bg-[#FFD83D] p-4">
            <p className="flex items-center gap-2 text-[13px] font-black">
              <FileSpreadsheet className="h-4 w-4" /> {fileName}
            </p>
            <p className="mt-1 text-[22px] font-black">Esto encontramos</p>
            <p className="text-[15px] font-bold">
              {summary?.count} gastos · {summary?.monthlyCount} mensuales
            </p>
            <ul className="mt-2 space-y-0.5 text-[14px] font-bold">
              {summary?.byPerson.map((p) => (
                <li key={`${p.person}-${p.label}`} className="flex justify-between">
                  <span>{p.label}</span>
                  <span className="tabular-nums">{money(p.total)}/mes</span>
                </li>
              ))}
              <li className="flex justify-between border-t-2 border-[#111]/20 pt-1">
                <span>Hogar</span>
                <span className="tabular-nums">{money(summary?.total ?? 0)}/mes</span>
              </li>
            </ul>
          </div>

          {unassigned > 0 && (
            <p className="rounded-xl bg-[#FFF4CC] px-3 py-2 text-sm font-bold">
              {unassigned} {unassigned === 1 ? 'gasto no tiene' : 'gastos no tienen'} una persona
              del hogar: elige quién lo paga.
            </p>
          )}

          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.key}
                className={`rounded-2xl border-2 p-3 ${r.include ? 'border-[#111] bg-white' : 'border-[#111]/15 bg-[#F7F7F5] opacity-70'}`}
              >
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) => update(r.key, { include: e.target.checked })}
                    className="h-5 w-5 accent-[#111]"
                  />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-black">
                    {r.description}
                  </span>
                  <span className="text-[14px] font-black tabular-nums">{money(r.amount)}</span>
                </label>
                {r.include && (
                  <div className="mt-2 grid grid-cols-3 gap-1.5 pl-8">
                    <select
                      aria-label="Quién paga"
                      value={r.person ?? ''}
                      onChange={(e) => update(r.key, { person: e.target.value || null })}
                      className={`h-10 rounded-xl border-2 bg-white px-1 text-[12px] font-bold ${r.person ? 'border-[#111]/20' : 'border-[#B42318]'}`}
                    >
                      <option value="">{r.personLabel || '¿Quién?'}</option>
                      {active.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.displayName}
                        </option>
                      ))}
                      <option value="shared">Ambos</option>
                    </select>
                    <select
                      aria-label="Categoría"
                      value={r.category}
                      onChange={(e) => update(r.key, { category: e.target.value })}
                      className="h-10 rounded-xl border-2 border-[#111]/20 bg-white px-1 text-[12px] font-bold"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Periodicidad"
                      value={r.frequency ?? 'once'}
                      onChange={(e) =>
                        update(r.key, {
                          frequency:
                            e.target.value === 'once' ? null : (e.target.value as Frequency),
                        })
                      }
                      className="h-10 rounded-xl border-2 border-[#111]/20 bg-white px-1 text-[12px] font-bold"
                    >
                      {FREQ.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs font-semibold text-gray-600">
            Cada gasto queda pagado por esa persona y repartido según el método del hogar. Los de
            «Ambos» quedan a tu nombre. Nada se descuenta de tus cuentas.
          </p>
          {error && <ErrorNote>{error}</ErrorNote>}
          <SubmitButton onClick={save} disabled={saving !== null}>
            {saving !== null
              ? `Importando ${saving} de ${rows.filter((r) => r.include).length}…`
              : 'Importar a mi hogar'}
          </SubmitButton>
          <button
            type="button"
            onClick={() => {
              setRows(null);
              setError('');
            }}
            disabled={saving !== null}
            className="w-full text-sm font-black underline"
          >
            Elegir otro archivo
          </button>
        </div>
      )}
    </Sheet>
  );
}
