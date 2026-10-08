'use client';
import { useState } from 'react';
import { subscriptionsService } from '@/lib/supabaseFinance';
import { getErrorMessage } from '@/lib/dataError';
import { AmountField, DateField, TextField } from '@/components/finance/formKit';
import { FormWrapper, type QuickFormProps } from '@/components/finance/quickForms/shared';
import { currencySymbol } from '@/lib/format';
import Glyph from '@/components/ui/Glyph';
import { glyphKey } from '@/lib/glyphs';

export default function SuscripcionForm({ onClose, onSuccess }: QuickFormProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [nextPaymentDate, setNextPaymentDate] = useState('');
  const [icon, setIcon] = useState('film');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !amount || !nextPaymentDate) {
      setError('Completa nombre, monto y fecha.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const paymentDay = new Date(nextPaymentDate + 'T00:00:00').getDate();
      await subscriptionsService.create({
        name: name.trim(),
        category: 'Entretenimiento',
        amount: parseFloat(amount),
        nextDate: nextPaymentDate,
        nextPaymentDate,
        paymentDay,
        paymentStatus: 'pending',
        active: true,
        icon,
        color: '#7C3AED',
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormWrapper title="Nueva Suscripción" icon="tv" accentBg="bg-[#bfdbfe]" onClose={onClose}>
      <div className="space-y-5">
        <TextField label="Nombre" value={name} onChange={setName} placeholder="Ej. Netflix" />
        <AmountField
          label={`Monto mensual (${currencySymbol()})`}
          value={amount}
          onChange={setAmount}
        />
        <DateField label="Próximo pago" value={nextPaymentDate} onChange={setNextPaymentDate} />
        <div>
          <span className="sr-only">Ícono</span>
          <div className="flex flex-wrap gap-2">
            {['film', 'music', 'satellite', 'cloud', 'phone', 'gamepad', 'book', 'repeat'].map(
              (ic) => (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  aria-label={`Ícono ${ic}`}
                  aria-pressed={glyphKey(icon) === ic}
                  className={`grid w-9 h-9 place-items-center rounded-xl border-2 transition-all ${glyphKey(icon) === ic ? 'border-black bg-black text-white' : 'border-gray-200 text-[#111]'}`}
                >
                  <Glyph name={ic} className="h-5 w-5" />
                </button>
              )
            )}
          </div>
        </div>
        {error && (
          <p className="rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]">
            {error}
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex h-16 w-full items-center justify-center rounded-2xl border-[3px] border-[#111] bg-[#3B82F6] text-white text-[19px] font-black shadow-[0_5px_0_#111] transition-transform active:translate-y-1 active:shadow-[0_1px_0_#111] disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Registrar suscripción'}
        </button>
      </div>
    </FormWrapper>
  );
}
