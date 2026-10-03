'use client';
import React, { useState, useEffect } from 'react';
import AppLogo from '@/components/ui/AppLogo';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[rgba(9,9,11,0.85)] backdrop-blur-xl border-b border-[rgba(124,58,237,0.15)]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <AppLogo
            text="metric"
            iconName="ChartBarIcon"
            size={28}
            className="font-mono font-semibold tracking-tighter text-[#EDEEF0]"
          />
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {['Features', 'How It Works', 'Spec Sheet']?.map((item) => (
            <a
              key={item}
              href={`#${item?.toLowerCase()?.replace(/\s+/g, '-')}`}
              className="text-sm font-sans text-[#9CA3AF] hover:text-[#EDEEF0] transition-colors duration-200"
            >
              {item}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <a
            href="#waitlist"
            className="violet-glow-btn hidden sm:inline-flex items-center gap-2 text-sm font-sans font-medium text-white rounded-full px-5 py-2.5"
          >
            <span className="w-2 h-2 rounded-full bg-[#A78BFA] animate-pulse" />
            Scan My Subscriptions
          </a>
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-[#9CA3AF] hover:text-[#EDEEF0] transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[rgba(9,9,11,0.97)] backdrop-blur-xl border-t border-[rgba(124,58,237,0.1)] px-6 py-6 flex flex-col gap-5">
          {['Features', 'How It Works', 'Spec Sheet']?.map((item) => (
            <a
              key={item}
              href={`#${item?.toLowerCase()?.replace(/\s+/g, '-')}`}
              className="text-base font-sans text-[#9CA3AF] hover:text-[#EDEEF0] transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {item}
            </a>
          ))}
          <a
            href="#waitlist"
            className="violet-glow-btn inline-flex items-center justify-center gap-2 text-sm font-sans font-medium text-white rounded-full px-5 py-3 mt-2"
            onClick={() => setMenuOpen(false)}
          >
            <span className="w-2 h-2 rounded-full bg-[#A78BFA] animate-pulse" />
            Scan My Subscriptions
          </a>
        </div>
      )}
    </header>
  );
}