/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#137fec',
        'primary-dark': '#0f6ac6',
        'background-light': '#f6f7f8',
        'background-dark': '#101922',
        'surface-dark': '#1c242f',
        'surface-light': '#ffffff',
        'card-dark': '#181b21',
        'border-dark': '#283039',
        'text-secondary': '#9dabb9',
        success: '#0bda5b',
        danger: '#ef4444',
        'trade-green': '#0bda5b',
        'trade-red': '#ff4d4d',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
    },
  },
  plugins: [],
}
