/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1B2430",
        "ink-light": "#2A3648",
        paper: "#F6F3EC",
        "paper-dim": "#EDE8DC",
        oxblood: "#8C3B2E",
        "oxblood-light": "#B5584A",
        sage: "#4C6B5E",
        line: "#D8D2C4",
      },
      fontFamily: {
        display: ["'Source Serif 4'", "serif"],
        body: ["'IBM Plex Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
