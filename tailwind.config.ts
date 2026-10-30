import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effaf5', 100: '#d6f3e6', 200: '#aee6cf', 300: '#7dd3b0', 400: '#46b98c',
          500: '#1f9a6e', 600: '#0f7d58', 700: '#0b6347', 800: '#094e39', 900: '#073d2d', 950: '#03241a',
        },
        paper: '#faf7f2',      // warm off-white page
        ink: '#1f2724',        // dark charcoal text
        amber: { 50: '#fff8e6', 100: '#feefc3', 500: '#e8a317', 600: '#c98700', 700: '#a16a00' },
        danger: { 50: '#fdeeee', 100: '#fbd9d9', 500: '#d9534f', 600: '#c0392f', 700: '#9d2c25' },
      },
      fontFamily: {
        sans: ['"Inter Variable"', '"Noto Sans Tamil Variable"', 'system-ui', 'sans-serif'],
        tamil: ['"Noto Sans Tamil Variable"', '"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(11,99,71,.05), 0 8px 24px -8px rgba(11,99,71,.12)',
        lift: '0 2px 4px rgba(11,99,71,.06), 0 16px 40px -12px rgba(11,99,71,.22)',
      },
      borderRadius: { '4xl': '2rem' },
      keyframes: {
        floaty: { '0%,100%': { transform: 'translateY(0) rotate(var(--r,0deg))' }, '50%': { transform: 'translateY(-10px) rotate(var(--r,0deg))' } },
        swing: { '0%,100%': { transform: 'rotateY(-14deg) rotateX(6deg)' }, '50%': { transform: 'rotateY(14deg) rotateX(2deg)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: '0' }, '60%': { transform: 'scale(1.1)', opacity: '1' }, '100%': { transform: 'scale(1)' } },
        draw: { to: { strokeDashoffset: '0' } },
      },
      animation: {
        floaty: 'floaty 5s ease-in-out infinite',
        swing: 'swing 7s ease-in-out infinite',
        shimmer: 'shimmer 1.4s infinite',
        pop: 'pop .45s cubic-bezier(.2,.9,.3,1.2) both',
        draw: 'draw .5s .15s ease-out forwards',
      },
    },
  },
  plugins: [],
};
export default config;
