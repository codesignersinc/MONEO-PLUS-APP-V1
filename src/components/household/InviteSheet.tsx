'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Link2, Share2 } from 'lucide-react';
import { SubmitButton, TextField } from '@/components/finance/formKit';
import { householdService, type Invitation } from '@/lib/supabaseHousehold';
import { getErrorMessage } from '@/lib/dataError';
import { track } from '@/lib/analytics';
import { ErrorNote, SectionLabel, Sheet } from '@/components/household/ui';
import type { Household } from '@/lib/household';

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

// "Invitar": a single-use link (7 days), optionally only for one email. Owner only.
export default function InviteSheet({
  household,
  inviterName,
  onClose,
}: {
  household: Household;
  inviterName: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Invitation[]>([]);

  const loadPending = useCallback(() => {
    householdService
      .invitations(household.id)
      .then((list) =>
        setPending(
          list.filter(
            (i) => !i.acceptedAt && !i.revokedAt && new Date(i.expiresAt).getTime() > Date.now()
          )
        )
      )
      .catch(() => setPending([]));
  }, [household.id]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const token = await householdService.invite(household.id, email);
      setLink(`${window.location.origin}/hogar/unirse/${token}`);
      setCopied(false);
      track('household_invitation_sent', { with_email: !!email.trim() });
      loadPending();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const message = `${inviterName} te invita a "${household.name}" en MONEO HOGAR para organizar los gastos de la casa sin mezclar sus cuentas. Únete aquí: ${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError('No se pudo copiar. Mantén presionado el enlace para copiarlo.');
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'MONEO HOGAR', text: message });
        return;
      } catch {
        // cancelled: fall back to WhatsApp below only on explicit tap
        return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  };

  const revoke = async (id: string) => {
    try {
      await householdService.revokeInvite(id);
      loadPending();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Sheet title="Invitar a tu hogar" onClose={onClose} busy={busy}>
      <p className="text-[15px] font-semibold text-[#111]/80">
        Invita a las personas con las que compartes gastos. Verán los gastos, pagos y metas del
        hogar, nunca tus cuentas ni tus movimientos personales.
      </p>
      {!link ? (
        <>
          <TextField
            label="Correo de la persona (opcional)"
            value={email}
            onChange={setEmail}
            placeholder="Si lo pones, solo ese correo podrá usar el enlace"
          />
          {error && <ErrorNote>{error}</ErrorNote>}
          <SubmitButton onClick={create} disabled={busy}>
            {busy ? 'Creando enlace…' : 'Crear enlace de invitación'}
          </SubmitButton>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-2xl border-[3px] border-[#111] bg-white p-3">
            <Link2 className="h-5 w-5 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#111]" title={link}>
              {link}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={copy}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-white text-[16px] font-black shadow-[0_4px_0_#111]"
            >
              {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button
              type="button"
              onClick={share}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#45D98B] text-[16px] font-black shadow-[0_4px_0_#111]"
            >
              <Share2 className="h-5 w-5" /> Compartir
            </button>
          </div>
          <p className="text-xs font-semibold text-gray-600">
            Sirve una sola vez y vence en 7 días. Puedes anularlo abajo.
          </p>
          {error && <ErrorNote>{error}</ErrorNote>}
          <button
            type="button"
            onClick={() => {
              setLink('');
              setEmail('');
            }}
            className="text-sm font-black text-[#111] underline"
          >
            Crear otro enlace
          </button>
        </div>
      )}
      {pending.length > 0 && (
        <div>
          <SectionLabel>Invitaciones pendientes</SectionLabel>
          <ul className="space-y-2">
            {pending.map((i) => (
              <li
                key={i.id}
                className="flex items-center gap-2 rounded-2xl border-2 border-[#111]/15 bg-white px-3 py-2"
              >
                <span className="min-w-0 flex-1 text-sm font-bold text-[#111]">
                  {i.email ?? 'Enlace abierto'}
                  <span className="block text-xs font-semibold text-gray-600">
                    Vence el {fmt(i.expiresAt)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => revoke(i.id)}
                  className="rounded-xl border-2 border-[#111] px-3 py-1.5 text-xs font-black"
                >
                  Anular
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
