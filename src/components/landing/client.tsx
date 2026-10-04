'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { track, type LandingEvent } from '@/lib/analytics';

// Client-only pieces of the landing (kept small: the rest renders on the server).

export function TrackView() {
  useEffect(() => {
    track('landing_view');
  }, []);
  return null;
}

type TrackLinkProps = React.ComponentProps<typeof Link> & {
  event: LandingEvent;
  eventProps?: Record<string, string>;
};

// next/link that reports a landing event on click.
export function TrackLink({ event, eventProps, onClick, ...props }: TrackLinkProps) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        track(event, eventProps);
        onClick?.(e);
      }}
    />
  );
}

// Fades/slides its children in the first time they enter the viewport. Without
// IntersectionObserver or with prefers-reduced-motion the content is shown at once.
export function Reveal({
  children,
  className = '',
  delay = 0,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'section' | 'li' | 'article';
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      data-visible={visible}
      style={{ transitionDelay: visible ? `${delay}ms` : undefined }}
      className={`lp-reveal ${className}`}
    >
      {children}
    </Tag>
  );
}

// FAQ item using <details> (works without JS); reports faq_open when opened.
export function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details
      className="group rounded-2xl border-[2.5px] border-[#111] bg-white px-5 py-4 shadow-[3px_3px_0_#111] open:bg-[#FFF9EC]"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) track('faq_open', { question: q });
      }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-poppins text-[15px] font-bold text-[#111] [&::-webkit-details-marker]:hidden">
        {q}
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-[#111] bg-[#FFD83D] text-lg leading-none transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="mt-3 font-sans text-[15px] font-normal leading-relaxed text-[#333]">
        {children}
      </div>
    </details>
  );
}
