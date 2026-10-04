'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authErrorMessage } from '@/lib/authErrors';
import {
  AuthError,
  AuthField,
  AuthNotice,
  AuthPrimaryButton,
  AuthSecurityNote,
  AuthShell,
} from '@/components/auth/AuthShell';

export default function RecuperarPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err, 'No se pudo enviar el correo. Intenta de nuevo.'));
    }
    setLoading(false);
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-bold text-black">Recupera tu contraseña</h2>
      <p className="mt-1 mb-5 text-[15px] text-gray-600">
        Escribe tu correo y te enviaremos un enlace para crear una nueva.
      </p>
      <AuthError message={error} />
      {sent ? (
        <AuthNotice>
          Si existe una cuenta con <strong>{email}</strong>, recibirás un correo con el enlace en
          unos minutos. Revisa también la carpeta de spam.
        </AuthNotice>
      ) : (
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
          <AuthPrimaryButton type="submit" loading={loading} loadingLabel="Enviando...">
            Enviar enlace <ArrowRight className="w-5 h-5" strokeWidth={2} />
          </AuthPrimaryButton>
        </form>
      )}
      <p className="mt-5 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[15px] font-medium text-[#15803D] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} /> Volver a iniciar sesión
        </Link>
      </p>
      <AuthSecurityNote />
    </AuthShell>
  );
}
