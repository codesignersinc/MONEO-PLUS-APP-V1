/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/pages/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        void: '#09090B',
        violet: {
          DEFAULT: '#7C3AED',
          light: '#A78BFA',
          dim: '#4C1D95',
          glow: '#6D28D9',
        },
        graphite: {
          DEFAULT: '#1E1E24',
          light: '#2A2A32',
        },
        phosphor: {
          DEFAULT: '#EDEEF0',
          muted: '#9CA3AF',
        },
        // Finance app colors
        fin: {
          bg: '#FAFAF8',
          card: '#FFFFFF',
          text: '#0F172A',
          muted: '#64748B',
          border: '#E2E8F0',
          green: '#16A34A',
          'green-light': '#DCFCE7',
          'green-muted': '#86EFAC',
          red: '#DC2626',
          'red-light': '#FEE2E2',
          amber: '#D97706',
          'amber-light': '#FEF3C7',
          blue: '#2563EB',
          'blue-light': '#DBEAFE',
          purple: '#7C3AED',
          'purple-light': '#EDE9FE',
          teal: '#0D9488',
          'teal-light': '#CCFBF1',
          yellow: '#FFD93D',
          'yellow-light': '#FFF9C4',
          coral: '#FB923C',
          'coral-light': '#FFEDD5',
          lime: '#4ADE80',
          'lime-light': '#DCFCE7',
          lilac: '#C084FC',
          'lilac-light': '#F3E8FF',
          sky: '#93C5FD',
          'sky-light': '#DBEAFE',
          pink: '#FECACA',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        manrope: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        poppins: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        700: '700',
        800: '800',
      },
      scale: {
        98: '0.98',
      },
      borderRadius: {
        fin: '16px',
      },
      boxShadow: {
        'fin-card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'fin-card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'violet-glow': '0 0 40px rgba(124, 58, 237, 0.5)',
        'violet-sm': '0 0 16px rgba(124, 58, 237, 0.3)',
        card: '0 24px 80px rgba(0,0,0,0.6)',
      },
      animation: {
        'float-slow': 'floatCard 6s ease-in-out infinite',
        'pulse-violet': 'pulse-violet 2s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'orb-drift': 'orb-drift 12s ease-in-out infinite',
        'tick-up': 'tickUp 0.4s ease-in-out',
        'sort-slide': 'sortSlide 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'fade-in': 'fadeIn 0.2s ease-out',
        'bar-shine': 'barShine 1.8s linear infinite',
        heartbeat: 'heartbeat 1.6s ease-in-out infinite',
      },
      keyframes: {
        floatCard: {
          '0%, 100%': { transform: 'var(--card-base-transform) translateY(0px)' },
          '50%': { transform: 'var(--card-base-transform) translateY(-6px)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        barShine: {
          from: { backgroundPosition: '0 0' },
          to: { backgroundPosition: '28px 0' },
        },
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '12%': { transform: 'scale(1.06)' },
          '24%': { transform: 'scale(1)' },
          '36%': { transform: 'scale(1.04)' },
        },
      },
      backdropBlur: {
        xs: '4px',
      },
    },
  },
  plugins: [],
};
