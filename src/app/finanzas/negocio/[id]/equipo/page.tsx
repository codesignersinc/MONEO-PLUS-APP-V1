'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Loader2, Plus, Trash2, Users } from 'lucide-react';
import LoadError from '@/components/ui/LoadError';
import { useToast } from '@/components/ui/Toast';
import { card } from '@/components/dashboard/ui';
import ContextSwitch from '@/components/business/ContextSwitch';
import { useNegocio } from '@/components/business/useNegocio';
import { Initials, Sheet, SettleSheet, field, label } from '@/components/business/kit';
import { formatMoney } from '@/lib/format';
import { parseAmountInput } from '@/lib/amount';
import { MONTHS_SHORT } from '@/lib/dashboard';
import { getErrorMessage } from '@/lib/dataError';
import { notifyDataChanged, useDataChanged } from '@/lib/dataSync';
import {
  bizObligationsService,
  partiesService,
  type BizObligation,
  type Party,
} from '@/lib/supabaseBusiness';
import { userSettingsService } from '@/lib/supabaseCurrency';
import { monthlyPay, nextPayDate, nextWeekday } from '@/lib/business';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Equipo (fase 3, decision 3): employees are contacts with their usual pay and recurring
// payments: monthly (one, on a day), quincenal (half on the 15th, half on the last day) or
// semanal (every 7 days on a weekday; the database moves each next payment a week ahead).
// No payroll, taxes or benefits — just cash flow and projection.

const FREQ_LABEL: Record<string, string> = {
  mensual: 'Mensual',
  quincenal: 'Quincenal',
  semanal: 'Semanal',
};

const COLORS = ['#45D98B', '#75B8FF', '#B99CFF', '#FFD83D', '#FF806E'];

const shortDate = (s: string) => {
  const [, mm, dd] = s.split('-').map(Number);
  return `${dd} ${MONTHS_SHORT[mm - 1]}.`;
};

