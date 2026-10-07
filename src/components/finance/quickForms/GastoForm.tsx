'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { transactionsService, accountsService } from '@/lib/supabaseFinance';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';
import { buildCurrencyFields, getRateFromMap } from '@/lib/currency';
import { getFxContext } from '@/lib/supabaseCurrency';
import { localDateTimeToISO, nowTimeLocal, todayLocal } from '@/lib/dates';
import { AccountSelect } from '@/components/finance/formKit';
import HouseholdShareToggle, {
  useHouseholdShare,
} from '@/components/household/HouseholdShareToggle';
import { shareOwnMovement } from '@/lib/supabaseHousehold';
import {
  EntryMethodPicker,
  ImageReader,
  VoiceReader,
  type EntryMethod,
  type Prefill,
} from '@/components/finance/ExpenseEntry';
import { usePlus } from '@/contexts/PlusContext';
import type { Account } from '@/lib/financeStore';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_ALIASES,
  FormWrapper,
  FormFields,
  type QuickFormProps,
} from '@/components/finance/quickForms/shared';

export default function GastoForm({ onClose, onSuccess }: QuickFormProps) {
  const router = useRouter();
  const { plus } = usePlus();
  // First "¿Cómo quieres ingresar el gasto?", then the form (pre-filled when read).
  const [mode, setMode] = useState<'choose' | EntryMethod>('choose');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Comida');
  const [categoryIcon, setCategoryIcon] = useState('🍽️');
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [accountId, setAccountId] = useState('');
  const toast = useToast();
  const home = useHouseholdShare(category, mode === 'manual');

  useEffect(() => {
    accountsService
      .getAll()
      .then((accs) => {
        setAccounts(accs);
        // First registered account preselected; the user can change it.
        setAccountId((cur) => cur || accs[0]?.id || '');
      })
      .catch((err) => {
        console.error(err);
        setAccounts([]);
        setError(getErrorMessage(err));
      });
  }, []);

  const handleCat = (label: string) => {
    const c = EXPENSE_CATEGORIES.find((x) => x.label === label);
    setCategory(label);
    setCategoryIcon(c?.icon || '📦');
  };

  const handleSave = async () => {
    if (!name.trim() || !amount) {
      setError('Completa nombre y monto.');
      return;
    }
    const account = accounts?.find((a) => a.id === accountId);
    if (!account) {
      setError('Elige la cuenta de la que sale el gasto.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const fx = await getFxContext();
      const accCurrency = account.currency || 'PEN';
      const amt = -Math.abs(parseFloat(amount));
      const tx = await transactionsService.create({
        name: name.trim(),
        type: 'gasto',
        amount: amt,
        category,
        categoryIcon,
        accountId: account.id,
        account: account.name,
        notes,
        date: localDateTimeToISO(date, nowTimeLocal()),
        time: nowTimeLocal(),
        ...buildCurrencyFields({
          amount: amt,
          currency: accCurrency,
          baseCurrency: fx.baseCurrency,
          rateToBase: getRateFromMap(fx.ratesMap, accCurrency, fx.baseCurrency),
          date,
        }),
      });
      if (home.checked) {
        // The expense is saved: a failure here only skips the household.
        await shareOwnMovement({
          transactionId: tx.id,
          name: name.trim(),
          category,
          amount: Math.abs(amt),
          currency: accCurrency,
          date,
        }).catch((err) =>
          toast.showError(`Se registró, pero no se pudo agregar al hogar: ${getErrorMessage(err)}`)
        );
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const applyPrefill = (p: Prefill | null, heard?: string) => {
    if (p) {
      if (p.name) setName(p.name.slice(0, 80));
      if (p.amount) setAmount(p.amount);
      if (p.date) setDate(p.date);
      const label = p.category ? (EXPENSE_CATEGORY_ALIASES[p.category] ?? p.category) : null;
      if (label && EXPENSE_CATEGORIES.some((c) => c.label === label)) handleCat(label);
      setNotice('Revisa los datos detectados, elige la cuenta y registra.');
    } else {
      if (heard) setName(heard.slice(0, 80));
      setNotice('No encontramos el monto. Complétalo a mano.');
    }
    setMode('manual');
  };

  if (mode === 'choose') {
    return (
      <EntryMethodPicker
        plus={plus}
        onBack={onClose}
        onPick={(m) => {
          setNotice('');
          setMode(m);
        }}
        onLocked={() => router.push('/finanzas/plus')}
      />
    );
  }
  if (mode === 'scan' || mode === 'image') {
    return (
      <ImageReader
        camera={mode === 'scan'}
        onDone={(p) => applyPrefill(p)}
        onCancel={() => setMode('choose')}
      />
    );
  }
  if (mode === 'voice') {
    return <VoiceReader onDone={applyPrefill} onCancel={() => setMode('choose')} />;
  }

  return (
    <FormWrapper
      title="Nuevo Gasto"
      emoji="🧾"
      accentBg="bg-[#fde899]"
      onClose={() => setMode('choose')}
    >
      {notice && (
        <p className="mb-4 rounded-2xl border-2 border-[#111] bg-[#DDF7E9] px-3 py-2 text-sm font-bold text-[#111]">
          {notice}
        </p>
      )}
      <div className="mb-5">
        <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
      </div>
      <FormFields
        name={name}
        setName={setName}
        amount={amount}
        setAmount={setAmount}
        date={date}
        setDate={setDate}
        notes={notes}
        setNotes={setNotes}
        categories={EXPENSE_CATEGORIES}
        category={category}
        onCategoryChange={handleCat}
        error={error}
        saving={saving}
        onSave={handleSave}
        saveLabel="Registrar gasto"
        extra={
          <HouseholdShareToggle
            householdName={home.householdName}
            suggested={home.suggested}
            checked={home.checked}
            onChange={home.setChecked}
          />
        }
      />
    </FormWrapper>
  );
}
