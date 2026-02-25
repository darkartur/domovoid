import { defineConfig } from "eslint/config";
import type { Linter } from "eslint";
import eslint from "@eslint/js";
import { configs as tseslintConfigs } from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";
import n from "eslint-plugin-n";
import { flatConfigs as importXFlatConfigs } from "eslint-plugin-import-x";
import playwright from "eslint-plugin-playwright";

export default defineConfig(
  { ignores: ["**/node_modules/**"] },
  eslint.configs.recommended,
  unicorn.configs.recommended,
  n.configs["flat/recommended"],
  {
    files: ["**/*.ts", "**/*.js"],
    extends: [
      ...tseslintConfigs.strictTypeChecked,
      ...tseslintConfigs.stylisticTypeChecked,
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
    files: ["**/*.ts"],
    // importXFlatConfigs.typescript is typed as PluginFlatConfig whose languageOptions
    // is @typescript-eslint/utils FlatConfig.LanguageOptions — a concrete interface without
    // an index signature. defineConfig expects @eslint/core LanguageOptions = Record<string, unknown>.
    // The cast is safe: the runtime value has no languageOptions at all (only settings/rules/plugins).
    extends: [importXFlatConfigs.typescript as Linter.Config],
  },
  {
    files: ["tests/**"],
    extends: [playwright.configs["flat/recommended"]],
    rules: {
      "playwright/no-skipped-test": "error",
    },
  },
);
