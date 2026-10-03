'use client';
import React, { useEffect, useRef, useState } from 'react';

const MICRO_STATS = [
  { label: 'Avg subscriptions per user', value: '14', suffix: '' },
  { label: 'Users who cancel within 30 days', value: '73', suffix: '%' },
  { label: 'Average monthly waste', value: '$247', suffix: '' },
];

export default function SpecReveal1() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [countDone, setCountDone] = useState(false);
  const [displayVal, setDisplayVal] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Count-up animation for the big number
  useEffect(() => {
    if (!visible) return;
    const target = 247;
    const duration = 1800;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayVal(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
      else setCountDone(true);
    };
    const rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [visible]);

  return (
    <section
      id="spec-reveal-1"
      ref={sectionRef}
      className="relative py-32 px-6 lg:px-8 overflow-hidden"
    >
      {/* Background orbs */}
      <div
        className="bg-orb w-96 h-96 bg-[rgba(124,58,237,0.06)]"
        style={{ top: '20%', left: '50%', transform: 'translateX(-50%)' }}
      />

      <div className="max-w-4xl mx-auto text-center relative z-10">
        {/* Label */}
        <div
          className={`reveal ${visible ? 'visible' : ''} inline-flex items-center gap-2 mb-8`}
        >
          <span className="font-mono text-[11px] text-[#6B7280] tracking-widest uppercase border border-[rgba(124,58,237,0.2)] rounded-full px-4 py-1.5 bg-[rgba(124,58,237,0.04)]">
            Spec 01 / Discovery
          </span>
        </div>

        {/* Big blur-to-sharp number */}
        <div
          className={`blur-reveal ${visible ? 'visible' : ''} mb-6`}
          style={{ transitionDelay: '0.2s' }}
        >
          <div className="flex items-baseline justify-center gap-1">
            <span className="font-mono font-bold text-[clamp(5rem,16vw,10rem)] leading-none text-[#EDEEF0]"
              style={{ textShadow: countDone ? '0 0 60px rgba(124,58,237,0.5)' : 'none', transition: 'text-shadow 1s ease' }}
            >
              ${displayVal}
            </span>
            <span className="font-mono text-4xl text-[#7C3AED] font-bold">/mo</span>
          </div>
        </div>

        {/* Subheadline */}
        <div className={`reveal ${visible ? 'visible' : ''} reveal-delay-3`}>
          <p className="font-sans text-xl md:text-2xl text-[#9CA3AF] leading-relaxed max-w-xl mx-auto">
            in subscriptions you{' '}
            <span className="text-gradient-violet font-medium">forgot you signed up for</span>
            . Metric finds them all.
          </p>
        </div>

        {/* Micro stats */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {MICRO_STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={`reveal ${visible ? 'visible' : ''} glass-card p-6 text-center`}
              style={{ transitionDelay: `${0.4 + i * 0.12}s` }}
            >
              <div className="font-mono text-3xl font-bold text-[#EDEEF0] mb-2"
                style={{ textShadow: '0 0 20px rgba(124,58,237,0.3)' }}
              >
                {stat.value}{stat.suffix}
              </div>
              <div className="font-sans text-xs text-[#6B7280] leading-relaxed">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}