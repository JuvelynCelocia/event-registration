/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('--c-bg'),
        card: token('--c-card'),
        ink: token('--c-ink'),
        mute: token('--c-mute'),
        line: token('--c-line'),
        brand: token('--c-brand'),
        'brand-ink': token('--c-brand-ink'),
        accent: token('--c-accent'),
        mint: token('--c-mint'),
        danger: token('--c-danger'),
        'danger-bg': token('--c-danger-bg'),
      },
      fontFamily: {
        sans: ['"Bricolage Grotesque"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
      borderRadius: {
        card: '18px',
      },
      maxWidth: {
        page: '1240px',
      },
    },
  },
  plugins: [],
}
