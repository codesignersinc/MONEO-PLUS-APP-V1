'use client';
import React, { useState } from 'react';

const BANKS = [
  'Chase',
  'Bank of America',
  'Wells Fargo',
  'Citibank',
  'Capital One',
  'US Bank',
  'PNC Bank',
  'Ally Bank',
  'TD Bank',
  'SoFi',
];

interface WaitlistFormProps {
  compact?: boolean;
}

export default function WaitlistForm({ compact = false }: WaitlistFormProps) {
  const [step, setStep] = useState<1 | 2 | 'done'>(1);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [bank, setBank] = useState('');
  const [loading, setLoading] = useState(false);
  const [position] = useState(() => Math.floor(Math.random() * 800) + 2200);

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 900));
    setLoading(false);
    setStep(2);
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1100));
    setLoading(false);
    setStep('done');
  };

  if (step === 'done') {
    return (
      <div className={`text-center ${compact ? 'py-2' : 'py-8'}`}>
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[rgba(124,58,237,0.2)] border border-[rgba(124,58,237,0.4)] mb-4">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#A78BFA"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <p className="font-mono text-sm text-[#A78BFA] mb-1">
          You&apos;re in, {firstName || 'friend'}.
        </p>
        <p className="font-sans text-sm text-[#6B7280]">
          Waitlist position:{' '}
          <span className="text-[#EDEEF0] font-mono">#{position.toLocaleString()}</span>
        </p>
        <p className="font-sans text-xs text-[#4B5563] mt-2">
          We&apos;ll scan your subscriptions the moment we launch.
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'w-full max-w-md mx-auto'}>
      {/* Step indicator */}
      {!compact && (
        <div className="flex items-center gap-2 justify-center mb-6">
          {[1, 2].map((s) => (
            <React.Fragment key={s}>
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] transition-all duration-300 ${
                  step >= s
                    ? 'bg-[#7C3AED] text-white'
                    : 'bg-[rgba(237,238,240,0.08)] text-[#6B7280]'
                }`}
              >
                {s}
              </div>
              {s < 2 && (
                <div
                  className={`h-px w-8 transition-all duration-300 ${step > s ? 'bg-[#7C3AED]' : 'bg-[rgba(237,238,240,0.1)]'}`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {step === 1 && (
        <form
          onSubmit={handleStep1}
          className={`flex ${compact ? 'flex-row gap-2' : 'flex-col gap-3'}`}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className={`flex-1 bg-[rgba(30,30,36,0.8)] border border-[rgba(124,58,237,0.25)] text-[#EDEEF0] placeholder-[#4B5563] font-mono text-sm rounded-xl focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[rgba(124,58,237,0.4)] transition-all ${
              compact ? 'px-4 py-2.5' : 'px-4 py-3.5'
            }`}
          />
          <button
            type="submit"
            disabled={loading}
            className={`violet-glow-btn font-sans font-medium text-white rounded-xl flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              compact ? 'px-5 py-2.5 text-sm' : 'px-6 py-3.5 text-sm w-full'
            }`}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-[#A78BFA] animate-pulse" />
                Scan My Subscriptions
              </>
            )}
          </button>
        </form>
      )}

      {step === 2 && !compact && (
        <form onSubmit={handleStep2} className="flex flex-col gap-3">
          <div className="glass-card-subtle p-3 text-center mb-1">
            <span className="font-mono text-xs text-[#A78BFA]">📧 {email}</span>
          </div>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            required
            className="bg-[rgba(30,30,36,0.8)] border border-[rgba(124,58,237,0.25)] text-[#EDEEF0] placeholder-[#4B5563] font-mono text-sm rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[rgba(124,58,237,0.4)] transition-all"
          />
          <select
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            required
            className="bg-[rgba(30,30,36,0.9)] border border-[rgba(124,58,237,0.25)] text-[#EDEEF0] font-mono text-sm rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#7C3AED] transition-all appearance-none cursor-pointer"
          >
            <option value="" disabled className="bg-[#1E1E24]">
              Primary bank…
            </option>
            {BANKS.map((b) => (
              <option key={b} value={b} className="bg-[#1E1E24]">
                {b}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading}
            className="violet-glow-btn font-sans font-medium text-white rounded-xl px-6 py-3.5 text-sm w-full flex items-center justify-center gap-2 mt-1"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Claim My Spot on the Waitlist'
            )}
          </button>
          <p className="font-sans text-xs text-[#4B5563] text-center">
            This personalizes your waitlist position. No bank login required.
          </p>
        </form>
      )}
    </div>
  );
}
