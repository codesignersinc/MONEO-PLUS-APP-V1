'use client';
import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  AccountSelect,
  AmountField,
  DateField,
  SubmitButton,
  TextField,
} from '@/components/finance/formKit';
import { card, EmptyNote, type Money } from '@/components/dashboard/ui';
import { useToast } from '@/components/ui/Toast';
import Glyph from '@/components/ui/Glyph';
import { accountsService } from '@/lib/supabaseFinance';
import { getFxContext } from '@/lib/supabaseCurrency';
import { getRateFromMap } from '@/lib/currency';
import { todayLocal } from '@/lib/dates';
import { getErrorMessage } from '@/lib/dataError';
import { track } from '@/lib/analytics';
import type { Account } from '@/lib/financeStore';
import type { Household, HouseholdMember } from '@/lib/household';
import {
  discardOwnMovement,
  householdGoalsService,
  householdService,
  recordOwnMovement,
  type GoalKind,
  type HouseholdGoal,
} from '@/lib/supabaseHousehold';
import { Avatar, Choice, ErrorNote, Sheet, memberColor } from '@/components/household/ui';
import { APP_LOCALE } from '@/lib/locale';

const KINDS: { value: GoalKind; label: string; icon: string }[] = [
  { value: 'emergency', label: 'Fondo de emergencia', icon: 'lifebuoy' },
  { value: 'travel', label: 'Viaje', icon: 'plane' },
  { value: 'home', label: 'Casa', icon: 'home' },
  { value: 'car', label: 'Auto', icon: 'car' },
  { value: 'education', label: 'Educación', icon: 'graduation' },
  { value: 'other', label: 'Otra', icon: 'target' },
];

export interface GoalDraft {
  kind: GoalKind;
  name: string;
  target: string;
}

