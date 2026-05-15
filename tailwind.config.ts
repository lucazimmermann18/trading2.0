import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        ink: {
          950: "#070a12",
          900: "#0a0e1a",
          850: "#0d1117",
          800: "#12181f",
          750: "#171e28",
          700: "#1d2531",
        },
        accent: {
          blue:   "#00d4ff",
          green:  "#00ff88",
          red:    "#ff3d5a",
          amber:  "#ffb800",
          violet: "#a78bfa",
        },
        mute: "#5a6779",
      },
      keyframes: {
        pulseDot:   { "0%,100%": { opacity: "0.55", transform: "scale(1)" }, "50%": { opacity: "1", transform: "scale(1.25)" } },
        tradePulse: { "0%,100%": { boxShadow: "0 0 0 0 rgba(0,255,136,0.55), inset 0 0 0 1px rgba(0,255,136,0.6)" }, "50%": { boxShadow: "0 0 0 6px rgba(0,255,136,0), inset 0 0 0 1px rgba(0,255,136,0.9)" } },
        riseIn:     { "0%": { transform: "translateY(12px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        slideInRight:{ "0%": { transform: "translateX(120%)", opacity: "0" }, "100%": { transform: "translateX(0)", opacity: "1" } },
        glowBorder: { "0%,100%": { boxShadow: "inset 0 0 0 1px rgba(0,212,255,0.35), 0 0 22px rgba(0,212,255,0.12)" }, "50%": { boxShadow: "inset 0 0 0 1px rgba(0,212,255,0.7), 0 0 36px rgba(0,212,255,0.28)" } },
        shimmer:    { "0%": { backgroundPosition: "200% 0" }, "100%": { backgroundPosition: "-200% 0" } },
        shrink:     { "0%": { width: "100%" }, "100%": { width: "0%" } },
      },
      animation: {
        pulseDot:    "pulseDot 1.6s ease-in-out infinite",
        tradePulse:  "tradePulse 1.8s ease-out infinite",
        riseIn:      "riseIn 0.4s cubic-bezier(.2,.7,.2,1)",
        slideInRight:"slideInRight 0.45s cubic-bezier(.2,.8,.2,1)",
        glowBorder:  "glowBorder 2.6s ease-in-out infinite",
        shimmer:     "shimmer 1.8s linear infinite",
        shrink:      "shrink 6s linear forwards",
      },
    },
  },
  plugins: [],
};
export default config;
