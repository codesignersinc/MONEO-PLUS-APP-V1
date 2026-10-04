'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authErrorMessage } from '@/lib/authErrors';
import {
  AuthDivider,
  AuthError,
  AuthField,
  AuthNotice,
  AuthPrimaryButton,
  AuthSecurityNote,
  AuthShell,
  AuthSocialButtons,
  AuthTabs,
} from '@/components/auth/AuthShell';

export default function RegisterPage() {
  const router = useRouter();
  const { signUp, signInWithProvider } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState('');
  const [confirmSent, setConfirmSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const data = await signUp(email.trim(), password, { fullName: fullName.trim() });
      // With email confirmation enabled there is no session yet.
      if (data?.session) {
        router.replace('/finanzas');
        return;
      }
      setConfirmSent(true);
    } catch (err) {
      setError(authErrorMessage(err, 'No se pudo crear la cuenta.'));
    }
    setLoading(false);
  }

  async function handleProvider(p: 'google' | 'apple') {
    setError('');
    setProvider(p);
    try {
      await signInWithProvider(p);
    } catch (err) {
      setError(authErrorMessage(err, 'No se pudo conectar. Intenta de nuevo.'));
      setProvider(null);
    }
  }

  return (
    <AuthShell>
      <AuthTabs active="register" />
      <AuthError message={error} />
      {confirmSent ? (
        <AuthNotice>
          Te enviamos un correo a <strong>{email}</strong>. Abre el enlace para confirmar tu cuenta
          y luego inicia sesión.
        </AuthNotice>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <AuthField
              icon={User}
              label="Nombre completo"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <AuthField
              icon={Mail}
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <AuthField
              icon={Lock}
              label="Contraseña (mínimo 6 caracteres)"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <AuthPrimaryButton type="submit" loading={loading} loadingLabel="Creando cuenta...">
              Crear cuenta <ArrowRight className="w-5 h-5" strokeWidth={2} />
            </AuthPrimaryButton>
          </form>
          <AuthDivider />
          <AuthSocialButtons onProvider={handleProvider} busy={provider} />
          <p className="mt-5 text-center text-xs text-gray-500">
            Al crear tu cuenta aceptas los{' '}
            <Link href="/terminos" className="underline">
              Términos y condiciones
            </Link>{' '}
            y la{' '}
            <Link href="/privacidad" className="underline">
              Política de privacidad
            </Link>
            .
          </p>
        </>
      )}
      <AuthSecurityNote />
    </AuthShell>
  );
}
