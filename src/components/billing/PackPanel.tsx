'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Crown, Link2, Share2, Users } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { getErrorMessage } from '@/lib/dataError';
import { packService, type MyPack } from '@/lib/billing';

// Duo / Familiar: the payer invites people with a single-use link and manages the seats;
// a member sees whose pack they are in and can leave. Nobody sees anybody's finances.

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });

export default function PackPanel({
  pack,
  defaultName,
  onChanged,
}: {
  pack: MyPack;
  defaultName: string;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [ownerName, setOwnerName] = useState(
    (pack.role === 'owner' && pack.ownerName) || defaultName
  );
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{ id: string; email: string | null; expiresAt: string }[]>(
    []
  );

  const loadPending = useCallback(() => {
    if (pack.role !== 'owner') return;
    packService
      .invitations()
      .then(setPending)
      .catch(() => setPending([]));
  }, [pack.role]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  if (pack.role === null) return null;

  if (pack.role === 'member') {
    const leave = async () => {
      if (!window.confirm('¿Salir del pack? Dejarás de tener MONEO PLUS por este pack.')) return;
      try {
        await packService.leave();
        onChanged();
      } catch (err) {
        toast.showError(err);
      }
    };
    return (
      <section className="mb-6 rounded-2xl border-[3px] border-[#111] bg-[#DDF7E9] p-4 text-[#111] shadow-[3px_3px_0_#111]">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-[#111] bg-white">
            <Users className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-black text-[#111]">
              Estás en el {pack.planName ?? 'pack'} de {pack.ownerName ?? 'otra persona'}
            </p>
            <p className="text-sm font-semibold text-[#111]/80">
              {pack.covered
                ? 'Tienes MONEO PLUS gracias a este pack. Tus cuentas y movimientos siguen siendo solo tuyos.'
                : 'Ahora mismo este pack no te cubre (venció o no tiene lugar libre). Puedes tener tu propio plan abajo.'}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#111]/70">
              Gmail automático requiere un plan pagado a tu nombre.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={leave}
          className="mt-3 text-sm font-black text-[#111] underline"
        >
          Salir del pack
        </button>
      </section>
    );
  }

  const free = pack.seats - 1 - pack.members.length;

  const invite = async () => {
    if (!ownerName.trim()) return setError('Escribe cómo quieres aparecer en la invitación.');
    setBusy(true);
    setError('');
    try {
      const token = await packService.invite(ownerName.trim(), email);
      setLink(`${window.location.origin}/plus/unirse/${token}`);
      setCopied(false);
      setEmail('');
      loadPending();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const message = `${ownerName.trim()} te invita a su ${pack.planName} de MONEO PLUS. Cada uno con su cuenta privada. Únete aquí: ${link}`;

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'MONEO PLUS', text: message });
      } catch {
        // cancelled
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`¿Quitar a ${name} de tu pack? Volverá a MONEO FREE; no pierde sus datos.`))
      return;
    try {
      await packService.remove(id);
      onChanged();
    } catch (err) {
      toast.showError(err);
    }
  };

  return (
    <section className="mb-6 space-y-4 rounded-2xl border-[3px] border-[#111] bg-white p-4 text-[#111] shadow-[3px_3px_0_#111]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-[#111] bg-[#FFD83D]">
          <Users className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-black text-[#111]">Tu {pack.planName}</p>
          <p className="text-sm font-semibold text-gray-600">
            {pack.members.length + 1} de {pack.seats} lugares usados · cada persona con su cuenta
            privada; nadie ve las finanzas de los demás.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        <li className="flex items-center gap-3 rounded-xl bg-[#FFF9EC] px-3 py-2 text-sm font-black">
          <Crown className="h-4 w-4" /> {ownerName || 'Tú'} (tú, pagas el pack)
        </li>
        {pack.members.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-3 rounded-xl bg-[#FFF9EC] px-3 py-2 text-sm font-bold"
          >
            <span className="min-w-0 flex-1 truncate">
              {m.name}
              <span className="block text-xs font-semibold text-gray-600">
                Desde el {fmt(m.joinedAt)}
                {!m.covered && ' · sin lugar en tu plan actual'}
              </span>
            </span>
            <button
              type="button"
              onClick={() => remove(m.id, m.name)}
              className="rounded-lg border-2 border-[#B42318] px-2 py-1 text-xs font-black text-[#B42318]"
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>

      {free > 0 ? (
        link ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl border-2 border-[#111] p-3">
              <Link2 className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold" title={link}>
                {link}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  } catch {
                    setError('No se pudo copiar. Mantén presionado el enlace para copiarlo.');
                  }
                }}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border-[3px] border-[#111] bg-white font-black"
              >
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <button
                type="button"
                onClick={share}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border-[3px] border-[#111] bg-[#45D98B] font-black"
              >
                <Share2 className="h-5 w-5" /> Compartir
              </button>
            </div>
            <p className="text-xs font-semibold text-gray-600">
              Sirve una sola vez y vence en 7 días.{' '}
              <button type="button" onClick={() => setLink('')} className="font-black underline">
                Invitar a otra persona
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-black text-[#111]">
              Invita a alguien ({free} {free === 1 ? 'lugar libre' : 'lugares libres'})
            </p>
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Tu nombre en la invitación"
              aria-label="Tu nombre en la invitación"
              className="h-12 w-full rounded-xl border-[3px] border-[#111] px-3 text-[16px] font-bold"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo de la persona (opcional)"
              aria-label="Correo de la persona (opcional)"
              type="email"
              className="h-12 w-full rounded-xl border-[3px] border-[#111] px-3 text-[16px] font-bold"
            />
            <button
              type="button"
              onClick={invite}
              disabled={busy}
              className="h-12 w-full rounded-xl border-[3px] border-[#111] bg-[#FFD83D] font-black shadow-[0_3px_0_#111] disabled:opacity-60"
            >
              {busy ? 'Creando enlace…' : 'Crear enlace de invitación'}
            </button>
          </div>
        )
      ) : (
        <p className="text-sm font-semibold text-gray-600">Tu pack está completo.</p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]"
        >
          {error}
        </p>
      )}
      {pending.length > 0 && (
        <ul className="space-y-1.5">
          {pending.map((i) => (
            <li key={i.id} className="flex items-center gap-2 text-sm font-semibold">
              <span className="min-w-0 flex-1 truncate">
                Invitación pendiente {i.email ? `para ${i.email}` : '(enlace abierto)'} · vence el{' '}
                {fmt(i.expiresAt)}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await packService.revoke(i.id).catch(() => {});
                  loadPending();
                }}
                className="rounded-lg border-2 border-[#111] px-2 py-0.5 text-xs font-black"
              >
                Anular
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs font-semibold text-gray-600">
        Gmail automático es solo para quien paga, por ahora (Google limita los usuarios mientras
        verifica la app).
      </p>
    </section>
  );
}
