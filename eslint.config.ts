import { defineConfig } from "eslint/config";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";
import n from "eslint-plugin-n";
import { createNodeResolver, flatConfigs as importXFlatConfigs } from "eslint-plugin-import-x";

export default defineConfig(
  { ignores: ["**/node_modules/**"] },
  eslint.configs.recommended,
  unicorn.configs.recommended,
  n.configs["flat/recommended"],
  {
    files: ["**/*.ts", "**/*.js"],
    extends: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      importXFlatConfigs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["packages/**/*.ts"],
    settings: {
      "import-x/extensions": [".ts", ".tsx", ".cts", ".mts", ".js", ".jsx", ".cjs", ".mjs"],
      "import-x/external-module-folders": ["node_modules", "node_modules/@types"],
      "import-x/parsers": { "@typescript-eslint/parser": [".ts", ".tsx", ".cts", ".mts"] },
      "import-x/resolver-next": [
        createNodeResolver({
          extensionAlias: {
            ".js": [".ts", ".js"],
            ".jsx": [".tsx", ".jsx"],
            ".mjs": [".mts", ".mjs"],
            ".cjs": [".cts", ".cjs"],
          },
          tsconfig: { configFile: "tsconfig.json" },
        }),
      ],
    },
    rules: {
      "import-x/named": "off",
    },
  },
);
