'use client';
import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';
import { Check, Hourglass } from 'lucide-react';
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
import { pagosService } from '@/lib/supabaseObligations';
import {
  PAGO_CATEGORIES,
  FormWrapper,
  type QuickFormProps,
} from '@/components/finance/quickForms/shared';
import { currencySymbol } from '@/lib/format';

export default function PagoForm({ onClose, onSuccess }: QuickFormProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Servicios');
  const [categoryIcon, setCategoryIcon] = useState('bulb');
  const [paymentDate, setPaymentDate] = useState(todayLocal());
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'pendiente' | 'pagado'>('pendiente');
  const [choice, setChoice] = useState<AccountChoice>(EMPTY_ACCOUNT_CHOICE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const handleCat = (label: string) => {
    const c = PAGO_CATEGORIES.find((x) => x.label === label);
    setCategory(label);
    setCategoryIcon(c?.icon || 'package');
  };

  const handleSave = async () => {
    if (!name.trim() || !amount) {
      setError('Completa nombre y monto.');
      return;
    }
    const account = status === 'pagado' ? resolveAccountChoice(choice) : null;
    if (account && 'error' in account) {
      setError(account.error);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const pDate = paymentDate || todayLocal();
      const pago = await pagosService.create({
        name: name.trim(),
        amount: parseFloat(amount),
        category,
        categoryIcon,
        paymentDate: pDate,
        notes,
        isRecurring: false,
        paymentDay: new Date(pDate + 'T00:00:00').getDate(),
      });
      if (account) {
        try {
          await pagosService.markPaid(pago.id, account.accountId, account.accountAmount);
        } catch (err) {
          // The payment is saved as pending: retrying the form would duplicate it.
          console.error(err);
          toast.showError('El pago se guardó como pendiente: no se pudo marcar como pagado.');
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
    <FormWrapper title="Nuevo Pago" icon="calendar" accentBg="bg-[#ffd5cc]" onClose={onClose}>
      <div className="space-y-5">
        <TextField label="Nombre" value={name} onChange={setName} placeholder="Ej. Alquiler" />
        <AmountField label={`Monto (${currencySymbol()})`} value={amount} onChange={setAmount} />
        <div>
          <span className="sr-only">Estado</span>
          <div className="flex gap-2">
            {(['pendiente', 'pagado'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-xs font-bold transition-all ${status === s ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-500'}`}
              >
                {s === 'pagado' ? (
                  <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                ) : (
                  <Hourglass className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                )}
                {s === 'pagado' ? 'Pagado' : 'Pendiente'}
              </button>
            ))}
          </div>
        </div>
        {status === 'pagado' && (
          <AccountAmountFields
            amount={parseFloat(amount) || 0}
            value={choice}
            onChange={setChoice}
            label="Cuenta desde la que pagaste"
            selectClassName={FIELD}
          />
        )}
        <DateField label="Fecha de pago" value={paymentDate} onChange={setPaymentDate} />
        <CategoryChips categories={PAGO_CATEGORIES} value={category} onChange={handleCat} />
        <NotesField value={notes} onChange={setNotes} />
        {error && (
          <p className="rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]">
            {error}
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex h-16 w-full items-center justify-center rounded-2xl border-[3px] border-[#111] bg-[#F87171] text-black text-[19px] font-black shadow-[0_5px_0_#111] transition-transform active:translate-y-1 active:shadow-[0_1px_0_#111] disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Registrar pago'}
        </button>
      </div>
    </FormWrapper>
  );
}
