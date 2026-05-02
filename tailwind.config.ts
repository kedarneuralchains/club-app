import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        maroon: {
          DEFAULT: '#772432',
          50:  '#fdf2f3',
          100: '#fbe8ea',
          200: '#f5c9cd',
          300: '#eca0a7',
          400: '#e06d78',
          500: '#cf4252',
          600: '#b52d3d',
          700: '#772432',
          800: '#6b202d',
          900: '#5c1e29',
        },
        cream: {
          DEFAULT: '#F5EDD9',
          50:  '#fefcf7',
          100: '#fdf7ec',
          200: '#F5EDD9',
          300: '#eadbb8',
          400: '#dcc490',
          500: '#ceac69',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        sans:  ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
