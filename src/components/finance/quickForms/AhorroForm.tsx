'use client';
import { useState } from 'react';
import { savingsService } from '@/lib/supabaseFinance';
import { getErrorMessage } from '@/lib/dataError';
import { AmountField, DateField, TextField } from '@/components/finance/formKit';
import {
  GOAL_ICONS,
  FormWrapper,
  type QuickFormProps,
} from '@/components/finance/quickForms/shared';
import { currencySymbol } from '@/lib/format';
import Glyph from '@/components/ui/Glyph';
import { glyphKey } from '@/lib/glyphs';

export default function AhorroForm({ onClose, onSuccess }: QuickFormProps) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('0');
  const [icon, setIcon] = useState('piggy');
  const [targetDate, setTargetDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !target) {
      setError('Completa nombre y meta.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await savingsService.create({
        name: name.trim(),
        icon,
        current: parseFloat(current) || 0,
        target: parseFloat(target),
        color: '#16A34A',
        targetDate,
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
    <FormWrapper
      title="Nueva Meta de Ahorro"
      icon="piggy"
      accentBg="bg-[#BBF7D0]"
      onClose={onClose}
    >
      <div className="space-y-5">
        <TextField
          label="Nombre de la meta"
          value={name}
          onChange={setName}
          placeholder="Ej. Fondo de emergencia"
        />
        <div className="flex gap-2">
          <div className="flex-1">
            <AmountField label={`Meta (${currencySymbol()})`} value={target} onChange={setTarget} />
          </div>
          <div className="flex-1">
            <AmountField
              label={`Ya tengo (${currencySymbol()})`}
              value={current}
              onChange={setCurrent}
            />
          </div>
        </div>
        <DateField label="Fecha objetivo" value={targetDate} onChange={setTargetDate} />
        <div>
          <span className="sr-only">Ícono</span>
          <div className="flex flex-wrap gap-2">
            {GOAL_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                aria-label={`Ícono ${ic}`}
                aria-pressed={glyphKey(icon) === ic}
                className={`grid w-9 h-9 place-items-center rounded-xl border-2 transition-all ${glyphKey(icon) === ic ? 'border-black bg-black text-white' : 'border-gray-200 text-[#111]'}`}
              >
                <Glyph name={ic} className="h-5 w-5" />
              </button>
            ))}
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
          className="flex h-16 w-full items-center justify-center rounded-2xl border-[3px] border-[#111] bg-[#22C55E] text-black text-[19px] font-black shadow-[0_5px_0_#111] transition-transform active:translate-y-1 active:shadow-[0_1px_0_#111] disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Crear meta de ahorro'}
        </button>
      </div>
    </FormWrapper>
  );
}
