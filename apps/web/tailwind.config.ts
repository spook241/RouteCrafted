import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0058be",
        "primary-container": "#2170e4",
        "on-primary": "#ffffff",
        "primary-fixed": "#d6e4ff",
        secondary: "#575a8c",
        "secondary-container": "#c2c5fe",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#4d5081",
        "on-secondary-fixed": "#131645",
        "tertiary-fixed": "#ffe24c",
        "tertiary-fixed-dim": "#e2c62d",
        "on-tertiary-fixed": "#211b00",
        "on-tertiary-fixed-variant": "#524600",
        surface: "#f9f9ff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f0f3ff",
        "surface-container": "#e7eeff",
        "surface-container-high": "#dee8ff",
        "surface-container-highest": "#d8e3fb",
        "on-surface": "#111c2d",
        "on-surface-variant": "#424754",
        outline: "#727785",
        "outline-variant": "#c2c6d6",
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "inverse-surface": "#263143",
      },
      fontFamily: {
        headline: ["Plus Jakarta Sans", "sans-serif"],
        body: ["Inter", "sans-serif"],
        label: ["Inter", "sans-serif"],
      },
      borderRadius: {
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        card: "0 8px 32px rgba(17,28,45,0.04)",
        "card-hover": "0 12px 40px rgba(17,28,45,0.08)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.35s ease-out both",
      },
    },
  },
  plugins: [
    // scrollbar-hide utility
    function ({ addUtilities }: { addUtilities: (u: Record<string, Record<string, string>>) => void }) {
      addUtilities({
        ".scrollbar-hide": {
          "-ms-overflow-style": "none",
          "scrollbar-width": "none",
        },
        ".scrollbar-hide::-webkit-scrollbar": {
          display: "none",
        },
        ".line-clamp-2": {
          overflow: "hidden",
          display: "-webkit-box",
          "-webkit-box-orient": "vertical",
          "-webkit-line-clamp": "2",
        },
      });
    },
  ],
};

export default config;