// "Metas del hogar": shared goals with each member's contributions.
export default function GoalsTab({
  household,
  members,
  me,
  goals,
  money,
  currencySymbol,
  suggestedEmergency,
  draft,
  onDraftUsed,
  onChanged,
}: {
  household: Household;
  members: HouseholdMember[];
  me: HouseholdMember;
  goals: HouseholdGoal[];
  money: Money;
  currencySymbol: string;
  suggestedEmergency: number; // months × average monthly spending (an estimate)
  draft: GoalDraft | null; // e.g. from an insight's "Crear meta"
  onDraftUsed: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<null | {
    id?: string;
    kind: GoalKind;
    name: string;
    target: string;
    date: string;
  }>(null);
  const [giving, setGiving] = useState<HouseholdGoal | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.displayName ?? '—';

  // Open the form with a draft coming from another view.
  React.useEffect(() => {
    if (!draft) return;
    setForm({ kind: draft.kind, name: draft.name, target: draft.target, date: '' });
    onDraftUsed();
  }, [draft, onDraftUsed]);

  const openNew = (kind: GoalKind) => {
    const k = KINDS.find((x) => x.value === kind)!;
    setError('');
    setForm({
      kind,
      name:
        kind === 'emergency' ? 'Fondo de emergencia del hogar' : kind === 'other' ? '' : k.label,
      target: kind === 'emergency' && suggestedEmergency > 0 ? String(suggestedEmergency) : '',
      date: '',
    });
  };

  const save = async () => {
    if (!form) return;
    const target = parseFloat(form.target);
    if (!form.name.trim()) return setError('Ponle un nombre a la meta.');
    if (!(target > 0)) return setError('Ingresa el objetivo.');
    const emoji = KINDS.find((k) => k.value === form.kind)?.icon ?? 'target';
    setSaving(true);
    setError('');
    try {
      if (form.id) {
        await householdGoalsService.update(form.id, {
          name: form.name,
          emoji,
          targetAmount: target,
          targetDate: form.date || null,
        });
      } else {
        await householdGoalsService.create(household.id, {
          name: form.name,
          kind: form.kind,
          emoji,
          targetAmount: target,
          targetDate: form.date || null,
        });
        track('household_goal_created', { kind: form.kind });
        householdService.notify(
          household.id,
          'household_goal',
          'Nueva meta del hogar',
          `${me.displayName} creó la meta "${form.name.trim()}".`
        );
      }
      setForm(null);
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (g: HouseholdGoal) => {
    if (!window.confirm(`¿Eliminar la meta "${g.name}" y sus aportes registrados?`)) return;
    try {
      await householdGoalsService.remove(g.id);
      onChanged();
    } catch (err) {
      toast.showError(err);
    }
  };

  return (
    <div className="space-y-4">
      <section className={`${card} p-5`} aria-label="Metas del hogar">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 flex-1 text-[17px] font-black">Metas del hogar</h2>
          <button
            type="button"
            onClick={() => openNew('other')}
            className="flex h-11 items-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] px-3 text-[14px] font-black shadow-[0_3px_0_#111]"
          >
            <Plus className="h-5 w-5" strokeWidth={3} /> Meta
          </button>
        </div>
        {goals.length === 0 ? (
          <EmptyNote
            action={
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                {KINDS.slice(0, 5).map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => openNew(k.value)}
                    className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#111] bg-white px-3 py-1.5 text-[13px] font-black text-[#111]"
                  >
                    <Glyph name={k.icon} className="h-4 w-4" /> {k.label}
                  </button>
                ))}
              </div>
            }
          >
            ¿Qué quieren conseguir juntos?
          </EmptyNote>
        ) : (
          <ul className="space-y-4">
            {goals.map((g) => {
              const pct = Math.min(100, Math.round((g.saved / g.targetAmount) * 100));
              const byMember = new Map<string, number>();
              for (const c of g.contributions)
                byMember.set(c.memberId, (byMember.get(c.memberId) ?? 0) + c.amount);
              return (
                <li key={g.id} className="rounded-2xl border-2 border-[#111] bg-[#FFF9EC] p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-[#111] bg-white text-2xl">
                      <Glyph name={g.emoji} fallback="target" className="h-6 w-6 text-[#111]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-black">{g.name}</p>
                      <p className="text-[13px] font-semibold text-gray-600">
                        {money(g.saved)} de {money(g.targetAmount)}
                        {g.targetDate &&
                          ` · para el ${new Date(g.targetDate + 'T00:00:00').toLocaleDateString(APP_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      </p>
                    </div>
                    <span className="text-[20px] font-black">{pct}%</span>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full border-2 border-[#111] bg-white">
                    <div
                      className="h-full bg-[#45D98B]"
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                  {byMember.size > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[...byMember.entries()].map(([id, amount]) => (
                        <span
                          key={id}
                          className="flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-xs font-bold"
                        >
                          <Avatar name={nameOf(id)} color={memberColor(members, id)} size={18} />
                          {nameOf(id)} · {money(amount)}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setGiving(g)}
                      className="rounded-xl border-2 border-[#111] bg-[#45D98B] px-3 py-1.5 text-[13px] font-black shadow-[0_2px_0_#111]"
                    >
                      Aportar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          id: g.id,
                          kind: g.kind,
                          name: g.name,
                          target: String(g.targetAmount),
                          date: g.targetDate ?? '',
                        })
                      }
                      className="rounded-xl border-2 border-[#111] bg-white px-3 py-1.5 text-[13px] font-black"
                    >
                      Editar
                    </button>
                    {(me.role === 'owner' || g.createdBy === me.userId) && (
                      <button
                        type="button"
                        onClick={() => remove(g)}
                        aria-label={`Eliminar ${g.name}`}
                        className="grid h-9 w-9 place-items-center rounded-xl border-2 border-[#111]/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {form && (
        <Sheet
          title={form.id ? 'Editar meta' : 'Nueva meta del hogar'}
          onClose={() => setForm(null)}
          busy={saving}
        >
          {!form.id && (
            <Choice
              label="Tipo de meta"
              value={form.kind}
              onChange={(kind) => {
                const k = KINDS.find((x) => x.value === kind)!;
                setForm((f) =>
                  f
                    ? {
                        ...f,
                        kind,
                        name:
                          kind === 'emergency'
                            ? 'Fondo de emergencia del hogar'
                            : f.name || k.label,
                        target:
                          kind === 'emergency' && suggestedEmergency > 0 && !f.target
                            ? String(suggestedEmergency)
                            : f.target,
                      }
                    : f
                );
              }}
              options={KINDS.map((k) => ({
                value: k.value,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Glyph name={k.icon} className="h-4 w-4 shrink-0" /> {k.label}
                  </span>
                ),
              }))}
            />
          )}
          <TextField
            label="Nombre de la meta"
            value={form.name}
            onChange={(name) => setForm((f) => (f ? { ...f, name } : f))}
            placeholder="Ej. Viaje a Cusco"
          />
          <AmountField
            label={`Objetivo (${currencySymbol})`}
            value={form.target}
            onChange={(target) => setForm((f) => (f ? { ...f, target } : f))}
            currency={currencySymbol}
          />
          {form.kind === 'emergency' && suggestedEmergency > 0 && (
            <p className="-mt-2 text-xs font-semibold text-gray-600">
              Estimación: {household.emergencyMonths} meses del gasto mensual promedio del hogar (
              {money(suggestedEmergency)}). Es una referencia, no una asesoría; cámbiala como
              prefieran.
            </p>
          )}
          <DateField
            label="Fecha objetivo (opcional)"
            value={form.date}
            onChange={(date) => setForm((f) => (f ? { ...f, date } : f))}
          />
          {error && <ErrorNote>{error}</ErrorNote>}
          <SubmitButton onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Crear meta'}
          </SubmitButton>
        </Sheet>
      )}

      {giving && (
        <ContributeSheet
          household={household}
          me={me}
          goal={giving}
          currencySymbol={currencySymbol}
          onClose={() => setGiving(null)}
          onDone={() => {
            setGiving(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

// The caller adds a contribution in their own name, optionally moving it from one of
// their own accounts (recorded as an expense "Aporte meta hogar").
function ContributeSheet({
  household,
  me,
  goal,
  currencySymbol,
  onClose,
  onDone,
}: {
  household: Household;
  me: HouseholdMember;
  goal: HouseholdGoal;
  currencySymbol: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [fromAccount, setFromAccount] = useState(false);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [accountId, setAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (!fromAccount || accounts) return;
    accountsService
      .getAll()
      .then((accs) => {
        setAccounts(accs);
        setAccountId((cur) => cur || accs[0]?.id || '');
      })
      .catch(() => setAccounts([]));
  }, [fromAccount, accounts]);

  const save = async () => {
    const n = parseFloat(amount);
    if (!(n > 0)) return setError('Ingresa un monto mayor que cero.');
    const account = accounts?.find((a) => a.id === accountId) ?? null;
    if (fromAccount && !account) return setError('Elige tu cuenta.');
    setSaving(true);
    setError('');
    let created: string | null = null;
    try {
      if (fromAccount && account) {
        const fx = await getFxContext();
        const accCur = account.currency || household.baseCurrency;
        const accAmount =
          Math.round(n * getRateFromMap(fx.ratesMap, household.baseCurrency, accCur) * 100) / 100;
        created = await recordOwnMovement({
          account,
          type: 'gasto',
          amount: accAmount,
          name: `Aporte meta hogar: ${goal.name}`,
          category: 'Hogar',
          categoryIcon: 'sofa',
          date,
          fx,
        });
      }
      await householdGoalsService.contribute(household.id, goal.id, me.id, n, date, created);
      householdService.notify(
        household.id,
        'household_goal',
        'Nuevo aporte a una meta',
        `${me.displayName} aportó a "${goal.name}".`
      );
      onDone();
    } catch (err) {
      if (created) await discardOwnMovement(created);
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Sheet title={`Aportar a ${goal.name}`} onClose={onClose} busy={saving}>
      <AmountField
        label={`Monto (${currencySymbol})`}
        value={amount}
        onChange={setAmount}
        currency={currencySymbol}
      />
      <DateField label="Fecha" value={date} onChange={setDate} />
      <label className="flex items-start gap-3 rounded-2xl border-2 border-[#111]/15 bg-white p-3 text-[15px] font-black text-[#111]">
        <input
          type="checkbox"
          checked={fromAccount}
          onChange={(e) => setFromAccount(e.target.checked)}
          className="mt-0.5 h-5 w-5 accent-[#111]"
        />
        <span>
          Descontarlo de mi cuenta
          <span className="block text-xs font-semibold text-gray-600">
            Se registra como gasto en tu cuenta. Déjalo sin marcar si el dinero ya está separado.
          </span>
        </span>
      </label>
      {fromAccount && (
        <AccountSelect
          accounts={accounts}
          value={accountId}
          onChange={setAccountId}
          label="Cuenta desde la que aporto"
        />
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      <SubmitButton onClick={save} disabled={saving || (fromAccount && accounts === null)}>
        {saving ? 'Guardando…' : 'Registrar aporte'}
      </SubmitButton>
    </Sheet>
  );
}
