'use client';
import React, { useEffect, useRef, useState } from 'react';

interface Subscription {
  id: number;
  name: string;
  price: number;
  renewal: string;
  category: string;
  forgotten: boolean;
  icon: string;
  fanRotate: number;
  fanOffset: number;
}

const SUBSCRIPTIONS: Subscription[] = [
  {
    id: 1,
    name: 'Netflix',
    price: 15.49,
    renewal: 'Mar 3',
    category: 'Entertainment',
    forgotten: false,
    icon: '📺',
    fanRotate: -8,
    fanOffset: -20,
  },
  {
    id: 2,
    name: 'Adobe CC',
    price: 54.99,
    renewal: 'Mar 5',
    category: 'Creative',
    forgotten: true,
    icon: '🎨',
    fanRotate: -4,
    fanOffset: -10,
  },
  {
    id: 3,
    name: 'Headspace',
    price: 12.99,
    renewal: 'Mar 8',
    category: 'Wellness',
    forgotten: true,
    icon: '🧘',
    fanRotate: 0,
    fanOffset: 0,
  },
  {
    id: 4,
    name: 'Duolingo Plus',
    price: 6.99,
    renewal: 'Mar 12',
    category: 'Education',
    forgotten: true,
    icon: '🦉',
    fanRotate: 4,
    fanOffset: 10,
  },
  {
    id: 5,
    name: 'Amazon Prime',
    price: 14.99,
    renewal: 'Mar 15',
    category: 'Shopping',
    forgotten: false,
    icon: '📦',
    fanRotate: 8,
    fanOffset: 20,
  },
];

