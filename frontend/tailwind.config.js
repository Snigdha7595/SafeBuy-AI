/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      colors: {
        paper: "#FAF8F4",
        ink: { DEFAULT: "#0F1F3D", soft: "#4A5875", faint: "#7A869E" },
        line: "#E6E2D9",
        brand: { DEFAULT: "#0E8F6E", dark: "#0A7358", tint: "#E6F5EF" },
        caution: { DEFAULT: "#B7791F", tint: "#FBF1DC" },
        danger: { DEFAULT: "#C0392B", tint: "#FBE9E7" },
      },
      boxShadow: { soft: "0 1px 2px rgba(15,31,61,.04), 0 4px 16px rgba(15,31,61,.05)" },
    },
  },
  plugins: [],
};
