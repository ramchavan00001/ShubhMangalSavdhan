import type { Config } from 'tailwindcss';

/** Royal Heritage design tokens. */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        maroon: { DEFAULT: '#5B0F1E', deep: '#3E0913', soft: '#7A2333' },
        gold: { DEFAULT: '#C9A24B', dark: '#7A5C17', light: '#F3E3BC' },
        ivory: { DEFAULT: '#FBF6EC', card: '#FFFDF8' },
        sand: { DEFAULT: '#F4EAD8', line: '#E4D5BB', input: '#D6C3A4', photo: '#E9D8BC' },
        ink: { DEFAULT: '#2B1A14', muted: '#6B5A50', soft: '#4A3A31' },
        blush: '#EAD9C9',
        success: { DEFAULT: '#1F5E3A', bg: '#DCEEDF' },
        danger: { DEFAULT: '#9B1C1C', bg: '#FBE4E4' },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        deva: ['var(--font-deva)', 'serif'],
      },
      maxWidth: { page: '1200px' },
    },
  },
  plugins: [],
};

export default config;
