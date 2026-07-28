import type { Config } from "tailwindcss";

/**
 * Colours are literal hex here on purpose. Pointing a Tailwind colour at a
 * `var(--x)` silently breaks every opacity modifier — `bg-accent/45` compiles
 * to nothing, because Tailwind cannot do alpha maths on an opaque custom
 * property. The same values live as CSS variables in `app/globals.css` (for
 * raw CSS such as gradients) and in `components/charts/theme.ts` (for Recharts,
 * which needs concrete SVG attribute values). Keep the three in sync.
 */
const palette = {
  page: "#1b2a6c",
  surface: {
    1: "#25377f",
    2: "#2c4090",
    3: "#35499e",
  },
  ink: {
    1: "#ffffff",
    2: "#d5ddf8",
    3: "#a8b4e4",
  },
  brand: {
    royal: "#3a55b4",
    navy: "#1d2c6e",
    yellow: "#ffd84d",
  },
  accent: "#ffd84d",
  chrome: "#16255f",
  grid: "#3b4e9e",
  axis: "#46599f",
  good: "#7ce8a6",
  bad: "#ff9090",
  // Validated categorical slots — assign in order, never cycle.
  s1: "#d6aa35",
  s2: "#43cbba",
  s3: "#a99bf7",
  s4: "#5fc97d",
  s5: "#7fb4f5",
  s6: "#f58bb0",
};

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: palette,
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        script: ["var(--font-script)", "cursive"],
      },
      borderRadius: {
        card: "20px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.05) inset, 0 18px 40px -24px rgba(0,0,0,0.9)",
        float: "0 20px 50px -20px rgba(0,0,0,0.85)",
        glow: "0 0 0 1px rgba(255,216,77,0.35), 0 18px 44px -18px rgba(255,216,77,0.45)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "fade-up": "fade-up .5s cubic-bezier(.22,.8,.3,1) both",
        marquee: "marquee 56s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
