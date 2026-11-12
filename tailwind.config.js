/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        indigo: {
          50: '#f5f0ff',
          100: '#ebe0ff',
          200: '#d7c2ff',
          300: '#bb94ff',
          400: '#a36eff',
          500: '#8B51FF',
          600: '#773BF5',
          700: '#6429DA',
          800: '#5322B5',
          900: '#451E93',
          950: '#2A0F63',
        },
        standupp: {
          darkest: '#101214',
          header: '#181b1f',
          sidebar: '#1f2329',
          chat: '#181b1e',
          channel: '#262a31',
          input: '#121416',
          border: '#2e333a',
          hover: '#2a2f38',
          textMuted: '#8b949e',
          textLight: '#c6d4df',
          inGame: '#90ba3c',
          online: '#57cbde',
          greenBtn: '#54a320',
          greenActive: '#3d9921',
          accent: '#8B51FF',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        standupp: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
