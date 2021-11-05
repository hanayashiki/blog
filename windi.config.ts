import { defineConfig } from 'windicss/helpers'

export default defineConfig({
  extract: {
    include: [
      "./src/pages/**/*.{js,ts,jsx,tsx}",
      "./src/components/**/*.{js,ts,jsx,tsx}",
    ],
  },
  theme: {
    extend: {
      colors: {
        primary: '#ddbfe4',
      }
    },
  },
});