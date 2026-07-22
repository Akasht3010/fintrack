/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  // NativeWind's web target needs "class" (not the default "media") to allow
  // manually overriding the theme via colorScheme.set() — "media" can only
  // follow the OS/browser's prefers-color-scheme. Native is unaffected by
  // this setting; it uses a different mechanism (Appearance.setColorScheme).
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          900: "#14532d"
        },
        // Dark-mode-only accent (indigo/violet), used for the "liquid glass"
        // look — light mode keeps `primary` (green) untouched.
        accent: {
          100: "#e0e7ff",
          400: "#a5b4fc",
          500: "#818cf8",
          600: "#6366f1",
          700: "#4f46e5",
          900: "#312e81"
        },
        surface: "#ffffff",
        background: "#f9fafb",
        border: "#e5e7eb",
        muted: "#6b7280"
      },
      fontFamily: {
        sans: ["Inter_400Regular"],
        medium: ["Inter_500Medium"],
        semibold: ["Inter_600SemiBold"],
        bold: ["Inter_700Bold"]
      }
    },
  },
  plugins: [],
};
