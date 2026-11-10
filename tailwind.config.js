/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
          accent: '#66c0f4',
        }
      },
      fontFamily: {
        standupp: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
