import type { Config } from "tailwindcss";

export default {
  content: [
    "./app.vue",
    "./components/**/*.vue",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
  ],
  theme: {
    extend: {
      colors: {
        krom: { 700: "#047857" },
      },
    },
  },
} satisfies Config;
