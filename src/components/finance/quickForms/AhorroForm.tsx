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

export default function AhorroForm({ onClose, onSuccess }: QuickFormProps) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('0');
  const [icon, setIcon] = useState('🐷');
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
    <FormWrapper title="Nueva Meta de Ahorro" emoji="🐷" accentBg="bg-[#BBF7D0]" onClose={onClose}>
      <div className="space-y-5">
        <TextField
          label="Nombre de la meta"
          value={name}
          onChange={setName}
          placeholder="Ej. Fondo de emergencia"
        />
        <div className="flex gap-2">
          <div className="flex-1">
            <AmountField label="Meta (S/)" value={target} onChange={setTarget} />
          </div>
          <div className="flex-1">
            <AmountField label="Ya tengo (S/)" value={current} onChange={setCurrent} />
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
                className={`w-9 h-9 rounded-xl border-2 text-lg transition-all ${icon === ic ? 'border-black bg-black' : 'border-gray-200'}`}
              >
                {ic}
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
