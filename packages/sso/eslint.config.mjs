// @ts-check
import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import tseslint from "typescript-eslint";

/** Flat ESLint config for the @feedock/sso package. */
export default tseslint.config(
  { ignores: ["dist/**", ".turbo/**", "node_modules/**", "eslint.config.mjs"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Shared style enforcement (repo-wide): braces on every control-statement
    // body, and a blank line between functions. Prettier owns everything else.
    plugins: { "@stylistic": stylistic },
    rules: {
      curly: ["error", "all"],
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "function", next: "*" },
        { blankLine: "always", prev: "*", next: "function" },
      ],
    },
  },
  {
    // Pin the parser's root to this package so the editor's typescript-eslint
    // doesn't error on the monorepo's multiple candidate tsconfig roots.
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
);
