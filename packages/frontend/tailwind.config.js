/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'dao-purple': '#6B46C1',
        'dao-gold': '#F59E0B',
        'dao-dark': '#0F172A',
      },
    },
  },
  plugins: [],
}
