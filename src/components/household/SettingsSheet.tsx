'use client';
import React, { useState } from 'react';
import { Crown } from 'lucide-react';
import { SubmitButton, TextField } from '@/components/finance/formKit';
import { getErrorMessage } from '@/lib/dataError';
import type { Household, HouseholdMember } from '@/lib/household';
import { householdService } from '@/lib/supabaseHousehold';
import { Avatar, ErrorNote, SectionLabel, Sheet, memberColor } from '@/components/household/ui';

// ⚙ Household settings: names, members and roles, leave or delete.
export default function SettingsSheet({
  household,
  members,
  me,
  onClose,
  onChanged,
  onGone,
}: {
  household: Household;
  members: HouseholdMember[];
  me: HouseholdMember;
  onClose: () => void;
  onChanged: () => void;
  onGone: () => void; // left or deleted
}) {
  const owner = me.role === 'owner';
  const active = members.filter((m) => m.status === 'active');
  const [name, setName] = useState(household.name);
  const [subtitle, setSubtitle] = useState(household.subtitle);
  const [myName, setMyName] = useState(me.displayName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<void>, after: () => void = onChanged) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      after();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveNames = () =>
    run(async () => {
      if (owner && (name.trim() !== household.name || subtitle.trim() !== household.subtitle)) {
        if (!name.trim()) throw new Error('Escribe el nombre del hogar.');
        await householdService.update(household.id, { name, subtitle });
      }
      if (myName.trim() && myName.trim() !== me.displayName) {
        await householdService.updateMember(me.id, { displayName: myName });
      }
    });

  return (
    <Sheet title="Configuración del hogar" onClose={onClose} busy={busy}>
      {owner && (
        <>
          <TextField label="Nombre del hogar" value={name} onChange={setName} />
          <TextField label="Nombre del grupo (opcional)" value={subtitle} onChange={setSubtitle} />
        </>
      )}
      <TextField label="Mi nombre en el hogar" value={myName} onChange={setMyName} />
      <SubmitButton onClick={saveNames} disabled={busy}>
        Guardar
      </SubmitButton>

      <div>
        <SectionLabel>Personas</SectionLabel>
        <ul className="space-y-2">
          {active.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-2xl border-2 border-[#111]/15 bg-white px-3 py-2"
            >
              <Avatar name={m.displayName} color={memberColor(members, m.id)} size={36} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-[15px] font-black text-[#111]">
                  {m.displayName}
                  {m.id === me.id && <span className="text-gray-500"> (yo)</span>}
                  {m.role === 'owner' && <Crown className="h-4 w-4" aria-label="Administra" />}
                </span>
                <span className="text-xs font-semibold text-gray-600">
                  {m.role === 'owner' ? 'Administra el hogar' : 'Miembro'}
                </span>
              </span>
              {owner && m.id !== me.id && (
                <span className="flex flex-col gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      window.confirm(`¿Pasar la administración del hogar a ${m.displayName}?`) &&
                      run(() => householdService.transferOwnership(m.id))
                    }
                    className="rounded-lg border-2 border-[#111] px-2 py-1 text-[11px] font-black"
                  >
                    Hacer admin
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      window.confirm(
                        `¿Quitar a ${m.displayName} del hogar? Sus gastos quedan en el historial.`
                      ) && run(() => householdService.removeMember(m.id))
                    }
                    className="rounded-lg border-2 border-[#B42318] px-2 py-1 text-[11px] font-black text-[#B42318]"
                  >
                    Quitar
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="space-y-2 border-t-2 border-[#111]/10 pt-4">
        {(!owner || active.length === 1) && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              window.confirm(
                active.length === 1
                  ? 'Eres la única persona: al salir se elimina el hogar y sus datos compartidos. Tus cuentas no se tocan.'
                  : '¿Salir del hogar? Dejarás de ver sus gastos y metas. Tus cuentas no se tocan.'
              ) && run(() => householdService.leave(household.id), onGone)
            }
            className="w-full rounded-2xl border-2 border-[#111] py-3 text-[15px] font-black"
          >
            Salir del hogar
          </button>
        )}
        {owner && active.length > 1 && (
          <p className="text-xs font-semibold text-gray-600">
            Para salir, primero pasa la administración a otra persona.
          </p>
        )}
        {owner && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              window.confirm(
                '¿Eliminar el hogar para todos? Se borran sus gastos, metas y compensaciones compartidas. Las cuentas y movimientos personales de cada uno no se tocan.'
              ) && run(() => householdService.remove(household.id), onGone)
            }
            className="w-full rounded-2xl border-2 border-[#B42318] py-3 text-[15px] font-black text-[#B42318]"
          >
            Eliminar el hogar
          </button>
        )}
      </div>
    </Sheet>
  );
}
