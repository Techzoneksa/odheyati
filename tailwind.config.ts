import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Odheyati brand palette: green #14351e, cream #f4e4bd, gold #d5b474,
      // copper #a86633, brick #8d381e, leaf #5ca977 (logo cream #f9f1e1).
      colors: {
        primary: {
          DEFAULT: '#14351E',
          dark: '#0C2213',
          light: '#24502F',
        },
        secondary: {
          DEFAULT: '#A86633',
          dark: '#8D5529',
          light: '#BF7D48',
        },
        neutral: {
          DEFAULT: '#8D381E',
          dark: '#722C17',
          light: '#A54A2C',
        },
        gold: {
          DEFAULT: '#D5B474',
          dark: '#C29D58',
          light: '#E2C995',
        },
        leaf: '#5CA977',
        background: {
          cream: '#F9F1E1',
          beige: '#F4E4BD',
          white: '#FFFFFF',
        },
        text: {
          primary: '#1B2A1F',
          secondary: '#7A6A52',
          title: '#14351E',
        },
        border: {
          DEFAULT: '#E7D9B8',
          light: '#F1E8D2',
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