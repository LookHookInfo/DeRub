import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      colors: {
        'aave-light-blue': '#3B82F6', // Darker, muted blue
        'aave-purple': '#7C3AED', // Darker, muted purple
        'aave-green': '#10B981', // Darker, muted green
        'aave-red': '#EF4444', // Darker, muted red
        'velvet-yellow': '#DAA520', // Velvety yellow
      },
    },
  },
  plugins: [],
};
export default config;