function SubscriptionCard({
  sub,
  index,
  fanned,
  onCancel,
  cancelled,
}: {
  sub: Subscription;
  index: number;
  fanned: boolean;
  onCancel: (id: number) => void;
  cancelled: Set<number>;
}) {
  const [flipped, setFlipped] = useState(false);
  const isGone = cancelled.has(sub.id);

  return (
    <div
      className="flip-card absolute"
      style={{
        width: '240px',
        height: '140px',
        left: '50%',
        top: '50%',
        marginLeft: '-120px',
        marginTop: '-70px',
        transform: fanned
          ? `rotate(${sub.fanRotate}deg) translateY(${sub.fanOffset}px)`
          : 'rotate(0deg) translateY(0px)',
        transition: `transform 0.6s cubic-bezier(0.34,1.56,0.64,1) ${index * 0.08}s, opacity 0.4s ease`,
        zIndex: index + 1,
        opacity: isGone ? 0 : 1,
        pointerEvents: isGone ? 'none' : 'auto',
      }}
      onClick={() => !flipped && setFlipped(true)}
    >
      <div className={`flip-card-inner ${flipped ? 'flipped' : ''}`}>
        {/* Front */}
        <div
          className="flip-card-front glass-card p-4 cursor-pointer hover:border-[rgba(124,58,237,0.4)] transition-colors"
          style={{
            border: sub.forgotten
              ? '1px solid rgba(124,58,237,0.3)'
              : '1px solid rgba(237,238,240,0.08)',
          }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">{sub.icon}</span>
              <div>
                <div className="font-sans text-sm font-semibold text-[#EDEEF0]">{sub.name}</div>
                <div className="font-mono text-[10px] text-[#6B7280]">{sub.category}</div>
              </div>
            </div>
            {sub.forgotten && (
              <span className="font-mono text-[9px] bg-[rgba(124,58,237,0.2)] text-[#A78BFA] border border-[rgba(124,58,237,0.3)] rounded-full px-2 py-0.5">
                forgotten
              </span>
            )}
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="font-mono text-lg font-bold text-[#EDEEF0]">${sub.price}/mo</div>
              <div className="font-sans text-[10px] text-[#4B5563]">Renews {sub.renewal}</div>
            </div>
            <div className="font-mono text-[10px] text-[#7C3AED]">tap to manage →</div>
          </div>
        </div>

        {/* Back */}
        <div
          className="flip-card-back glass-card p-4 flex flex-col justify-between"
          style={{ background: 'rgba(30,30,36,0.9)', border: '1px solid rgba(124,58,237,0.3)' }}
        >
          <div>
            <div className="font-mono text-[10px] text-[#6B7280] mb-2">MANAGE SUBSCRIPTION</div>
            <div className="font-sans text-sm font-semibold text-[#EDEEF0]">{sub.name}</div>
            <div className="font-mono text-xs text-[#A78BFA] mt-1">
              ${sub.price}/mo · Renews {sub.renewal}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              className="flex-1 py-2 rounded-lg font-sans text-xs font-semibold text-[#EF4444] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] hover:bg-[rgba(239,68,68,0.15)] transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onCancel(sub.id);
              }}
            >
              Cancel
            </button>
            <button
              className="flex-1 py-2 rounded-lg font-sans text-xs font-semibold text-[#9CA3AF] border border-[rgba(237,238,240,0.1)] hover:bg-[rgba(237,238,240,0.05)] transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setFlipped(false);
              }}
            >
              Keep
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SpecReveal3() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [fanned, setFanned] = useState(false);
  const [cancelled, setCancelled] = useState<Set<number>>(new Set());

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setFanned(true), 600);
    return () => clearTimeout(t);
  }, [visible]);

  const handleCancel = (id: number) => {
    setCancelled((prev) => new Set([...prev, id]));
  };

  const savedPerMonth = Array.from(cancelled).reduce((sum, id) => {
    const sub = SUBSCRIPTIONS.find((s) => s.id === id);
    return sum + (sub?.price ?? 0);
  }, 0);

  return (
    <section
      id="spec-reveal-3"
      ref={sectionRef}
      className="relative py-32 px-6 lg:px-8 overflow-hidden"
    >
      <div
        className="bg-orb w-[600px] h-[600px] bg-[rgba(124,58,237,0.05)]"
        style={{ top: '10%', left: '-15%' }}
      />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className={`reveal ${visible ? 'visible' : ''} mb-4`}>
          <span className="font-mono text-[11px] text-[#6B7280] tracking-widest uppercase border border-[rgba(124,58,237,0.2)] rounded-full px-4 py-1.5 bg-[rgba(124,58,237,0.04)] inline-flex items-center gap-2">
            Spec 03 / Subscription Control
          </span>
        </div>
        <div className={`reveal ${visible ? 'visible' : ''} reveal-delay-1 mb-16`}>
          <h2 className="font-mono text-3xl md:text-5xl font-bold text-[#EDEEF0] leading-tight">
            Cancel anything. <span className="text-gradient-violet">One tap.</span>
          </h2>
          <p className="font-sans text-[#9CA3AF] mt-4 max-w-xl">
            Metric surfaces every active subscription, shows you the renewal date and cost, and lets
            you cancel without ever leaving the app.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Card fan */}
          <div className={`reveal ${visible ? 'visible' : ''} reveal-delay-2`}>
            <div className="relative flex items-center justify-center" style={{ height: '280px' }}>
              {SUBSCRIPTIONS.map((sub, i) => (
                <SubscriptionCard
                  key={sub.id}
                  sub={sub}
                  index={i}
                  fanned={fanned}
                  onCancel={handleCancel}
                  cancelled={cancelled}
                />
              ))}
            </div>
            <p className="font-mono text-[11px] text-[#4B5563] text-center mt-4">
              {fanned ? 'tap any card to manage' : 'fanning your subscriptions…'}
            </p>
          </div>

          {/* Stats sidebar */}
          <div className={`reveal ${visible ? 'visible' : ''} reveal-delay-3 flex flex-col gap-4`}>
            {/* Savings counter */}
            <div className="glass-card p-6">
              <div className="font-mono text-[10px] text-[#6B7280] tracking-widest uppercase mb-3">
                Potential Monthly Savings
              </div>
              <div
                className="font-mono text-4xl font-bold transition-all duration-500"
                style={{
                  color: savedPerMonth > 0 ? '#A78BFA' : '#EDEEF0',
                  textShadow: savedPerMonth > 0 ? '0 0 30px rgba(167,139,250,0.6)' : 'none',
                }}
              >
                ${savedPerMonth.toFixed(2)}
              </div>
              {savedPerMonth > 0 && (
                <div className="font-sans text-xs text-[#6B7280] mt-1">
                  That's ${(savedPerMonth * 12).toFixed(0)} back per year
                </div>
              )}
            </div>

            {/* Sub list */}
            <div className="glass-card p-5">
              <div className="font-mono text-[10px] text-[#6B7280] tracking-widest uppercase mb-4">
                Your Stack
              </div>
              <div className="space-y-3">
                {SUBSCRIPTIONS.map((sub) => (
                  <div
                    key={sub.id}
                    className={`flex items-center justify-between transition-all duration-400 ${cancelled.has(sub.id) ? 'opacity-30 line-through' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{sub.icon}</span>
                      <span className="font-sans text-sm text-[#9CA3AF]">{sub.name}</span>
                    </div>
                    <span className="font-mono text-sm text-[#EDEEF0]">${sub.price}/mo</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-[rgba(237,238,240,0.06)] mt-4 pt-4 flex items-center justify-between">
                <span className="font-sans text-xs text-[#6B7280]">Total / month</span>
                <span className="font-mono text-sm font-bold text-[#EDEEF0]">
                  $
                  {SUBSCRIPTIONS.reduce(
                    (s, sub) => s + (cancelled.has(sub.id) ? 0 : sub.price),
                    0
                  ).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
