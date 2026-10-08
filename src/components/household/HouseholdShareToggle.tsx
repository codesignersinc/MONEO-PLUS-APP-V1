'use client';
import React, { useEffect, useState } from 'react';
import { looksLikeHouseholdExpense } from '@/lib/household';
import { householdService } from '@/lib/supabaseHousehold';
import Glyph from '@/components/ui/Glyph';

// "Agregarlo a mi hogar" for a new expense: only for people in a household; preselected
// when the category usually belongs to the household. The movement stays private.
export function useHouseholdShare(category: string, enabled = true) {
  const [name, setName] = useState<string | null>(null);
  const [choice, setChoice] = useState<boolean | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    householdService
      .getMine()
      .then((h) => alive && setName(h?.household.name ?? null))
      .catch(() => alive && setName(null));
    return () => {
      alive = false;
    };
  }, [enabled]);
  const suggested = looksLikeHouseholdExpense(category);
  return {
    householdName: name,
    suggested,
    checked: !!name && enabled && (choice ?? suggested),
    setChecked: (v: boolean) => setChoice(v),
  };
}

export default function HouseholdShareToggle({
  householdName,
  suggested,
  checked,
  onChange,
}: {
  householdName: string | null;
  suggested: boolean;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  if (!householdName) return null;
  return (
    <label
      className={`flex items-start gap-3 rounded-2xl border-2 p-3 text-[15px] font-black text-[#111] ${suggested ? 'border-[#111] bg-[#FFF4CC]' : 'border-[#111]/15 bg-white'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 accent-[#111]"
      />
      <span>
        <span className="inline-flex items-center gap-1.5">
          <Glyph name="home" className="h-4 w-4 shrink-0" /> Agregarlo a {householdName}
        </span>
        <span className="block text-xs font-semibold text-gray-600">
          Lo pagaste tú y se reparte según el hogar. Tu cuenta sigue siendo privada.
        </span>
      </span>
    </label>
  );
}
