/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#ffffff',
        fg: '#0f172a',
        muted: '#64748b',
        border: '#e2e8f0',
        card: '#f8fafc',
        accent: '#6366f1',
        danger: '#ef4444',
        success: '#10b981',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
