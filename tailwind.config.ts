import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#E8EBF0",
          100: "#C5CCD8",
          200: "#8B99B1",
          300: "#51668A",
          400: "#2B4068",
          500: "#1B2A4A",
          600: "#162240",
          700: "#111A33",
          800: "#0C1226",
          900: "#070A19",
        },
        teal: {
          50: "#E6F7F5",
          100: "#B3EBE5",
          200: "#80DED5",
          300: "#4DD1C5",
          400: "#26C7B8",
          500: "#00B4A6",
          600: "#009E92",
          700: "#00877D",
          800: "#007068",
          900: "#005953",
        },
        accent: {
          50: "#FEF3E2",
          100: "#FDE1B7",
          200: "#FBCE88",
          300: "#F9BA59",
          400: "#F7A736",
          500: "#F7941D",
          600: "#E07D10",
          700: "#C4690A",
          800: "#A85507",
          900: "#8C4204",
        },
      },
    },
  },
  plugins: [],
};
export default config;
