'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';
import { track } from '@/lib/analytics';
import { cleanUtm, isValidEmail, MARKETS, type MarketSlug, type WillingToPay } from '@/lib/markets';
import { waitlistService } from '@/lib/supabaseWaitlist';

const PAY_ORDER: WillingToPay[] = ['free', 'low', 'mid', 'high'];

// Waiting-list sign-up of a country landing. The email goes only to the database
// (join_waitlist); analytics get the market and the answer, never the email.
export default function WaitlistForm({ slug }: { slug: MarketSlug }) {
  const market = MARKETS[slug];
  const t = market.copy;
  const [email, setEmail] = useState('');
  const [pay, setPay] = useState<WillingToPay | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');
  const [utm, setUtm] = useState<{ source?: string; medium?: string; campaign?: string }>({});

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setUtm({
      source: cleanUtm(q.get('utm_source')),
      medium: cleanUtm(q.get('utm_medium')),
      campaign: cleanUtm(q.get('utm_campaign')),
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValidEmail(email)) {
      setError(t.invalidEmail);
      return;
    }
    setState('sending');
    try {
      await waitlistService.join({
        email,
        country: market.country,
        locale: market.locale,
        willingToPay: pay ?? undefined,
        utm,
      });
      track('waitlist_submit', { market: slug, pay: pay ?? 'none', source: utm.source ?? 'none' });
      setState('done');
    } catch {
      track('waitlist_error', { market: slug });
      setError(t.error);
      setState('idle');
    }
  };

  if (state === 'done') {
    return (
      <div role="status" className="rounded-3xl border-[3px] border-[#111] bg-[#DDF7E9] p-6">
        <span className="grid h-12 w-12 place-items-center rounded-2xl border-[3px] border-[#111] bg-[#45D98B] shadow-[3px_3px_0_#111]">
          <Check className="h-6 w-6" strokeWidth={3} />
        </span>
        <p className="mt-4 font-poppins text-2xl font-extrabold">{t.done}</p>
        <p className="mt-1 font-sans text-[15px] text-[#333]">{t.doneText}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block font-poppins text-xs font-extrabold uppercase tracking-wide">
          {t.emailLabel}
        </span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.emailPlaceholder}
          aria-invalid={Boolean(error) || undefined}
          className="w-full rounded-2xl border-[3px] border-[#111] bg-white px-4 py-3.5 font-sans text-base text-[#111] outline-none focus-visible:ring-4 focus-visible:ring-[#FFD83D]"
        />
      </label>

      <fieldset>
        <legend className="mb-2 font-poppins text-xs font-extrabold uppercase tracking-wide">
          {t.payQuestion}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {PAY_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={pay === k}
              onClick={() => setPay(pay === k ? null : k)}
              className={`rounded-xl border-2 border-[#111] px-3 py-2.5 text-left font-poppins text-[13px] font-bold transition-colors ${
                pay === k ? 'paper-opaque bg-[#111] text-white' : 'bg-white text-[#111]'
              }`}
            >
              {t.payOptions[k]}
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-[#FFE1DB] px-3 py-2 font-sans text-sm font-semibold text-[#B42318]"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'sending'}
        className="paper-opaque flex w-full items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] px-6 py-4 font-poppins text-base font-extrabold text-[#111] shadow-[4px_4px_0_#111] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#111] disabled:opacity-60"
      >
        {state === 'sending' && <Loader2 className="h-5 w-5 animate-spin" />}
        {state === 'sending' ? t.sending : t.submit}
      </button>

      <p className="font-sans text-xs text-[#555]">
        {t.consent}{' '}
        <Link href="/privacidad" className="font-semibold underline">
          {t.privacy}
        </Link>
      </p>
    </form>
  );
}
