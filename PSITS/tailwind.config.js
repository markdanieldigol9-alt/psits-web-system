/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0047AB', // Deep vibrant blue
          dark: '#002E73',
          light: '#3378FF',
          50: '#E6F0FF',
        },
        secondary: {
          DEFAULT: '#FFB800', // Premium gold/yellow
          dark: '#CC9300',
        },
        accent: '#FF4757', // Coral red for highlights
        success: '#2ED573',
        warning: '#FFA502',
        error: '#FF4757',
        info: '#1E90FF',
        light: '#F8F9FA',
        dark: '#2F3542',
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
