import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    // Bundled image metadata is data rather than hand-written code.
    ignores: ["constants/images.ts"],
    rules: {
      "max-lines": ["error", { max: 1000 }],
    },
  },
];

export default config;
