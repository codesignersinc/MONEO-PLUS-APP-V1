import React from 'react';

// Shared visual primitives of the landing (server components).

export const C = {
  cream: '#FFF9EC',
  yellow: '#FFD83D',
  black: '#111111',
  mint: '#45D98B',
  lilac: '#B99CFF',
  coral: '#FF806E',
  blue: '#75B8FF',
};

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-[#FFD83D] px-6 py-3.5 font-poppins text-[15px] font-extrabold text-[#111] shadow-[4px_4px_0_#111] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#111] active:translate-y-0 active:shadow-[2px_2px_0_#111] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#111]';

export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-2xl border-[3px] border-[#111] bg-white px-6 py-3.5 font-poppins text-[15px] font-extrabold text-[#111] shadow-[4px_4px_0_#111] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#111] active:translate-y-0 active:shadow-[2px_2px_0_#111] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#111]';

export function Pill({
  children,
  color = C.yellow,
  className = '',
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border-2 border-[#111] px-3 py-1 font-poppins text-[11px] font-extrabold uppercase tracking-wide text-[#111] ${className}`}
      style={{ background: color }}
    >
      {children}
    </span>
  );
}

export function SoonBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border-2 border-[#111] bg-white px-2.5 py-0.5 font-poppins text-[10px] font-extrabold uppercase tracking-wide text-[#111] ${className}`}
    >
      Próximamente
    </span>
  );
}

export function SectionTitle({
  kicker,
  kickerColor,
  title,
  subtitle,
  align = 'left',
  id,
}: {
  kicker?: string;
  kickerColor?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: 'left' | 'center';
  id?: string;
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      {kicker && <Pill color={kickerColor}>{kicker}</Pill>}
      <h2
        id={id}
        className="mt-4 font-poppins text-[34px] font-extrabold leading-[1.05] tracking-tight text-[#111] sm:text-[44px] lg:text-[52px]"
      >
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 font-sans text-[17px] font-normal leading-relaxed text-[#333] sm:text-lg">
          {subtitle}
        </p>
      )}
    </div>
  );
}

// Retro phone frame for UI mockups.
export function Phone({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative w-[260px] rounded-[38px] border-[4px] border-[#111] bg-[#111] p-2 shadow-[8px_8px_0_#111] ${className}`}
    >
      <div className="absolute left-1/2 top-3 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-[#111]" />
      <div className="relative overflow-hidden rounded-[30px] bg-[#FFF9EC] font-sans font-normal text-[#111]">
        <div className="flex items-center justify-between px-6 pb-1 pt-3 text-[10px] font-bold">
          <span>9:41</span>
          <span aria-hidden="true">●●● ▮</span>
        </div>
        {children}
      </div>
    </div>
  );
}

// Small floating sticker card (decorative).
export function Sticker({
  children,
  className = '',
  color = '#fff',
}: {
  children: React.ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <div
      className={`rounded-2xl border-[2.5px] border-[#111] px-3.5 py-2.5 shadow-[3px_3px_0_#111] ${className}`}
      style={{ background: color }}
    >
      {children}
    </div>
  );
}

// Decorative doodles (inline SVG, no requests).
export function Star({
  className = '',
  color = '#FFD83D',
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path
        d="M20 2l4.6 12.4L37 20l-12.4 4.6L20 37l-4.6-12.4L3 20l12.4-5.6z"
        fill={color}
        stroke="#111"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Coin({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <ellipse cx="26" cy="26" rx="19" ry="19" fill="#111" />
      <circle cx="23" cy="23" r="19" fill="#FFD83D" stroke="#111" strokeWidth="3" />
      <circle cx="23" cy="23" r="12.5" fill="none" stroke="#111" strokeWidth="2.5" />
      <text
        x="23"
        y="29"
        textAnchor="middle"
        fontSize="15"
        fontWeight="900"
        fontFamily="Poppins, sans-serif"
        fill="#111"
      >
        S/
      </text>
    </svg>
  );
}

export function Squiggle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 24" className={className} aria-hidden="true">
      <path
        d="M2 12c8-10 14 10 22 0s14 10 22 0 14 10 22 0 8 6 10 4"
        fill="none"
        stroke="#111"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
