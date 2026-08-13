/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // `xs` covers the gap between a narrow phone (~360px) and Tailwind's
      // default `sm` (640px), which is really a tablet breakpoint. Several
      // places already wrote `hidden xs:inline` expecting this to exist; with
      // no `xs` screen defined those classes were never generated, so the
      // elements stayed hidden at every width.
      screens: {
        xs: '480px',
      },
      colors: {
        primary: '#0066CC',
        secondary: '#1F2937',
        success: '#00AA44',
        warning: '#FF9900',
        error: '#CC0000',
        neutral: '#666666',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      // Shared motion primitives — toasts, dialogs, dropdowns, and the
      // branded loader all reuse these instead of each hand-rolling a
      // one-off transition, so entrances/exits feel like one system.
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.94) translateY(4px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Exit counterparts. Every modal in the app animated in and then
        // disappeared on close, which is what made closing one to open another
        // read as a jump cut rather than a transition.
        'scale-out': {
          from: { opacity: '1', transform: 'scale(1) translateY(0)' },
          to: { opacity: '0', transform: 'scale(0.96) translateY(4px)' },
        },
        'slide-down': {
          from: { opacity: '1', transform: 'translateY(0)' },
          to: { opacity: '0', transform: 'translateY(12px)' },
        },
        'toast-progress': { from: { transform: 'scaleX(1)' }, to: { transform: 'scaleX(0)' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        // Meshed-gear loader. Two directions are needed because adjacent gears
        // in a real train counter-rotate; spinning them all the same way is the
        // detail that makes a gear animation look wrong without anyone being
        // able to say why.
        'gear-cw': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        'gear-ccw': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(-360deg)' } },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'fade-out': 'fade-out 150ms ease-in forwards',
        'scale-in': 'scale-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        // `forwards` holds the end state for the ~180ms the element stays
        // mounted, so it cannot flash back to full opacity before unmounting.
        'scale-out': 'scale-out 160ms cubic-bezier(0.4, 0, 1, 1) forwards',
        'slide-down': 'slide-down 180ms cubic-bezier(0.4, 0, 1, 1) forwards',
        'toast-progress': 'toast-progress linear forwards',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
        // Durations are overridden per gear so each one's *rim* speed matches
        // its neighbours (period proportional to tooth count).
        'gear-cw': 'gear-cw 3s linear infinite',
        'gear-ccw': 'gear-ccw 3s linear infinite',
      },
    },
  },
  plugins: [],
};
