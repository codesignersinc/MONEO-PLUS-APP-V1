'use client';
import React from 'react';
import Link from 'next/link';
import { Globe } from 'lucide-react';
import { track } from '@/lib/analytics';
import { SITE } from '@/lib/site';

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
      <path d="M4 2.5v19l10-9.5z" fill="#45D98B" />
      <path d="M4 2.5l13.5 7.4L14 12z" fill="#75B8FF" />
      <path d="M4 21.5l13.5-7.4L14 12z" fill="#FF806E" />
      <path d="M17.5 9.9L21 12l-3.5 2.1L14 12z" fill="#FFD83D" />
    </svg>
  );
}

const badge =
  'inline-flex min-w-[210px] items-center gap-3 rounded-2xl border-[3px] border-white bg-[#111] px-5 py-3 text-left text-white shadow-[4px_4px_0_#FFD83D] transition-transform hover:-translate-y-0.5';

// Google Play badge. The Android app is not published yet, so without a store URL it
// renders as a "coming soon" badge (never a dead link) and still reports the interest.
export function GooglePlayBadge() {
  const content = (
    <>
      <PlayIcon />
      <span>
        <span className="block font-sans text-[11px] font-medium uppercase tracking-wide text-white/70">
          {SITE.googlePlayUrl ? 'Disponible en' : 'Próximamente en'}
        </span>
        <span className="block font-poppins text-[18px] font-extrabold leading-tight">
          Google Play
        </span>
      </span>
    </>
  );
  if (SITE.googlePlayUrl) {
    return (
      <a
        href={SITE.googlePlayUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('google_play_click', { available: true })}
        className={badge}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      aria-disabled="true"
      onClick={() => track('google_play_click', { available: false })}
      className={`${badge} cursor-default opacity-90 hover:translate-y-0`}
    >
      {content}
    </button>
  );
}

export function WebBadge() {
  return (
    <Link
      href="/register"
      onClick={() => track('register_click', { from: 'final_web_badge' })}
      className={badge}
    >
      <Globe className="h-7 w-7 text-[#FFD83D]" aria-hidden="true" />
      <span>
        <span className="block font-sans text-[11px] font-medium uppercase tracking-wide text-white/70">
          Úsalo ya en
        </span>
        <span className="block font-poppins text-[18px] font-extrabold leading-tight">la Web</span>
      </span>
    </Link>
  );
}
