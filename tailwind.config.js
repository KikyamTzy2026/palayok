/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        bronze: {
          400: '#cd7f32',
          500: '#b87333',
          600: '#a05a2c',
          700: '#8b4513',
        },
        fiesta: {
          red: '#9b1b1b',
          dark: '#1a0a0a',
          orange: '#e85d04',
        }
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-glow': 'pulse-glow 1.5s ease-in-out infinite',
        'bounce-soft': 'bounce-soft 0.6s ease-in-out',
        'shake': 'shake 0.5s ease-in-out',
        'explode': 'explode 1.2s ease-out forwards',
        'float': 'float 3s ease-in-out infinite',
        'reel-spin': 'reel-spin 0.1s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(251, 191, 36, 0.6)' },
          '50%': { boxShadow: '0 0 40px rgba(251, 191, 36, 1), 0 0 60px rgba(251, 191, 36, 0.8)' },
        },
        'bounce-soft': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        },
        'explode': {
          '0%': { transform: 'scale(0.5)', opacity: '1' },
          '50%': { transform: 'scale(1.5)', opacity: '1' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'reel-spin': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-100%)' },
        }
      }
    },
  },
  plugins: [],
}
