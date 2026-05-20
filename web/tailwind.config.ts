import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        embrapa: {
          green: '#00A859',
          'green-dark': '#007A3F',
          'green-light': '#D9F2E5',
          blue: '#003B71',
          'blue-dark': '#002A55',
          'blue-light': '#E5EEF7',
          gray: '#F4F6F8',
          ink: '#1A1F2B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 4px 24px -8px rgba(0, 59, 113, 0.12)',
        ring: '0 0 0 4px rgba(0, 168, 89, 0.15)',
      },
    },
  },
  plugins: [],
};

export default config;
