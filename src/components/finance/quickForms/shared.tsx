'use client';
import React from 'react';
import { ChevronLeft } from 'lucide-react';
import {
  AmountField,
  CategoryChips,
  DateField,
  FormHero,
  NotesField,
  SubmitButton,
  TextField,
} from '@/components/finance/formKit';
import { currencySymbol } from '@/lib/format';

export const EXPENSE_CATEGORIES = [
  { label: 'Comida', icon: '🍽️' },
  { label: 'Transporte', icon: '🚗' },
  { label: 'Salud', icon: '💊' },
  { label: 'Entretenimiento', icon: '🎬' },
  { label: 'Ropa', icon: '👕' },
  { label: 'Hogar', icon: '🏠' },
  { label: 'Educación', icon: '📚' },
  { label: 'Otro', icon: '📦' },
];

export const INCOME_CATEGORIES = [
  { label: 'Salario', icon: '💼' },
  { label: 'Freelance', icon: '💻' },
  { label: 'Negocio', icon: '🏪' },
  { label: 'Inversión', icon: '📈' },
  { label: 'Alquiler', icon: '🏠' },
  { label: 'Bono', icon: '🎁' },
  { label: 'Comisión', icon: '🤝' },
  { label: 'Otro', icon: '💰' },
];

export const PAGO_CATEGORIES = [
  { label: 'Servicios', icon: '💡' },
  { label: 'Alquiler', icon: '🏠' },
  { label: 'Alimentación', icon: '🛒' },
  { label: 'Transporte', icon: '🚗' },
  { label: 'Salud', icon: '💊' },
  { label: 'Educación', icon: '📚' },
  { label: 'Entretenimiento', icon: '🎬' },
  { label: 'Otro', icon: '📦' },
];

export const GOAL_ICONS = ['🐷', '🛡️', '✈️', '🚗', '💻', '🏠', '📱', '🎓', '💍', '🌟'];

// Maps the interpreter's category (CATEGORY_PRESETS labels) to the quick-add expense ones.
export const EXPENSE_CATEGORY_ALIASES: Record<string, string> = {
  Supermercado: 'Comida',
  Vivienda: 'Hogar',
  Servicios: 'Hogar',
  Suscripciones: 'Entretenimiento',
  Otros: 'Otro',
};

export const FORM_SUBTITLES: Record<string, string> = {
  'Nuevo Gasto': 'Registra un gasto y mantén el control de tu dinero.',
  'Nuevo Ingreso': 'Anota lo que cobras o lo que te deben pagar.',
  'Nuevo Pago': 'Programa un pago y te avisamos antes.',
  'Nueva Suscripción': 'Ten a la vista tus cobros mensuales.',
  'Nueva Transferencia': 'Mueve dinero entre tus cuentas.',
  'Nueva Meta de Ahorro': 'Ponle nombre y fecha a lo que quieres lograr.',
};

export function FormWrapper({
  title,
  emoji,
  accentBg,
  onClose,
  children,
}: {
  title: string;
  emoji: string;
  accentBg: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const tone = accentBg.match(/#[0-9a-fA-F]{6}/)?.[0] ?? '#FFD83D';
  return (
    <div className="px-4 pb-8">
      <button
        onClick={onClose}
        className="mb-4 flex items-center gap-1.5 text-[17px] font-black text-[#111]"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.8} />
        Volver
      </button>
      <FormHero
        title={title.charAt(0) + title.slice(1).toLowerCase()}
        subtitle={FORM_SUBTITLES[title] ?? ''}
        emoji={emoji}
        tone={tone}
      />
      {children}
    </div>
  );
}

export function FormFields({
  name,
  setName,
  amount,
  setAmount,
  date,
  setDate,
  notes,
  setNotes,
  categories,
  category,
  onCategoryChange,
  error,
  saving,
  onSave,
  saveLabel,
  hideCategories,
  extra,
}: {
  name: string;
  setName: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  categories: { label: string; icon: string }[];
  category: string;
  onCategoryChange: (v: string) => void;
  error: string;
  saving: boolean;
  onSave: () => void;
  saveLabel: string;
  hideCategories?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <TextField
        label="Nombre del gasto"
        value={name}
        onChange={setName}
        placeholder="Ej. Almuerzo"
        icon={categories.find((c) => c.label === category)?.icon}
      />
      <div className="grid grid-cols-2 gap-3">
        <AmountField label={`Monto (${currencySymbol()})`} value={amount} onChange={setAmount} />
        <DateField label="Fecha" value={date} onChange={setDate} />
      </div>
      {!hideCategories && categories.length > 0 && (
        <CategoryChips categories={categories} value={category} onChange={onCategoryChange} />
      )}
      <NotesField value={notes} onChange={setNotes} />
      {extra}
      {error && (
        <p className="rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]">
          {error}
        </p>
      )}
      <SubmitButton onClick={onSave} disabled={saving} tone="#FFD83D">
        {saving ? 'Guardando…' : saveLabel}
      </SubmitButton>
    </div>
  );
}

export interface QuickFormProps {
  onClose: () => void;
  onSuccess: () => void;
}
