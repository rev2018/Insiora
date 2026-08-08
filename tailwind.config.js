/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F6F6F3",
        panel: "#FFFFFF",
        ink: "#14161A",
        muted: "#63666E",
        line: "#E2E2DC",
        signal: {
          DEFAULT: "#28623F",
          soft: "#E7F0EA",
        },
        alert: {
          DEFAULT: "#AE4A24",
          soft: "#F5E7DF",
        },
        flag: {
          DEFAULT: "#8A6D00",
          soft: "#F6EFD9",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        sm: "3px",
      },
    },
  },
  plugins: [],
}
