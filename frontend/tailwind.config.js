/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      // Palette CESIZen — Bleu/Vert Canard institutionnel
      // Ces valeurs reflètent celles définies dans @theme de index.css.
      // Pour personnaliser, modifier aussi --color-cesizen-500 dans index.css.
      colors: {
        cesizen: {
          50:  '#f0f9fb',
          100: '#d8f1f5',
          200: '#b0e3eb',
          300: '#78cedb',
          400: '#3eb4c4',
          500: '#1b7a8a',
          600: '#156673',
          700: '#0f4f5a',
          800: '#0a3b44',
          900: '#062d34',
          950: '#031a1f',
        },
      },
    },
  },
  plugins: [],
}
