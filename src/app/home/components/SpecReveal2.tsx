'use client';
import React, { useEffect, useRef, useState } from 'react';

interface Transaction {
  id: number;
  merchant: string;
  category: string;
  amount: number;
  date: string;
  icon: string;
  color: string;
}

const RAW_TRANSACTIONS: Transaction[] = [
  { id: 1,  merchant: 'Whole Foods',      category: 'Groceries',  amount: -84.32,  date: 'Feb 26', icon: '🥦', color: '#10B981' },
  { id: 2,  merchant: 'Netflix',          category: 'Streaming',  amount: -15.49,  date: 'Feb 25', icon: '📺', color: '#7C3AED' },
  { id: 3,  merchant: 'Uber',             category: 'Transit',    amount: -12.80,  date: 'Feb 25', icon: '🚗', color: '#F59E0B' },
  { id: 4,  merchant: 'Spotify',          category: 'Streaming',  amount: -10.99,  date: 'Feb 24', icon: '🎵', color: '#7C3AED' },
  { id: 5,  merchant: 'Trader Joe\'s',    category: 'Groceries',  amount: -61.14,  date: 'Feb 24', icon: '🛒', color: '#10B981' },
  { id: 6,  merchant: 'MTA Transit',      category: 'Transit',    amount: -33.00,  date: 'Feb 23', icon: '🚇', color: '#F59E0B' },
  { id: 7,  merchant: 'Adobe CC',         category: 'Streaming',  amount: -54.99,  date: 'Feb 22', icon: '🎨', color: '#7C3AED' },
  { id: 8,  merchant: 'Chipotle',         category: 'Dining',     amount: -14.75,  date: 'Feb 22', icon: '🌯', color: '#EF4444' },
  { id: 9,  merchant: 'Amazon Prime',     category: 'Streaming',  amount: -14.99,  date: 'Feb 21', icon: '📦', color: '#7C3AED' },
  { id: 10, merchant: 'Target',           category: 'Shopping',   amount: -47.83,  date: 'Feb 21', icon: '🎯', color: '#EC4899' },
];

const CATEGORY_ORDER = ['Streaming', 'Groceries', 'Transit', 'Dining', 'Shopping'];

export default function SpecReveal2() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [sorted, setSorted] = useState(false);
  const [items, setItems] = useState<Transaction[]>(RAW_TRANSACTIONS);

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

  // Trigger sort after reveal
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setSorted(true);
      setItems([...RAW_TRANSACTIONS].sort((a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
      ));
    }, 1200);
    return () => clearTimeout(t);
  }, [visible]);

  const categoryTotals = CATEGORY_ORDER.map(cat => ({
    cat,
    total: RAW_TRANSACTIONS.filter(t => t.category === cat).reduce((s, t) => s + Math.abs(t.amount), 0),
    color: RAW_TRANSACTIONS.find(t => t.category === cat)?.color ?? '#6B7280',
  }));

  return (
    <section
      id="spec-reveal-2"
      ref={sectionRef}
      className="relative py-32 px-6 lg:px-8 overflow-hidden"
    >
      <div className="bg-orb w-[500px] h-[500px] bg-[rgba(124,58,237,0.04)]" style={{ top: '30%', right: '-10%' }} />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className={`reveal ${visible ? 'visible' : ''} mb-4`}>
          <span className="font-mono text-[11px] text-[#6B7280] tracking-widest uppercase border border-[rgba(124,58,237,0.2)] rounded-full px-4 py-1.5 bg-[rgba(124,58,237,0.04)] inline-flex items-center gap-2">
            Spec 02 / Transaction Intelligence
          </span>
        </div>
        <div className={`reveal ${visible ? 'visible' : ''} reveal-delay-1 mb-12`}>
          <h2 className="font-mono text-3xl md:text-5xl font-bold text-[#EDEEF0] leading-tight">
            Every dollar,{' '}
            <span className="text-gradient-violet">sorted in real time.</span>
          </h2>
          <p className="font-sans text-[#9CA3AF] mt-4 max-w-xl">
            Metric reads your transactions and categorizes them automatically — no manual tagging, no spreadsheets, no guessing.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Transaction feed */}
          <div className={`reveal ${visible ? 'visible' : ''} reveal-delay-2 lg:col-span-3`}>
            <div className="glass-card overflow-hidden">
              {/* Header bar */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(237,238,240,0.06)]">
                <span className="font-mono text-xs text-[#6B7280]">Transactions — Feb 2026</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-[10px] px-2.5 py-1 rounded-full transition-all duration-500 ${
                      sorted
                        ? 'bg-[rgba(124,58,237,0.2)] text-[#A78BFA] border border-[rgba(124,58,237,0.3)]'
                        : 'bg-[rgba(237,238,240,0.06)] text-[#4B5563]'
                    }`}
                  >
                    {sorted ? '✓ Sorted by category' : 'Sorting…'}
                  </span>
                </div>
              </div>

              {/* List */}
              <div className="divide-y divide-[rgba(237,238,240,0.04)]">
                {items.map((tx, i) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-[rgba(237,238,240,0.03)] transition-colors"
                    style={{
                      animation: sorted ? `sortSlide 0.35s ease-out ${i * 0.05}s both` : 'none',
                    }}
                  >
                    <span className="text-lg w-8 text-center flex-shrink-0">{tx.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-sans text-sm text-[#EDEEF0] truncate">{tx.merchant}</div>
                      <div className="font-mono text-[10px] text-[#4B5563]">{tx.date}</div>
                    </div>
                    <div
                      className="font-mono text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        background: `${tx.color}18`,
                        color: tx.color,
                        border: `1px solid ${tx.color}30`,
                      }}
                    >
                      {tx.category}
                    </div>
                    <div className="font-mono text-sm text-[#EDEEF0] flex-shrink-0 w-16 text-right">
                      {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          <div className={`reveal ${visible ? 'visible' : ''} reveal-delay-3 lg:col-span-2 flex flex-col gap-4`}>
            <div className="glass-card p-5 flex-1">
              <div className="font-mono text-[10px] text-[#6B7280] tracking-widest uppercase mb-5">Category Breakdown</div>
              <div className="space-y-4">
                {categoryTotals.map(({ cat, total, color }) => {
                  const max = Math.max(...categoryTotals.map(c => c.total));
                  const pct = (total / max) * 100;
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-sans text-xs text-[#9CA3AF]">{cat}</span>
                        <span className="font-mono text-xs text-[#EDEEF0]">${total.toFixed(0)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[rgba(237,238,240,0.06)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{
                            width: visible ? `${pct}%` : '0%',
                            background: color,
                            boxShadow: `0 0 8px ${color}60`,
                            transitionDelay: `${0.6 + categoryTotals.findIndex(c => c.cat === cat) * 0.1}s`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-card p-5">
              <div className="font-mono text-[10px] text-[#6B7280] tracking-widest uppercase mb-3">Month Total</div>
              <div className="font-mono text-3xl font-bold text-[#EDEEF0]"
                style={{ textShadow: '0 0 24px rgba(124,58,237,0.4)' }}
              >
                $350.30
              </div>
              <div className="font-sans text-xs text-[#6B7280] mt-1">across 10 transactions</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}