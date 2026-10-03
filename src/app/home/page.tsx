'use client';
import React, { useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroCards from './components/HeroCards';
import WaitlistForm from './components/WaitlistForm';
import SpecReveal1 from './components/SpecReveal1';
import SpecReveal2 from './components/SpecReveal2';
import SpecReveal3 from './components/SpecReveal3';
import SpecSheet from './components/SpecSheet';
import StickyCtaBar from './components/StickyCtaBar';

export default function HomePage() {
  // Initialize scroll reveal observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -5% 0px' }
    );

    document.querySelectorAll('.reveal')?.forEach(el => observer?.observe(el));
    return () => observer?.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#09090B] text-[#EDEEF0] overflow-x-hidden">
      <Header />

      {/* ─── Hero ───────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 pb-16 px-6 lg:px-8 overflow-hidden">
        {/* Atmospheric background layers */}
        {/* Layer 1 — deep orb */}
        <div
          className="bg-orb w-[800px] h-[800px] bg-[rgba(124,58,237,0.08)]"
          style={{
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            animation: 'orb-drift 18s ease-in-out infinite',
          }}
        />
        {/* Layer 2 — left accent */}
        <div
          className="bg-orb w-[400px] h-[400px] bg-[rgba(109,40,217,0.06)]"
          style={{
            top: '20%', left: '-10%',
            animation: 'orb-drift 14s ease-in-out infinite reverse',
          }}
        />
        {/* Layer 3 — right accent */}
        <div
          className="bg-orb w-[300px] h-[300px] bg-[rgba(167,139,250,0.05)]"
          style={{
            bottom: '15%', right: '-5%',
            animation: 'orb-drift 16s ease-in-out infinite 2s',
          }}
        />

        {/* Content */}
        <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col items-center">
          {/* Badge */}
          <div
            className="reveal visible mb-8 inline-flex items-center gap-2 glass-card-subtle px-4 py-2 rounded-full"
            style={{ animation: 'fadeInUp 0.7s ease-out 0.1s both' }}
          >
            <span className="w-2 h-2 rounded-full bg-[#7C3AED] animate-pulse" />
            <span className="font-mono text-[11px] text-[#A78BFA] tracking-widest uppercase">Now in private beta</span>
            <span className="font-mono text-[11px] text-[#4B5563]">·</span>
            <span className="font-mono text-[11px] text-[#6B7280]">4,200+ on waitlist</span>
          </div>

          {/* Cards — shown first */}
          <div
            className="w-full mb-12"
            style={{
              perspective: '1200px',
              opacity: 0,
              animation: 'fadeInScale 0.9s cubic-bezier(0.22,1,0.36,1) 0.2s forwards',
            }}
          >
            <HeroCards />
          </div>

          {/* Typewriter headline — appears after 2-beat delay */}
          <div
            className="text-center mb-8"
            style={{
              opacity: 0,
              animation: 'fadeInUp 0.8s ease-out 1.6s forwards',
            }}
          >
            <div className="overflow-hidden inline-block">
              <h1
                className="font-mono text-3xl md:text-5xl lg:text-6xl font-bold text-[#EDEEF0] tracking-tight"
                style={{
                  textShadow: '0 0 40px rgba(124,58,237,0.3)',
                }}
              >
                <span className="typewriter-text">See everything. Cancel anything.</span>
              </h1>
            </div>
            <p
              className="font-sans text-[#9CA3AF] text-lg mt-4 max-w-xl mx-auto leading-relaxed"
              style={{
                opacity: 0,
                animation: 'fadeInUp 0.7s ease-out 3.8s forwards',
              }}
            >
              Metric surfaces every subscription, categorizes every dollar, and fits it all on one screen you'll actually want to look at.
            </p>
          </div>

          {/* Primary CTA — waitlist form */}
          <div
            id="waitlist"
            className="w-full max-w-md"
            style={{
              opacity: 0,
              animation: 'fadeInScale 0.8s ease-out 4.2s forwards',
            }}
          >
            <WaitlistForm />
            <p className="font-mono text-[11px] text-[#4B5563] text-center mt-3">
              No bank login required to join. Free forever for early members.
            </p>
          </div>

          {/* Secondary CTA */}
          <div
            className="mt-8"
            style={{
              opacity: 0,
              animation: 'fadeInUp 0.6s ease-out 4.6s forwards',
            }}
          >
            <a
              href="#spec-sheet"
              className="font-sans text-sm text-[#6B7280] hover:text-[#A78BFA] transition-colors inline-flex items-center gap-2"
            >
              See the Full Spec Sheet
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ opacity: 0, animation: 'fadeInUp 0.6s ease-out 5s forwards' }}
        >
          <span className="font-mono text-[10px] text-[#3F3F46] tracking-widest uppercase">scroll to reveal</span>
          <div className="w-5 h-8 border border-[rgba(237,238,240,0.12)] rounded-full flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 bg-[#7C3AED] rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* Sticky trigger anchor — sticky CTA appears after this */}
      <div id="sticky-trigger" />

      {/* ─── Spec Reveals ───────────────────────────────────────── */}
      <div className="border-t border-[rgba(124,58,237,0.08)]">
        <SpecReveal1 />
      </div>
      <div className="border-t border-[rgba(124,58,237,0.06)]">
        <SpecReveal2 />
      </div>
      <div className="border-t border-[rgba(124,58,237,0.06)]">
        <SpecReveal3 />
      </div>

      {/* ─── Feature Spec Sheet ─────────────────────────────────── */}
      <div className="border-t border-[rgba(124,58,237,0.08)]">
        <SpecSheet />
      </div>

      {/* ─── Final CTA banner ───────────────────────────────────── */}
      <section className="py-32 px-6 lg:px-8 relative overflow-hidden">
        <div
          className="bg-orb w-[600px] h-[600px] bg-[rgba(124,58,237,0.08)]"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
        />
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <div className="reveal mb-6">
            <span className="shimmer-text font-mono text-[11px] tracking-widest uppercase">
              Stop paying for things you forgot about
            </span>
          </div>
          <h2 className="reveal reveal-delay-1 font-mono text-4xl md:text-5xl font-bold text-[#EDEEF0] mb-6 leading-tight">
            Your money deserves{' '}
            <span className="text-gradient-violet">one screen.</span>
          </h2>
          <p className="reveal reveal-delay-2 font-sans text-[#9CA3AF] text-lg mb-10 leading-relaxed">
            Join 4,200+ people who signed up this week. We'll scan every subscription the moment we launch.
          </p>
          <div className="reveal reveal-delay-3 max-w-md mx-auto">
            <WaitlistForm />
          </div>
        </div>
      </section>

      <Footer />
      <StickyCtaBar />
    </div>
  );
}