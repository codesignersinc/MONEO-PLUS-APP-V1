'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { SubmitButton, TextField } from '@/components/finance/formKit';
import { getErrorMessage } from '@/lib/dataError';
import { packService, type PackInviteStatus } from '@/lib/billing';
import { PENDING_PACK_INVITE_KEY } from '@/components/household/PendingInvite';

const STATUS_TEXT: Record<Exclude<PackInviteStatus, 'valid'>, string> = {
  expired: 'Esta invitación venció. Pide a quien te invitó un enlace nuevo.',
  used: 'Esta invitación ya fue usada.',
  revoked: 'Esta invitación fue anulada.',
  invalid: 'El enlace no es válido. Revisa que esté completo.',
  inactive: 'El plan de quien te invitó ya no está activo.',
  full: 'Este pack ya está completo.',
};

// Invitation to someone's MONEO PLUS Duo / Familiar: sign in (or sign up), then accept.
export default function JoinPackPage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [info, setInfo] = useState<{
    ownerName: string | null;
    planName: string | null;
    status: PackInviteStatus;
  } | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    try {
      if (!user) localStorage.setItem(PENDING_PACK_INVITE_KEY, token);
      else localStorage.removeItem(PENDING_PACK_INVITE_KEY);
    } catch {
      // private mode: the person can open the link again after signing in
    }
    if (!user) return;
    const full: string = user.user_metadata?.full_name || '';
    setName((n) => n || full.trim().split(/\s+/)[0] || '');
    packService
      .inviteInfo(token)
      .then(setInfo)
      .catch((err) => setError(getErrorMessage(err)));
  }, [user, loading, token]);

  const accept = async () => {
    if (!name.trim()) return setError('Escribe tu nombre.');
    setSaving(true);
    setError('');
    try {
      await packService.accept(token, name.trim());
      // Full reload: the whole app re-reads its MONEO PLUS status.
      window.location.assign('/finanzas/plus');
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FFF9EC] px-4 py-10 font-poppins text-[#111]">
      <div className="mx-auto max-w-md space-y-5">
        <section className="relative overflow-hidden rounded-[24px] border-2 border-[#111] bg-[#FFD83D] p-6 shadow-[0_3px_0_#111]">
          <Image
            src="/assets/images/home/monedas-patrimonio.webp"
            alt=""
            aria-hidden
            width={500}
            height={333}
            className="pointer-events-none absolute -right-6 -top-4 w-[140px] select-none"
          />
          <p className="text-[13px] font-black uppercase tracking-wide text-[#111]/70">
            MONEO PLUS
          </p>
          <h1 className="mt-1 max-w-[75%] text-[26px] font-black leading-tight">
            {info?.status === 'valid' && info.ownerName
              ? `${info.ownerName} te regala MONEO PLUS`
              : 'Te invitaron a MONEO PLUS'}
          </h1>
          <p className="mt-2 text-[15px] font-semibold text-[#111]/80">
            {info?.planName ? `Es parte de su ${info.planName}. ` : ''}Tendrás tu propia cuenta,
            100% privada: nadie del pack ve tus cuentas, saldos ni movimientos.
          </p>
        </section>

        {loading ? (
          <p className="text-center text-sm font-bold text-gray-600">Cargando…</p>
        ) : !user ? (
          <div className="space-y-3 rounded-[24px] border-2 border-[#111] bg-white p-5 shadow-[0_3px_0_#111]">
            <p className="text-[15px] font-bold">
              Para unirte, inicia sesión o crea tu cuenta gratis.
            </p>
            <Link
              href="/login"
              className="flex h-14 items-center justify-center rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] text-[17px] font-black shadow-[0_4px_0_#111]"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="flex h-14 items-center justify-center rounded-2xl border-[3px] border-[#111] bg-white text-[17px] font-black"
            >
              Crear mi cuenta
            </Link>
          </div>
        ) : info && info.status !== 'valid' ? (
          <div className="space-y-3 rounded-[24px] border-2 border-[#111] bg-white p-5 shadow-[0_3px_0_#111]">
            <p className="text-[15px] font-bold">{STATUS_TEXT[info.status]}</p>
            <Link href="/finanzas" className="font-black underline">
              Ir a MONEO
            </Link>
          </div>
        ) : (
          <div className="space-y-4 rounded-[24px] border-2 border-[#111] bg-white p-5 shadow-[0_3px_0_#111]">
            <TextField
              label="Tu nombre"
              value={name}
              onChange={setName}
              placeholder="Así te verá quien paga el pack"
            />
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-[#FFE1DB] px-3 py-2 text-sm font-bold text-[#B42318]"
              >
                {error}
              </p>
            )}
            <SubmitButton onClick={accept} disabled={saving || !info}>
              {saving ? 'Uniéndome…' : 'Unirme al pack'}
            </SubmitButton>
            <button
              type="button"
              onClick={() => router.replace('/finanzas')}
              className="w-full text-sm font-black underline"
            >
              Ahora no
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
