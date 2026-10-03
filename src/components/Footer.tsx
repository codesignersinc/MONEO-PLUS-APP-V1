import React from 'react';
import AppLogo from '@/components/ui/AppLogo';

export default function Footer() {
  return (
    <footer className="border-t border-[rgba(124,58,237,0.12)] py-10 px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Logo + links */}
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <AppLogo
            text="metric"
            iconName="ChartBarIcon"
            size={22}
            className="font-mono font-semibold tracking-tighter text-[#EDEEF0] opacity-70"
          />
          <div className="flex items-center gap-5">
            {['Privacy', 'Terms', 'Security', 'Blog']?.map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm font-sans font-medium text-[#6B7280] hover:text-[#EDEEF0] transition-colors"
              >
                {link}
              </a>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-5">
          {/* Social icons */}
          {[
            {
              label: 'Twitter',
              path: 'M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z',
            },
            {
              label: 'GitHub',
              path: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22',
            },
          ]?.map(({ label, path }) => (
            <a
              key={label}
              href="#"
              aria-label={label}
              className="text-[#6B7280] hover:text-[#A78BFA] transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={path} />
              </svg>
            </a>
          ))}
          <span className="text-sm font-sans text-[#4B5563]">© 2026 Metric, Inc.</span>
        </div>
      </div>
    </footer>
  );
}
