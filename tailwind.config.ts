/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/frontend/**/*.{ts,tsx}'],
  // El tema vive en data-theme="dark"|"light" (App lo setea en <html>)
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#f59e0b',
          hover: '#d97706',
        },
      },
    },
  },
  plugins: [],
};
