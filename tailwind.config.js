/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      animation: {
        "highlight-pulse-high": "highlight-pulse-high 1.6s ease-in-out infinite",
        "highlight-pulse-medium": "highlight-pulse-medium 1.6s ease-in-out infinite",
        "highlight-pulse-low": "highlight-pulse-low 1.6s ease-in-out infinite",
      },
      keyframes: {
        "highlight-pulse-high": {
          "0%, 100%": {
            boxShadow: "0 0 8px 2px rgba(239, 68, 68, 0.6)",
            opacity: "0.85",
          },
          "50%": {
            boxShadow: "0 0 16px 4px rgba(239, 68, 68, 0.3)",
            opacity: "1",
          },
        },
        "highlight-pulse-medium": {
          "0%, 100%": {
            boxShadow: "0 0 8px 2px rgba(245, 158, 11, 0.6)",
            opacity: "0.85",
          },
          "50%": {
            boxShadow: "0 0 16px 4px rgba(245, 158, 11, 0.3)",
            opacity: "1",
          },
        },
        "highlight-pulse-low": {
          "0%, 100%": {
            boxShadow: "0 0 8px 2px rgba(100, 116, 139, 0.6)",
            opacity: "0.85",
          },
          "50%": {
            boxShadow: "0 0 16px 4px rgba(100, 116, 139, 0.3)",
            opacity: "1",
          },
        },
      },
    },
  },
  plugins: [],
};
