'use client';
import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';
import { todayLocal } from '@/lib/dates';
import {
  AmountField,
  CategoryChips,
  DateField,
  FIELD,
  NotesField,
  TextField,
} from '@/components/finance/formKit';
import {
  AccountAmountFields,
  EMPTY_ACCOUNT_CHOICE,
  resolveAccountChoice,
  type AccountChoice,
} from '@/components/finance/AccountAmountPicker';
import { incomeService } from '@/lib/supabaseObligations';
import {
  INCOME_CATEGORIES,
  FormWrapper,
  type QuickFormProps,
} from '@/components/finance/quickForms/shared';
import { currencySymbol } from '@/lib/format';

export default function IngresoForm({ onClose, onSuccess }: QuickFormProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Salario');
  const [categoryIcon, setCategoryIcon] = useState('💼');
  const [collectionDate, setCollectionDate] = useState(todayLocal());
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'pendiente' | 'cobrado'>('cobrado');
  const [choice, setChoice] = useState<AccountChoice>(EMPTY_ACCOUNT_CHOICE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const handleCat = (label: string) => {
    const c = INCOME_CATEGORIES.find((x) => x.label === label);
    setCategory(label);
    setCategoryIcon(c?.icon || '💰');
  };

  const handleSave = async () => {
    if (!name.trim() || !amount) {
      setError('Completa nombre y monto.');
      return;
    }
    const account = status === 'cobrado' ? resolveAccountChoice(choice) : null;
    if (account && 'error' in account) {
      setError(account.error);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const entry = await incomeService.create({
        name: name.trim(),
        amount: parseFloat(amount),
        category,
        categoryIcon,
        collectionDate: collectionDate || todayLocal(),
        notes,
      });
      if (account) {
        try {
          await incomeService.markCollected(entry.id, account.accountId, account.accountAmount);
        } catch (err) {
          // The entry is saved as pending: retrying the form would duplicate it.
          console.error(err);
          toast.showError('El ingreso se guardó como pendiente: no se pudo marcar como cobrado.');
        }
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormWrapper title="Nuevo Ingreso" emoji="➕" accentBg="bg-[#e1c2fd]" onClose={onClose}>
      <div className="space-y-5">
        <TextField label="Nombre" value={name} onChange={setName} placeholder="Ej. Sueldo enero" />
        <AmountField label={`Monto (${currencySymbol()})`} value={amount} onChange={setAmount} />
        <div>
          <span className="sr-only">Estado</span>
          <div className="flex gap-2">
            {(['cobrado', 'pendiente'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all ${status === s ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-500'}`}
              >
                {s === 'cobrado' ? '✅ Cobrado' : '⏳ Por cobrar'}
              </button>
            ))}
          </div>
        </div>
        {status === 'cobrado' && (
          <AccountAmountFields
            amount={parseFloat(amount) || 0}
            value={choice}
            onChange={setChoice}
            label="Cuenta donde cobraste"
            selectClassName={FIELD}
          />
        )}
        <DateField label="Fecha de cobro" value={collectionDate} onChange={setCollectionDate} />
        <CategoryChips categories={INCOME_CATEGORIES} value={category} onChange={handleCat} />
        <NotesField value={notes} onChange={setNotes} />
        {error && (
          <p className="rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]">
            {error}
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex h-16 w-full items-center justify-center rounded-2xl border-[3px] border-[#111] bg-[#C084FC] text-black text-[19px] font-black shadow-[0_5px_0_#111] transition-transform active:translate-y-1 active:shadow-[0_1px_0_#111] disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Registrar ingreso'}
        </button>
      </div>
    </FormWrapper>
  );
}
