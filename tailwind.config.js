/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      focusRing: {
        DEFAULT: 'ring-2 ring-indigo-500/50',
        tv: 'ring-4 ring-indigo-500/50 ring-offset-2 ring-offset-slate-950',
      },
      touchTarget: {
        min: 'h-12 min-h-[48px]',
      },
    },
  },
  plugins: [],
}
