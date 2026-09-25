import { heroui } from '@heroui/react';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/react/node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        cosmic: {
          900: '#070913',
          800: '#0d1124',
          700: '#161c38',
          600: '#232b52',
          cyan: '#00f2fe',
          violet: '#7928ca',
          pink: '#ff0080',
          emerald: '#10b981'
        }
      }
    },
  },
  darkMode: "class",
  plugins: [heroui()],
};
