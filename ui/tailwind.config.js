// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{html,js,svelte,ts}', // Scan your SvelteKit files
  ],
  theme: {
    extend: {},
  },
  // OPTIONAL: DaisyUI theme configuration
  // daisyui: {
  //   themes: ["light", "dark", "cupcake", "emerald"], // An array of themes to include
  //   darkTheme: "dark", // The theme to use when dark mode is enabled
  //   base: true, // Applies base colors for background and text
  //   styled: true, // Applies DaisyUI components' styles
  //   utils: true, // Adds utility classes for components
  //   prefix: "", // DaisyUI prefix (e.g., "daisy-btn")
  //   logs: true, // Shows DaisyUI logs in console
  //   themeRoot: ":root", // The element where themes are applied (defaults to :root)
  // },
};
