'use client';
import React, { useEffect, useMemo, useState } from 'react';
import {
  AccountSelect,
  AmountField,
  CategoryChips,
  DateField,
  NotesField,
  SubmitButton,
  TextField,
} from '@/components/finance/formKit';
import { accountsService } from '@/lib/supabaseFinance';
import { getFxContext, type FxContext } from '@/lib/supabaseCurrency';
import { getCurrencyInfo, getRateFromMap } from '@/lib/currency';
import { todayLocal } from '@/lib/dates';
import { getErrorMessage } from '@/lib/dataError';
import { track } from '@/lib/analytics';
import { CATEGORY_PRESETS, type Account } from '@/lib/financeStore';
import {
  householdShares,
  nextOccurrence,
  splitAmount,
  twoWayShares,
  type Frequency,
  type Household,
  type HouseholdExpense,
  type HouseholdMember,
  type Share,
} from '@/lib/household';
import {
  discardOwnMovement,
  householdExpensesService,
  householdService,
  recordOwnMovement,
} from '@/lib/supabaseHousehold';
import { Choice, ErrorNote, SectionLabel, Sheet } from '@/components/household/ui';

const CATEGORIES = CATEGORY_PRESETS.filter((c) => c.id !== 'ingreso').map((c) => ({
  label: c.label,
  icon: c.icon,
}));

type SplitChoice = 'household' | '50' | '70' | 'custom';

