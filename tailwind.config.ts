import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#fff8f0",
        "on-background": "#1f1b13",
        "on-background-variant": "#5a5550",
        surface: "#121413",
        "surface-lowest": "#0d0f0e",
        "surface-low": "#1a1c1b",
        "surface-container": "#1e201f",
        "surface-high": "#282a29",
        "surface-highest": "#333534",
        "on-surface": "#e2e3e0",
        "on-surface-variant": "#c0c8c3",
        outline: "#8a938d",
        "outline-variant": "#414944",
        "outline-light": "#d6cfc4",
        primary: "#a0d1bc",
        "on-primary": "#043829",
        "primary-container": "#0b3d2e",
        "primary-dark": "#0b3d2e",
        secondary: "#ebc246",
        "on-secondary": "#3d2f00",
        "secondary-container": "#b08c09",
        error: "#ffb4ab",
      },
      fontFamily: {
        display: ['"Anybody"', "system-ui", "sans-serif"],
        body: ['"Hanken Grotesk"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        glass: "0 4px 6px -1px rgba(0,0,0,0.2), 0 2px 4px -1px rgba(0,0,0,0.1)",
        floating: "0 8px 32px rgba(0,0,0,0.4)",
        glow: "0 10px 30px -10px rgba(235,194,70,0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
