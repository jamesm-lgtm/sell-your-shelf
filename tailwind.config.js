/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#2D4A3E',
          'primary-light': '#3B5249',
          'primary-dark': '#1F3329',
          background: '#FAF8F5',
          surface: '#FFFFFF',
          text: '#1A1A1A',
          'text-secondary': '#666666',
          'text-light': '#999999',
          border: '#E5E3DF',
          'border-light': '#F0EDE8',
        }
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}