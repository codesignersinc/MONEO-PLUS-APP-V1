'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authErrorMessage } from '@/lib/authErrors';
import {
  AuthDivider,
  AuthError,
  AuthField,
  AuthPrimaryButton,
  AuthSecurityNote,
  AuthShell,
  AuthSocialButtons,
  AuthTabs,
} from '@/components/auth/AuthShell';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signInWithProvider } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/finanzas');
    } catch (err) {
      setError(authErrorMessage(err, 'No se pudo iniciar sesión.'));
      setLoading(false);
    }
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
      <AuthTabs active="login" />
      <AuthError message={error} />
      <form onSubmit={handleSubmit} className="space-y-3.5">
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
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <AuthPrimaryButton type="submit" loading={loading} loadingLabel="Ingresando...">
          Iniciar sesión <ArrowRight className="w-5 h-5" strokeWidth={2} />
        </AuthPrimaryButton>
      </form>
      <AuthDivider />
      <AuthSocialButtons onProvider={handleProvider} busy={provider} />
      <p className="mt-5 text-center">
        <Link href="/recuperar" className="text-[15px] font-medium text-[#15803D] hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
      <AuthSecurityNote />
    </AuthShell>
  );
}
