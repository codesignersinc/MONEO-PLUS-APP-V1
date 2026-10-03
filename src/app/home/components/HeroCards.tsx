'use client';
import React, { useEffect, useRef, useState } from 'react';

// ─── Spending Ticker Card ────────────────────────────────────────────────────
const CATEGORIES = [
  { label: 'Groceries', base: 312, color: '#A78BFA' },
  { label: 'Streaming', base: 47,  color: '#7C3AED' },
  { label: 'Transit',   base: 89,  color: '#6D28D9' },
  { label: 'Dining',    base: 203, color: '#8B5CF6' },
  { label: 'Shopping',  base: 156, color: '#A78BFA' },
];

function SpendingTickerCard() {
  const [values, setValues] = useState(CATEGORIES.map(c => c.base));
  const [ticked, setTicked] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * CATEGORIES.length);
      const delta = Math.floor(Math.random() * 12) + 1;
      setValues(prev => prev.map((v, i) => i === idx ? v + delta : v));
      setTicked(idx);
      setTimeout(() => setTicked(null), 400);
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-card p-5 w-full h-full flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] text-[#6B7280] tracking-widest uppercase">Live Spend</span>
        <span className="w-2 h-2 rounded-full bg-[#7C3AED] animate-pulse" />
      </div>
      {CATEGORIES.map((cat, i) => (
        <div key={cat.label} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: cat.color }}
            />
            <span className="font-sans text-xs text-[#9CA3AF] truncate">{cat.label}</span>
          </div>
          <span
            className={`font-mono text-sm font-medium transition-all duration-300 ${
              ticked === i ? 'text-[#A78BFA]' : 'text-[#EDEEF0]'
            }`}
            style={{
              textShadow: ticked === i ? '0 0 12px rgba(167,139,250,0.8)' : 'none',
            }}
          >
            ${values[i].toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Radial Budget Ring Card ─────────────────────────────────────────────────
function BudgetRingCard() {
  const [animated, setAnimated] = useState(false);
  const [pulse, setPulse] = useState(false);
  const ref = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const t1 = setTimeout(() => setAnimated(true), 600);
    const t2 = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    }, 3000);
    return () => { clearTimeout(t1); clearInterval(t2); };
  }, []);

  const radius = 80;
  const circ = 2 * Math.PI * radius;
  const fill = 0.62; // 62% spent
  const offset = circ * (1 - fill);

  return (
    <div className="glass-card p-6 w-full h-full flex flex-col items-center justify-center gap-4">
      <div className="flex items-center justify-between w-full mb-1">
        <span className="font-mono text-[10px] text-[#6B7280] tracking-widest uppercase">Monthly Budget</span>
        <span className="font-mono text-[10px] text-[#7C3AED]">62% used</span>
      </div>

      <div className="relative flex items-center justify-center">
        <svg width="180" height="180" viewBox="0 0 180 180">
          {/* Track */}
          <circle
            cx="90" cy="90" r={radius}
            fill="none"
            stroke="rgba(124,58,237,0.12)"
            strokeWidth="12"
          />
          {/* Progress */}
          <circle
            ref={ref}
            cx="90" cy="90" r={radius}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={animated ? offset : circ}
            transform="rotate(-90 90 90)"
            style={{
              transition: 'stroke-dashoffset 2s cubic-bezier(0.34, 1.56, 0.64, 1) 0.8s',
            }}
          />
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center figure */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-mono text-3xl font-bold transition-all duration-300 ${
              pulse ? 'text-[#A78BFA]' : 'text-[#EDEEF0]'
            }`}
            style={{
              textShadow: pulse ? '0 0 30px rgba(167,139,250,0.9)' : '0 0 16px rgba(124,58,237,0.4)',
            }}
          >
            $1,847
          </span>
          <span className="font-sans text-[10px] text-[#6B7280] mt-0.5">of $3,000</span>
        </div>
      </div>

      <div className="flex items-center gap-4 w-full">
        {[
          { label: 'Remaining', val: '$1,153', color: '#A78BFA' },
          { label: 'Avg/day',   val: '$61',    color: '#6B7280' },
        ].map(({ label, val, color }) => (
          <div key={label} className="flex-1 text-center">
            <div className="font-mono text-sm font-medium" style={{ color }}>{val}</div>
            <div className="font-sans text-[10px] text-[#4B5563] mt-0.5">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Subscription Toggles Card ───────────────────────────────────────────────
const SUBS = [
  { name: 'Netflix',   price: '$15.49', active: true,  color: '#7C3AED' },
  { name: 'Spotify',   price: '$10.99', active: false, color: '#6B7280' },
  { name: 'Headspace', price: '$12.99', active: false, color: '#6B7280' },
];

function SubscriptionTogglesCard() {
  const [states, setStates] = useState(SUBS.map(s => s.active));

  const toggle = (i: number) => setStates(prev => prev.map((v, idx) => idx === i ? !v : v));

  return (
    <div className="glass-card p-5 w-full h-full flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] text-[#6B7280] tracking-widest uppercase">Subscriptions</span>
        <span className="font-sans text-[10px] text-[#7C3AED]">3 active</span>
      </div>
      {SUBS.map((sub, i) => (
        <div key={sub.name} className="flex items-center justify-between gap-3 py-1">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold"
              style={{
                background: states[i] ? 'rgba(124,58,237,0.25)' : 'rgba(237,238,240,0.06)',
                color: states[i] ? '#A78BFA' : '#6B7280',
                border: states[i] ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(237,238,240,0.08)',
              }}
            >
              {sub.name[0]}
            </div>
            <div className="min-w-0">
              <div className={`font-sans text-sm font-medium truncate ${states[i] ? 'text-[#EDEEF0]' : 'text-[#6B7280]'}`}>
                {sub.name}
              </div>
              <div className="font-mono text-[10px] text-[#4B5563]">{sub.price}/mo</div>
            </div>
          </div>
          <div
            className={`toggle-track ${states[i] ? 'on' : ''}`}
            onClick={() => toggle(i)}
            role="switch"
            aria-checked={states[i]}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && toggle(i)}
          >
            <div className="toggle-thumb" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Hero Cards Container ────────────────────────────────────────────────────
export default function HeroCards() {
  return (
    <div className="relative w-full flex items-center justify-center" style={{ minHeight: '420px' }}>
      {/* Left card — spending ticker */}
      <div
        className="absolute hidden lg:block"
        style={{
          left: '0%',
          top: '50%',
          transform: 'translateY(-50%) rotateY(18deg) rotateZ(-2deg)',
          width: '220px',
          height: '280px',
          zIndex: 1,
          opacity: 0,
          animation: 'slideInBlur 0.9s cubic-bezier(0.22,1,0.36,1) 0.6s forwards',
        }}
      >
        <SpendingTickerCard />
      </div>

      {/* Center card — budget ring */}
      <div
        style={{
          width: 'min(320px, 90vw)',
          height: '380px',
          zIndex: 3,
          position: 'relative',
          opacity: 0,
          animation: 'fadeInScale 1s cubic-bezier(0.22,1,0.36,1) 0.3s forwards',
        }}
      >
        <BudgetRingCard />
      </div>

      {/* Right card — subscriptions */}
      <div
        className="absolute hidden lg:block"
        style={{
          right: '0%',
          top: '50%',
          transform: 'translateY(-50%) rotateY(-18deg) rotateZ(2deg)',
          width: '220px',
          height: '280px',
          zIndex: 1,
          opacity: 0,
          animation: 'slideInRight 0.9s cubic-bezier(0.22,1,0.36,1) 0.8s forwards',
        }}
      >
        <SubscriptionTogglesCard />
      </div>
    </div>
  );
}