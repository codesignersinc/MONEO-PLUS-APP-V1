'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, EyeOff, ShieldCheck, type LucideIcon } from 'lucide-react';

// Shared layout of the auth screens (login, register, password recovery).
// Mobile: illustration on top (login-bg-mobile) and the card below it.
// Desktop: illustration on the left (login-bg-desktop) and the card on the right.

const YELLOW = 'bg-[#FDD820]';

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`relative min-h-screen ${YELLOW} font-poppins overflow-x-hidden`}>
      {/* Mobile background: the illustration fills the top of the column. */}
      <div className="lg:hidden absolute inset-x-0 top-0 mx-auto max-w-xl" aria-hidden="true">
        <Image
          src="/assets/images/auth/login-bg-mobile.webp"
          alt=""
          width={1125}
          height={2000}
          priority
          className="w-full h-auto"
        />
      </div>
      {/* Desktop background: illustration anchored to the left. */}
      <div className="hidden lg:block absolute inset-0" aria-hidden="true">
        <Image
          src="/assets/images/auth/login-bg-desktop.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-left"
        />
      </div>
      <h1 className="sr-only">MONEO — Tu dinero, más simple.</h1>

      <main className="relative z-10 mx-auto w-full max-w-md px-5 pt-[min(66vw,380px)] pb-10 lg:max-w-none lg:min-h-screen lg:flex lg:items-center lg:justify-end lg:pt-10 lg:pr-[7vw]">
        <div className="w-full lg:max-w-[460px] font-sans font-normal bg-[#FDFBF3] border-[3px] border-black rounded-[28px] shadow-[8px_8px_0px_#000] px-6 sm:px-8 pt-6 pb-7">
          {children}
        </div>
      </main>
    </div>
  );
}

export function AuthTabs({ active }: { active: 'login' | 'register' }) {
  const tab = (key: 'login' | 'register', href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? 'page' : undefined}
      className={`flex-1 pb-3 text-center text-[15px] border-b-[3px] transition-colors ${
        active === key
          ? 'font-bold text-black border-[#16A34A]'
          : 'font-medium text-gray-500 border-gray-200 hover:text-black'
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav className="flex mb-6" aria-label="Acceso">
      {tab('login', '/login', 'Iniciar sesión')}
      {tab('register', '/register', 'Crear cuenta')}
    </nav>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: LucideIcon;
  label: string;
}

// Input with a leading icon; `label` is used as placeholder and accessible name.
export function AuthField({ icon: Icon, label, type = 'text', ...props }: FieldProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  return (
    <label className="flex items-center gap-3 rounded-2xl border-[1.5px] border-gray-200 bg-white/60 px-4 py-3.5 focus-within:border-black transition-colors">
      <Icon className="w-5 h-5 text-gray-500 flex-shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <input
        {...props}
        type={isPassword && visible ? 'text' : type}
        placeholder={label}
        aria-label={label}
        className="flex-1 min-w-0 bg-transparent text-[15px] text-black placeholder-gray-500 outline-none"
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="text-gray-600 hover:text-black"
        >
          {visible ? (
            <EyeOff className="w-5 h-5" strokeWidth={1.75} />
          ) : (
            <Eye className="w-5 h-5" strokeWidth={1.75} />
          )}
        </button>
      )}
    </label>
  );
}

export function AuthPrimaryButton({
  children,
  loading,
  loadingLabel = 'Un momento...',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; loadingLabel?: string }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className="w-full flex items-center justify-center gap-3 rounded-2xl bg-black py-4 text-[16px] font-semibold text-white hover:bg-gray-900 active:translate-y-px transition disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? loadingLabel : children}
    </button>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-4 rounded-2xl border-[1.5px] border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {message}
    </p>
  );
}

export function AuthNotice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="mb-4 rounded-2xl border-[1.5px] border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
    >
      {children}
    </p>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 my-5 text-sm text-gray-500">
      <span className="h-px flex-1 bg-gray-300" />o continúa con
      <span className="h-px flex-1 bg-gray-300" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.59 2.17-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.32-3.5h.02ZM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.21Z" />
    </svg>
  );
}

// Apple Sign In needs an Apple Developer account configured in Supabase; the button
// only shows when NEXT_PUBLIC_AUTH_APPLE_ENABLED=true.
const APPLE_ENABLED = process.env.NEXT_PUBLIC_AUTH_APPLE_ENABLED === 'true';

export function AuthSocialButtons({
  onProvider,
  busy,
}: {
  onProvider: (provider: 'google' | 'apple') => void;
  busy: 'google' | 'apple' | null;
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => onProvider('google')}
        disabled={busy !== null}
        className="w-full flex items-center justify-center gap-3 rounded-2xl border-[1.5px] border-gray-200 bg-white py-3.5 text-[16px] text-black hover:border-black transition disabled:opacity-60"
      >
        <GoogleIcon />
        {busy === 'google' ? (
          'Conectando...'
        ) : (
          <span>
            Continuar con <span className="font-semibold">Google</span>
          </span>
        )}
      </button>
      {APPLE_ENABLED && (
        <button
          type="button"
          onClick={() => onProvider('apple')}
          disabled={busy !== null}
          className="w-full flex items-center justify-center gap-3 rounded-2xl bg-black py-3.5 text-[16px] text-white hover:bg-gray-900 transition disabled:opacity-60"
        >
          <AppleIcon />
          {busy === 'apple' ? 'Conectando...' : 'Continuar con Apple'}
        </button>
      )}
    </div>
  );
}

export function AuthSecurityNote() {
  return (
    <p className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-[#E3F4EA] text-center px-4 py-3.5 text-sm text-[#15803D]">
      <ShieldCheck className="w-5 h-5 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
      Tus datos siempre seguros y en tus manos.
    </p>
  );
}
