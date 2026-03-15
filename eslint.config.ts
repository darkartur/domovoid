import { defineConfig } from "eslint/config";
import type { Linter } from "eslint";
import eslint from "@eslint/js";
import { configs as tseslintConfigs } from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";
import n from "eslint-plugin-n";
import { flatConfigs as importXFlatConfigs } from "eslint-plugin-import-x";
import playwright from "eslint-plugin-playwright";

export default defineConfig(
  { ignores: ["**/node_modules/**", "coverage/**", "**/dist/**"] },
  eslint.configs.recommended,
  unicorn.configs.recommended,
  n.configs["flat/recommended"],
  {
    files: ["**/*.ts"],
    extends: [
      ...tseslintConfigs.strictTypeChecked,
      ...tseslintConfigs.stylisticTypeChecked,
      importXFlatConfigs.recommended,
      importXFlatConfigs.typescript as Linter.Config,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["tests/**"],
    extends: [playwright.configs["flat/recommended"]],
  },
);
