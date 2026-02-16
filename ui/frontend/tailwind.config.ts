import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fire: {
          amber: "#FF8C00",
          orange: "#FF4500",
          gold: "#FFBF00",
          ember: "#CC3700",
          white: "#FFF5E0",
        },
        surface: {
          DEFAULT: "#262626",
          dark: "#1a1a1a",
          darker: "#111111",
          hover: "#333333",
          light: "#3a3a3a",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
