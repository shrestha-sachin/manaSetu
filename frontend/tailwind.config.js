/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'calm-teal': '#4a9b8e',
        'calm-blue': '#5b8ea0',
        'calm-cyan': '#66b3c1',
        'calm-mint': '#6ee7b7',
        'calm-amber': '#fcd34d',
        'calm-coral': '#fca5a5',
      },
    },
  },
  plugins: [],
};
