'use client';
import React, { useEffect, useRef, useState } from 'react';

interface FeatureRow {
  feature: string;
  description: string;
  metric: boolean | string;
  basic: boolean | string;
  manual: boolean | string;
}

const FEATURES: FeatureRow[] = [
  {
    feature: 'Subscription detection',
    description: 'Auto-finds recurring charges',
    metric: 'All accounts',
    basic: 'Partial',
    manual: false,
  },
  {
    feature: 'Real-time categorization',
    description: 'Tags every transaction automatically',
    metric: true,
    basic: true,
    manual: false,
  },
  {
    feature: 'One-tap cancellation',
    description: 'Cancel without leaving the app',
    metric: true,
    basic: false,
    manual: false,
  },
  {
    feature: 'Renewal alerts',
    description: '7-day advance notice',
    metric: '7 days prior',
    basic: '1 day prior',
    manual: false,
  },
  {
    feature: 'Multi-bank sync',
    description: 'Connect all accounts at once',
    metric: 'Unlimited',
    basic: '2 accounts',
    manual: false,
  },
  {
    feature: 'Spending insights',
    description: 'AI-powered monthly analysis',
    metric: 'AI-powered',
    basic: 'Basic charts',
    manual: false,
  },
  {
    feature: 'Budget rings',
    description: 'Visual per-category budgets',
    metric: true,
    basic: false,
    manual: false,
  },
  {
    feature: 'Partner sharing',
    description: 'Shared view for couples',
    metric: true,
    basic: false,
    manual: false,
  },
  {
    feature: 'Export & reports',
    description: 'CSV, PDF, tax-ready formats',
    metric: true,
    basic: false,
    manual: false,
  },
  {
    feature: 'Bank-grade encryption',
    description: '256-bit AES, read-only access',
    metric: true,
    basic: true,
    manual: false,
  },
];

function Cell({ val }: { val: boolean | string }) {
  if (val === false) return <span className="text-[#3F3F46]">—</span>;
  if (val === true)
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[rgba(124,58,237,0.2)] border border-[rgba(124,58,237,0.4)]">
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#A78BFA"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
    );
  return <span className="font-mono text-[11px] text-[#A78BFA]">{val}</span>;
}

export default function SpecSheet() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="spec-sheet"
      ref={sectionRef}
      className="relative py-32 px-6 lg:px-8 overflow-hidden"
    >
      <div
        className="bg-orb w-[700px] h-[700px] bg-[rgba(124,58,237,0.03)]"
        style={{ top: '20%', left: '50%', transform: 'translateX(-50%)' }}
      />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className={`reveal ${visible ? 'visible' : ''} mb-4`}>
          <span className="font-mono text-[11px] text-[#6B7280] tracking-widest uppercase border border-[rgba(124,58,237,0.2)] rounded-full px-4 py-1.5 bg-[rgba(124,58,237,0.04)] inline-flex items-center gap-2">
            Full Spec Sheet
          </span>
        </div>
        <div className={`reveal ${visible ? 'visible' : ''} reveal-delay-1 mb-12`}>
          <h2 className="font-mono text-3xl md:text-4xl font-bold text-[#EDEEF0]">
            The complete breakdown.
          </h2>
          <p className="font-sans text-[#9CA3AF] mt-3 max-w-lg">
            Everything Metric does, compared to the alternatives. If you need every detail before
            committing, this is for you.
          </p>
        </div>

        {/* Table */}
        <div className={`reveal ${visible ? 'visible' : ''} reveal-delay-2`}>
          <div className="glass-card overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 border-b border-[rgba(237,238,240,0.06)]">
              <div className="px-6 py-4 font-mono text-[10px] text-[#6B7280] tracking-widest uppercase">
                Feature
              </div>
              <div className="px-6 py-4 text-center min-w-[100px]">
                <div className="font-mono text-xs font-bold text-[#A78BFA]">metric</div>
                <div className="font-mono text-[9px] text-[#6B7280]">Early Access</div>
              </div>
              <div className="px-6 py-4 text-center min-w-[100px]">
                <div className="font-sans text-xs font-medium text-[#9CA3AF]">Basic Apps</div>
                <div className="font-mono text-[9px] text-[#4B5563]">Mint, etc.</div>
              </div>
              <div className="px-6 py-4 text-center min-w-[100px]">
                <div className="font-sans text-xs font-medium text-[#9CA3AF]">Manual</div>
                <div className="font-mono text-[9px] text-[#4B5563]">Spreadsheet</div>
              </div>
            </div>

            {/* Rows */}
            {FEATURES.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-[1fr_auto_auto_auto] gap-0 border-b border-[rgba(237,238,240,0.04)] hover:bg-[rgba(124,58,237,0.04)] transition-colors ${i % 2 === 0 ? '' : 'bg-[rgba(237,238,240,0.01)]'}`}
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateX(0)' : 'translateX(-12px)',
                  transition: `opacity 0.5s ease ${0.3 + i * 0.04}s, transform 0.5s ease ${0.3 + i * 0.04}s`,
                }}
              >
                <div className="px-6 py-4">
                  <div className="font-sans text-sm text-[#EDEEF0]">{row.feature}</div>
                  <div className="font-sans text-xs text-[#4B5563] mt-0.5">{row.description}</div>
                </div>
                <div className="px-6 py-4 flex items-center justify-center min-w-[100px]">
                  <Cell val={row.metric} />
                </div>
                <div className="px-6 py-4 flex items-center justify-center min-w-[100px]">
                  <Cell val={row.basic} />
                </div>
                <div className="px-6 py-4 flex items-center justify-center min-w-[100px]">
                  <Cell val={row.manual} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className={`reveal ${visible ? 'visible' : ''} reveal-delay-4 mt-12 text-center`}>
          <p className="font-sans text-[#6B7280] mb-6">
            Seen enough? Join the waitlist — we'll scan your subscriptions the moment we launch.
          </p>
          <a
            href="#waitlist"
            className="violet-glow-btn inline-flex items-center gap-2 font-sans font-semibold text-white rounded-full px-8 py-4 text-base"
          >
            <span className="w-2 h-2 rounded-full bg-[#A78BFA] animate-pulse" />
            Scan My Subscriptions
          </a>
        </div>
      </div>
    </section>
  );
}
