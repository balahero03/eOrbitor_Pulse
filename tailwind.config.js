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
    },
  },
  plugins: [],
};
