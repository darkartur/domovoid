import { defineConfig } from "eslint/config";
import type { Linter } from "eslint";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";
import n from "eslint-plugin-n";
import { flatConfigs as importXFlatConfigs } from "eslint-plugin-import-x";

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
    // importXFlatConfigs.typescript is typed as PluginFlatConfig whose languageOptions
    // is @typescript-eslint/utils FlatConfig.LanguageOptions — a concrete interface without
    // an index signature. defineConfig expects @eslint/core LanguageOptions = Record<string, unknown>.
    // The cast is safe: the runtime value has no languageOptions at all (only settings/rules/plugins).
    extends: [importXFlatConfigs.typescript as Linter.Config],
  },
);
