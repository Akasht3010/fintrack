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
      // Semantic design tokens — values live in
      // src/constants/global.css as RGB channels per color scheme, so one
      // class (e.g. `bg-card`) is correct in both light and dark mode
      // without a `dark:` twin. The numbered primary/accent shades are kept
      // for screens that haven't moved to the tokens yet.
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)"
        },
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
          // Legacy numbered shades, kept only so any stray old class can't
          // reintroduce color: they map onto the neutral scale.
          50:  "#fafafa",
          100: "#f5f5f5",
          400: "#a3a3a3",
          500: "#737373",
          600: "#171717",
          900: "#0a0a0a"
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)"
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)"
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
          100: "#f5f5f5",
          400: "#d4d4d4",
          500: "#a3a3a3",
          600: "#404040",
          700: "#262626",
          900: "#171717"
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)"
        },
        positive: "rgb(var(--positive) / <alpha-value>)",
        negative: "rgb(var(--negative) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        surface: "#ffffff"
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
