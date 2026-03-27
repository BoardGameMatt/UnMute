import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "unmute-navy": "#1B3A5C",
        "deep-navy": "#0F2440",
        "steel-blue": "#4A6080",
        "signal-amber": "#F5A623",
        "sunrise-gold": "#FFCC33",
        "warm-white": "#FAF8F5",
        slate: "#6B7B8D",
        charcoal: "#2D3436",
        "cloud-grey": "#E8ECEF",
        "signal-red": "#E85D4A",
      },
      fontFamily: {
        display: ["var(--font-outfit)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-dm-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
