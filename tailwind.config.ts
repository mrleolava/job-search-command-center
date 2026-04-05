import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        claude: {
          bg: '#F5F0E8',
          accent: '#D4763C',
          'accent-hover': '#C06830',
          'accent-light': '#F0DFD1',
          primary: '#2D2D2A',
          secondary: '#6B6560',
          tertiary: '#9C9690',
          border: '#E5DFD5',
          hover: '#EDE7DD',
          card: '#FFFFFF',
        },
      },
    },
  },
  plugins: [],
};
export default config;