export default function BusinessTeamPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { businesses } = useNegocio();
  const business = businesses.find((b) => b.id === id);
  const [team, setTeam] = useState<Party[] | null>(null);
  const [pending, setPending] = useState<BizObligation[]>([]);
  const [currency, setCurrency] = useState('PEN');
  const [error, setError] = useState<unknown>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: '',
    amount: '',
    day: '15',
    freq: 'mensual' as 'mensual' | 'quincenal' | 'semanal',
    weekday: '6',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [settling, setSettling] = useState<BizObligation | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      partiesService.list(id),
      bizObligationsService.list(id),
      userSettingsService.get(),
    ])
      .then(([p, o, s]) => {
        setTeam(p.filter((x) => x.kind === 'empleado'));
        setPending(o.filter((x) => x.type === 'pago' && !x.done));
        setCurrency(s.baseCurrencyCode);
      })
      .catch(setError);
  }, [id]);
  useEffect(load, [load]);
  useDataChanged(load);

  const money = (n: number) => formatMoney(n, currency);
  const monthly = useMemo(
    () =>
      (team ?? [])
        .filter((p) => p.active)
        .reduce((a, p) => a + monthlyPay(p.usualAmount ?? 0, p.frequency), 0),
    [team]
  );

  const add = async () => {
    setFormError('');
    const amount = parseAmountInput(form.amount);
    const day = Number(form.day);
    if (!form.name.trim()) return setFormError('Escribe el nombre.');
    const weekly = form.freq === 'semanal';
    if (!(amount > 0))
      return setFormError(weekly ? 'Escribe el pago por semana.' : 'Escribe el sueldo mensual.');
    if (form.freq === 'mensual' && !(day >= 1 && day <= 31))
      return setFormError('El día de pago va del 1 al 31.');
    setSaving(true);
    try {
      const p = await partiesService.create(id, {
        kind: 'empleado',
        name: form.name,
        usualAmount: amount,
        frequency: form.freq,
      });
      const half = Math.round((amount / 2) * 100) / 100;
      if (weekly) {
        await bizObligationsService.create(id, {
          type: 'pago',
          name: `Sueldo ${p.name} (semanal)`,
          amount,
          category: 'Planilla',
          icon: 'users',
          due: nextWeekday(Number(form.weekday)),
          partyId: p.id,
          everyDays: 7,
        });
      }
      const payments = weekly
        ? []
        : form.freq === 'quincenal'
          ? [
              { name: `Sueldo ${p.name} (1.ª quincena)`, amount: half, day: 15 },
              { name: `Sueldo ${p.name} (2.ª quincena)`, amount: amount - half, day: 31 },
            ]
          : [{ name: `Sueldo ${p.name}`, amount, day }];
      for (const pay of payments) {
        await bizObligationsService.create(id, {
          type: 'pago',
          name: pay.name,
          amount: pay.amount,
          category: 'Planilla',
          icon: 'users',
          due: nextPayDate(pay.day),
          partyId: p.id,
          recurringDay: pay.day,
        });
      }
      notifyDataChanged();
      setAdding(false);
      setForm({ name: '', amount: '', day: '15', freq: 'mensual', weekday: '6' });
      load();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Party) => {
    if (!window.confirm(`¿Quitar a ${p.name} del equipo? Sus pagos ya hechos se conservan.`))
      return;
    try {
      for (const o of pending.filter((x) => x.partyId === p.id))
        await bizObligationsService.remove(o);
      await partiesService.remove(p.id);
      notifyDataChanged();
      load();
    } catch (e) {
      toast.showError(e);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <LoadError what="tu equipo" error={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-5 text-[#111] lg:px-8 lg:py-6">
      <ContextSwitch className="mb-4 lg:hidden" />
      <Link
        href={`/finanzas/negocio/${id}`}
        className="mb-3 inline-flex items-center gap-1 text-sm font-black"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.8} /> {business?.name ?? 'Negocio'}
      </Link>
      <h1 className="mb-1 text-[28px] font-black leading-tight">Equipo</h1>
      <p className="mb-4 text-sm font-semibold text-[#111]/70">
        Sueldos para tu flujo de caja y tu proyección. MONEO no calcula planillas ni impuestos.
      </p>

      <div className={`${card} mb-4 flex items-center justify-between gap-3 bg-[#EDE5FF] p-5`}>
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-[#111] bg-white">
            <Users className="h-6 w-6" strokeWidth={2.5} />
          </span>
          <div>
            <p className="text-sm font-black">Sueldos al mes</p>
            <p className="text-[28px] font-black leading-none tabular-nums">{money(monthly)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="paper-opaque inline-flex items-center gap-1.5 rounded-xl border-2 border-[#111] bg-[#111] px-3 py-2.5 text-sm font-black text-white"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Agregar
        </button>
      </div>

      {!team ? (
        <div className="h-32 animate-pulse rounded-[22px] border-2 border-[#111]/20 bg-white" />
      ) : team.length === 0 ? (
        <p className={`${card} p-5 text-sm font-bold`}>
          Agrega a las personas que trabajan contigo y su sueldo: MONEO te recordará cada pago y lo
          tendrá en cuenta en tu cierre del mes.
        </p>
      ) : (
        <ul className="space-y-2">
          {team.map((p, i) => {
            const next = pending
              .filter((o) => o.partyId === p.id)
              .sort((a, b) => a.due.localeCompare(b.due))[0];
            return (
              <li key={p.id} className={`${card} flex items-center gap-3 p-4`}>
                <Initials name={p.name} color={COLORS[i % COLORS.length]} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/finanzas/negocio/${id}/contactos/${p.id}`}
                    className="block truncate font-black hover:underline"
                  >
                    {p.name}
                  </Link>
                  <p className="text-xs font-semibold text-[#111]/60">
                    {FREQ_LABEL[p.frequency ?? 'mensual'] ?? 'Mensual'}
                    {next ? ` · próximo ${shortDate(next.due)}` : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="font-black tabular-nums">
                    {money(p.usualAmount ?? 0)}
                    {p.frequency === 'semanal' ? ' / sem.' : ''}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => remove(p)}
                      aria-label={`Quitar a ${p.name}`}
                      className="grid h-7 w-7 place-items-center rounded-lg border-2 border-[#111] bg-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                    {next && (
                      <button
                        type="button"
                        onClick={() => setSettling(next)}
                        className="paper-opaque rounded-lg border-2 border-[#111] bg-[#FFD83D] px-2.5 py-1 text-xs font-black"
                      >
                        Pagar
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <Sheet title="Agregar a tu equipo" onClose={() => setAdding(false)}>
          <div className="space-y-3">
            <label className="block">
              <span className={label}>Nombre</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej. Carlos"
                className={field}
              />
            </label>
            <div>
              <span className={label}>Frecuencia de pago</span>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {(['mensual', 'quincenal', 'semanal'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={form.freq === f}
                    onClick={() => setForm({ ...form, freq: f })}
                    className={`rounded-xl border-2 border-[#111] py-2 text-sm font-black ${
                      form.freq === f ? 'paper-opaque bg-[#111] text-white' : 'bg-white'
                    }`}
                  >
                    {FREQ_LABEL[f]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className={`block ${form.freq === 'quincenal' ? 'col-span-2' : ''}`}>
                <span className={label}>
                  {form.freq === 'semanal' ? 'Pago por semana' : 'Sueldo mensual'}
                </span>
                <input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  className={field}
                />
              </label>
              {form.freq === 'semanal' && (
                <label className="block">
                  <span className={label}>Día de pago</span>
                  <select
                    value={form.weekday}
                    onChange={(e) => setForm({ ...form, weekday: e.target.value })}
                    className={field}
                  >
                    {WEEKDAYS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className={`block ${form.freq !== 'mensual' ? 'hidden' : ''}`}>
                <span className={label}>Día de pago</span>
                <input
                  inputMode="numeric"
                  value={form.day}
                  onChange={(e) =>
                    setForm({ ...form, day: e.target.value.replace(/\D/g, '').slice(0, 2) })
                  }
                  className={field}
                />
              </label>
            </div>
            {form.freq === 'quincenal' && (
              <p className="text-xs font-semibold text-[#111]/70">
                Se paga la mitad el 15 y la otra mitad el último día de cada mes.
              </p>
            )}
          </div>
          {formError && (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]"
            >
              {formError}
            </p>
          )}
          <button
            type="button"
            onClick={add}
            disabled={saving}
            className="paper-opaque mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] py-3.5 text-base font-black shadow-[0_4px_0_#111] disabled:opacity-60"
          >
            {saving && <Loader2 className="h-5 w-5 animate-spin" />} Guardar
          </button>
        </Sheet>
      )}
      {settling && (
        <SettleSheet
          businessId={id}
          obligation={settling}
          onClose={() => setSettling(null)}
          onDone={() => {
            setSettling(null);
            toast.showSuccess('Pago registrado.');
            load();
          }}
        />
      )}
    </div>
  );
}
