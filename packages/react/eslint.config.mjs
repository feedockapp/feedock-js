// @ts-check
import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/** Flat ESLint config for the @feedock/react SDK package. */
export default tseslint.config(
  { ignores: ["dist/**", ".turbo/**", "node_modules/**", "eslint.config.mjs"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Shared style enforcement (repo-wide): braces on every control-statement
    // body, and a blank line between functions + class methods (never padded
    // bodies). Prettier owns everything else.
    plugins: { "@stylistic": stylistic },
    rules: {
      curly: ["error", "all"],
      "@stylistic/lines-between-class-members": [
        "error",
        "always",
        { exceptAfterSingleLine: true },
      ],
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "function", next: "*" },
        { blankLine: "always", prev: "*", next: "function" },
      ],
    },
  },
  {
    // The hooks rules for the SDK. Registered by hand rather than via the
    // plugin's `recommended` preset: on v7 that preset also turns on the React
    // Compiler rule set, which is a much bigger conversation than these two.
    //
    // "warn", not "error", as a ratchet across the in-flight restructure: the
    // rules should surface problems without hard-failing `lint` mid-rewrite.
    // Note the baseline is already clean (0 warnings as of adding this), so
    // once the restructure settles, promote both to "error" to lock that in.
    //
    // Scope, so nobody over-trusts this gate: these grade dep-array
    // completeness and hook call ordering. They do NOT flag an effect that is
    // unnecessary. The prop->state-sync and notify-the-parent effects (and
    // their ref sentinels) are dep-complete and therefore invisible here —
    // reviewing those stays a human job.
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
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
