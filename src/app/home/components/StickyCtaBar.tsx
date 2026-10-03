'use client';
import React, { useEffect, useState } from 'react';

export default function StickyCtaBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const trigger = document.getElementById('sticky-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), {
      threshold: 0,
      rootMargin: '0px',
    });
    observer?.observe(trigger);
    return () => observer?.disconnect();
  }, []);

  if (!show) return null;

  return (
    <div className="sticky-cta fixed bottom-0 left-0 right-0 z-50 px-4 pb-4">
      <div
        className="max-w-lg mx-auto glass-card p-3 flex items-center gap-3 shadow-card"
        style={{ border: '1px solid rgba(124,58,237,0.35)' }}
      >
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs text-[#A78BFA] truncate">
            <span className="text-[#6B7280]">avg savings: </span>$247/mo
          </p>
        </div>
        <a
          href="#waitlist"
          className="violet-glow-btn flex-shrink-0 inline-flex items-center gap-2 font-sans font-semibold text-white rounded-full px-5 py-2.5 text-sm"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] animate-pulse" />
          Scan My Subscriptions
        </a>
      </div>
    </div>
  );
}
