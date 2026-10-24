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
      // Default Tailwind screens stop at 2xl (1536px) — on an actual large
      // monitor or a browser projected to a TV, the desktop shell (see
      // app/(tabs)/_layout.tsx) would otherwise freeze at its 2xl width and
      // leave a growing dead void on either side instead of continuing to
      // scale.
      screens: {
        "3xl": "1920px"
      },
      colors: {
        primary: {
          50:  "#ecfdf5",
          100: "#d1fae5",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          900: "#064e3b"
        },
        // A softer emerald accent is used on dark surfaces.
        accent: {
          100: "#d1fae5",
          400: "#6ee7b7",
          500: "#34d399",
          600: "#059669",
          700: "#047857",
          900: "#064e3b"
        },
        surface: "#ffffff",
        background: "#f7f9f8",
        border: "#e7ece9",
        muted: "#727b76"
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
