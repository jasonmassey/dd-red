/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: '#0a0a0a', raised: '#141414', border: '#2a2a2a' },
        accent: { DEFAULT: '#dc2626', light: '#ef4444', dim: '#991b1b' },
        text: { DEFAULT: '#e5e5e5', muted: '#737373' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
