'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authErrorMessage } from '@/lib/authErrors';
import {
  AuthError,
  AuthField,
  AuthPrimaryButton,
  AuthSecurityNote,
  AuthShell,
} from '@/components/auth/AuthShell';

// Reached from the recovery email: /auth/callback exchanges the code for a session and
// redirects here, where the user sets the new password.
export default function RestablecerPage() {
  const router = useRouter();
  const { user, loading: authLoading, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setSaving(true);
    try {
      await updatePassword(password);
      router.replace('/finanzas');
    } catch (err) {
      setError(authErrorMessage(err, 'No se pudo guardar la contraseña.'));
      setSaving(false);
    }
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-bold text-black">Crea una nueva contraseña</h2>
      <p className="mt-1 mb-5 text-[15px] text-gray-600">
        Elige una contraseña de al menos 6 caracteres.
      </p>
      {!authLoading && !user ? (
        <>
          <AuthError message="El enlace expiró o ya fue usado. Solicita uno nuevo." />
          <Link
            href="/recuperar"
            className="block w-full rounded-2xl bg-black py-4 text-center text-[16px] font-semibold text-white hover:bg-gray-900"
          >
            Solicitar otro enlace
          </Link>
        </>
      ) : (
        <>
          <AuthError message={error} />
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <AuthField
              icon={Lock}
              label="Nueva contraseña"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <AuthField
              icon={Lock}
              label="Repite la contraseña"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <AuthPrimaryButton type="submit" loading={saving} loadingLabel="Guardando...">
              Guardar contraseña <ArrowRight className="w-5 h-5" strokeWidth={2} />
            </AuthPrimaryButton>
          </form>
        </>
      )}
      <AuthSecurityNote />
    </AuthShell>
  );
}
