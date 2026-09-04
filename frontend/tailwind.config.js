/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: { 0: "#03070f", 1: "#060d1a", 2: "#0a152a", 3: "#0f2040" },
        panel: "#0b1426",
        line: "#142847",
        cyan: "#00e5ff",
        violet: "#7c5cff",
      },
      fontFamily: { mono: ["JetBrains Mono", "monospace"] },
    },
  },
  plugins: [],
}

