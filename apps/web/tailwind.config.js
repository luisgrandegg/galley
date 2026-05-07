/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1c1917',
        bone: '#fafaf9',
        line: '#e7e5e4',
      },
    },
  },
  plugins: [],
}
