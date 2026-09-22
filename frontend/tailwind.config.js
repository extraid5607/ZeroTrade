/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bull: {
          DEFAULT: "#10B981",
          light: "#34D399",
          muted: "rgba(16, 185, 129, 0.15)",
        },
        bear: {
          DEFAULT: "#EF4444",
          light: "#F87171",
          muted: "rgba(239, 68, 68, 0.15)",
        },
        brand: {
          DEFAULT: "#06B6D4", // Electric Cyan
          light: "#22D3EE",
          dark: "#0891B2",
          muted: "rgba(6, 182, 212, 0.15)",
        },
        accent: {
          DEFAULT: "#6366F1", // Indigo
          purple: "#8B5CF6",
        },
        surface: {
          darkBg: "#090D14",
          darkPanel: "#101623",
          darkCard: "#151D2E",
          darkBorder: "#1E293B",
          darkHover: "#1E283D",
          lightBg: "#F8FAFC",
          lightPanel: "#FFFFFF",
          lightCard: "#F1F5F9",
          lightBorder: "#E2E8F0",
          lightHover: "#E2E8F0"
        }
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        mono: ["'JetBrains Mono'", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      }
    },
  },
  plugins: [],
}
