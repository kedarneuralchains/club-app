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
        navy: {
          DEFAULT: '#004165',
          50:  '#e6f0f6',
          100: '#cce1ed',
          200: '#99c3db',
          300: '#66a5c9',
          400: '#3387b7',
          500: '#006094',
          600: '#004165',
          700: '#003451',
          800: '#00273d',
          900: '#001a29',
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
        yellow: {
          DEFAULT: '#F2DF74',
          100: '#fdf9e3',
          200: '#F2DF74',
          300: '#edcf3d',
        },
      },
      fontFamily: {
        serif: ['var(--font-montserrat)', 'system-ui', 'sans-serif'],
        sans:  ['var(--font-source-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