// New or edited shared expense: who paid, for whom, and how it is divided. When the
// caller paid it, it can also be recorded in one of their own accounts (the only real
// balance that moves).
export default function ExpenseSheet({
  household,
  members,
  me,
  expense,
  prefill,
  onClose,
  onSaved,
  canDelete,
}: {
  household: Household;
  members: HouseholdMember[];
  me: HouseholdMember;
  expense?: HouseholdExpense | null; // edit
  prefill?: Partial<HouseholdExpense> | null; // e.g. next occurrence of a recurring one
  onClose: () => void;
  onSaved: () => void;
  canDelete?: boolean;
}) {
  const active = useMemo(() => members.filter((m) => m.status === 'active'), [members]);
  const base = expense ?? prefill ?? null;
  const editing = !!expense;

  const [amount, setAmount] = useState(base?.amount ? String(base.amount) : '');
  const [currency, setCurrency] = useState(base?.currencyCode ?? household.baseCurrency);
  const [name, setName] = useState(base?.name ?? '');
  const [category, setCategory] = useState(base?.category ?? 'Vivienda');
  const [date, setDate] = useState(base?.expenseDate ?? todayLocal());
  const [paidBy, setPaidBy] = useState(base?.paidBy ?? me.id);
  const initialFor =
    base?.responsibility === 'member' && base.splits?.[0] ? base.splits[0].memberId : 'shared';
  const [forWhom, setForWhom] = useState<string>(initialFor);
  const [splitChoice, setSplitChoice] = useState<SplitChoice>(
    household.splitMethod === 'equal' ? '50' : 'household'
  );
  const [customPct, setCustomPct] = useState(
    base?.splits && base.splits.length === 2 ? String(base.splits[0].percentage) : '60'
  );
  const [recurring, setRecurring] = useState(base?.isRecurring ?? false);
  const [frequency, setFrequency] = useState<Frequency>(base?.frequency ?? 'monthly');
  const [notes, setNotes] = useState(base?.notes ?? '');
  const [inAccount, setInAccount] = useState(!editing);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [accountId, setAccountId] = useState('');
  const [fx, setFx] = useState<FxContext>({ baseCurrency: 'PEN', ratesMap: {} });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Editing a split that is not 50/50: start on "Personalizado" with its percentage.
  useEffect(() => {
    if (!expense || expense.responsibility !== 'shared') return;
    const s = expense.splits;
    if (s.length === 2 && Math.abs(s[0].percentage - 50) > 0.001) setSplitChoice('custom');
    else if (s.length === 2) setSplitChoice('50');
  }, [expense]);

  useEffect(() => {
    Promise.all([accountsService.getAll(), getFxContext()])
      .then(([accs, f]) => {
        setAccounts(accs);
        setAccountId((cur) => cur || accs[0]?.id || '');
        setFx(f);
      })
      .catch(() => setAccounts([]));
  }, []);

  const myPayment = paidBy === me.id && !editing;
  const account = accounts?.find((a) => a.id === accountId) ?? null;
  // Paying from an account: the expense is in that account's currency.
  const effCurrency = myPayment && inAccount && account ? account.currency || 'PEN' : currency;
  const rate =
    effCurrency === household.baseCurrency
      ? 1
      : getRateFromMap(fx.ratesMap, effCurrency, household.baseCurrency);
  const amountNum = parseFloat(amount) || 0;
  const baseAmount = Math.round(amountNum * rate * 100) / 100;
  const sym = getCurrencyInfo(effCurrency).symbol;
  const baseSym = getCurrencyInfo(household.baseCurrency).symbol;

  const two = active.length === 2;
  const householdDefault = householdShares(household.splitMethod, members);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.displayName ?? '—';

  const shares: Share[] | null = (() => {
    if (forWhom !== 'shared') return [{ memberId: forWhom, percentage: 100 }];
    if (splitChoice === 'household') return householdDefault.ok ? householdDefault.shares : null;
    if (two && splitChoice === '50') return twoWayShares(active[0].id, active[1].id, 50);
    if (two && splitChoice === '70') return twoWayShares(active[0].id, active[1].id, 70);
    if (two && splitChoice === 'custom') {
      const p = parseFloat(customPct);
      return p > 0 && p < 100 ? twoWayShares(active[0].id, active[1].id, p) : null;
    }
    // More than 2 members: equal parts.
    const eq = householdShares('equal', members);
    return eq.ok ? eq.shares : null;
  })();

  const preview = shares && baseAmount > 0 ? splitAmount(baseAmount, shares) : [];

  const splitOptions: { value: SplitChoice; label: string; hint?: string }[] = [
    ...(household.splitMethod !== 'equal' && householdDefault.ok
      ? [
          {
            value: 'household' as const,
            label: 'Como el hogar',
            hint: householdDefault.shares.map((s) => `${Math.round(s.percentage)}%`).join(' / '),
          },
        ]
      : []),
    ...(two
      ? [
          { value: '50' as const, label: '50/50' },
          {
            value: '70' as const,
            label: '70/30',
            hint: `${active[0].displayName} 70%`,
          },
          { value: 'custom' as const, label: 'Personalizado' },
        ]
      : [{ value: '50' as const, label: 'Partes iguales' }]),
  ];

  const save = async () => {
    if (!(amountNum > 0)) return setError('Ingresa un monto mayor que cero.');
    if (!name.trim()) return setError('Escribe una descripción.');
    if (!shares)
      return setError('Revisa cómo se divide el gasto (los porcentajes deben sumar 100%).');
    if (!(rate > 0)) return setError('Falta el tipo de cambio para esa moneda.');
    if (myPayment && inAccount && !account) return setError('Elige la cuenta con la que pagaste.');
    setSaving(true);
    setError('');
    let txId: string | null = expense?.transactionId ?? null;
    let created: string | null = null;
    try {
      const icon = CATEGORY_PRESETS.find((c) => c.label === category)?.icon ?? '🏠';
      if (myPayment && inAccount && account) {
        created = await recordOwnMovement({
          account,
          type: 'gasto',
          amount: amountNum,
          name: name.trim(),
          category,
          categoryIcon: icon,
          date,
          fx,
        });
        txId = created;
      }
      await householdExpensesService.save(household.id, expense?.id ?? null, {
        paidBy,
        name: name.trim(),
        category,
        amount: amountNum,
        currency: effCurrency,
        exchangeRate: rate,
        date,
        responsibility: forWhom === 'shared' ? 'shared' : 'member',
        shares,
        isRecurring: recurring,
        frequency: recurring ? frequency : null,
        nextDate: recurring ? nextOccurrence(date, frequency) : null,
        notes,
        transactionId: txId,
      });
      if (!editing) {
        track('household_expense_created', {
          shared: forWhom === 'shared',
          recurring,
          in_account: !!created,
        });
        if (forWhom === 'shared') track('household_expense_split', { method: splitChoice });
        householdService.notify(
          household.id,
          'household_expense',
          'Nuevo gasto compartido',
          `${me.displayName} agregó "${name.trim()}" al hogar.`
        );
      }
      onSaved();
    } catch (err) {
      if (created) await discardOwnMovement(created);
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!expense) return;
    if (
      !window.confirm(
        'Se quitará del hogar. Si se registró en tu cuenta, ese gasto sigue en tus Movimientos.'
      )
    )
      return;
    setSaving(true);
    try {
      await householdExpensesService.remove(expense.id);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Sheet
      title={editing ? 'Editar gasto del hogar' : 'Nuevo gasto del hogar'}
      onClose={onClose}
      busy={saving}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <AmountField label={`Monto (${sym})`} value={amount} onChange={setAmount} currency={sym} />
        {!(myPayment && inAccount) && (
          <select
            aria-label="Moneda"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="h-14 rounded-2xl border-[3px] border-[#111] bg-white px-3 text-[16px] font-black"
          >
            {['PEN', 'USD', 'EUR'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>
      {effCurrency !== household.baseCurrency && amountNum > 0 && (
        <p className="-mt-2 text-xs font-bold text-gray-600">
          ≈ {baseSym} {baseAmount.toFixed(2)} para el hogar (1 {effCurrency} = {rate.toFixed(4)}{' '}
          {household.baseCurrency})
        </p>
      )}
      <TextField
        label="Descripción"
        value={name}
        onChange={setName}
        placeholder="Ej. Alquiler, Internet"
      />
      <CategoryChips categories={CATEGORIES} value={category} onChange={setCategory} />
      <DateField label="Fecha" value={date} onChange={setDate} />

      <div>
        <SectionLabel>¿Quién pagó?</SectionLabel>
        <Choice
          label="¿Quién pagó?"
          value={paidBy}
          onChange={setPaidBy}
          options={active.map((m) => ({
            value: m.id,
            label: m.id === me.id ? `${m.displayName} (yo)` : m.displayName,
          }))}
        />
      </div>

      <div>
        <SectionLabel>¿Para quién es?</SectionLabel>
        <Choice
          label="¿Para quién es?"
          value={forWhom}
          onChange={setForWhom}
          options={[
            ...active.map((m) => ({ value: m.id, label: `👤 ${m.displayName}` })),
            { value: 'shared', label: two ? '🏠 Ambos' : '🏠 Todos' },
          ]}
        />
      </div>

      {forWhom === 'shared' && (
        <div>
          <SectionLabel>¿Cómo dividirlo?</SectionLabel>
          <Choice
            label="¿Cómo dividirlo?"
            value={splitChoice}
            onChange={setSplitChoice}
            options={splitOptions}
          />
          {splitChoice === 'custom' && two && (
            <label className="mt-3 flex items-center gap-2 text-sm font-bold text-[#111]">
              {active[0].displayName}
              <input
                type="number"
                inputMode="decimal"
                min="1"
                max="99"
                value={customPct}
                onChange={(e) => setCustomPct(e.target.value)}
                className="h-12 w-24 rounded-xl border-[3px] border-[#111] bg-white px-3 text-[16px] font-black"
              />
              % · {active[1].displayName} {Math.max(0, 100 - (parseFloat(customPct) || 0))}%
            </label>
          )}
        </div>
      )}

      {preview.length > 0 && (
        <ul className="rounded-2xl border-2 border-[#111] bg-white px-4 py-2.5 text-sm font-bold text-[#111]">
          {preview.map((p) => (
            <li key={p.memberId} className="flex justify-between py-0.5">
              <span>{nameOf(p.memberId)}</span>
              <span>
                {baseSym} {p.amount.toFixed(2)}{' '}
                <span className="text-gray-500">({Math.round(p.percentage * 10) / 10}%)</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <label className="flex items-center gap-3 rounded-2xl border-2 border-[#111]/15 bg-white px-4 py-3 text-[15px] font-black text-[#111]">
        <input
          type="checkbox"
          checked={recurring}
          onChange={(e) => setRecurring(e.target.checked)}
          className="h-5 w-5 accent-[#111]"
        />
        Se repite
      </label>
      {recurring && (
        <Choice
          label="Frecuencia"
          value={frequency}
          onChange={setFrequency}
          options={[
            { value: 'monthly', label: 'Mensual' },
            { value: 'weekly', label: 'Semanal' },
            { value: 'yearly', label: 'Anual' },
          ]}
        />
      )}

      {myPayment && (
        <div className="space-y-3 rounded-2xl border-2 border-[#111]/15 bg-white p-3">
          <label className="flex items-start gap-3 text-[15px] font-black text-[#111]">
            <input
              type="checkbox"
              checked={inAccount}
              onChange={(e) => setInAccount(e.target.checked)}
              className="mt-0.5 h-5 w-5 accent-[#111]"
            />
            <span>
              Descontarlo de mi cuenta
              <span className="block text-xs font-semibold text-gray-600">
                Se registra como gasto en tu cuenta. Las otras personas del hogar no la ven.
                Desmárcalo si ya lo registraste en MONEO.
              </span>
            </span>
          </label>
          {inAccount && (
            <AccountSelect
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
              label="Cuenta con la que pagué"
            />
          )}
        </div>
      )}
      {editing && expense?.transactionId && (
        <p className="text-xs font-semibold text-gray-600">
          El gasto en tu cuenta no cambia al editar aquí; si cambió el monto, edítalo en
          Movimientos.
        </p>
      )}

      <NotesField value={notes} onChange={setNotes} />
      {error && <ErrorNote>{error}</ErrorNote>}
      <SubmitButton
        onClick={save}
        disabled={saving || (myPayment && inAccount && accounts === null)}
      >
        {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar al hogar'}
      </SubmitButton>
      {editing && canDelete && (
        <button
          type="button"
          onClick={remove}
          disabled={saving}
          className="w-full rounded-2xl border-2 border-[#B42318] py-3 text-[15px] font-black text-[#B42318] disabled:opacity-50"
        >
          Eliminar del hogar
        </button>
      )}
    </Sheet>
  );
}
