import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#973131',
          dark: '#7A2828',
          light: '#B54545',
        },
        secondary: {
          DEFAULT: '#DCA47C',
          dark: '#C9915F',
          light: '#E6BE94',
        },
        neutral: {
          DEFAULT: '#917E69',
          dark: '#7A6B5A',
          light: '#A6927D',
        },
        background: {
          cream: '#FFF8F1',
          beige: '#F7E8DC',
          white: '#FFFFFF',
        },
        text: {
          primary: '#3A2A24',
          secondary: '#917E69',
          title: '#973131',
        },
        border: {
          DEFAULT: '#E8D3C4',
          light: '#F0E4D8',
        },
      },
      fontFamily: {
        sans: ['Tahoma', 'Arial', 'sans-serif'],
      },
      direction: 'rtl',
    },
  },
  plugins: [],
};

export default config;