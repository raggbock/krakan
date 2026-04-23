import { defineConfig } from "eslint/config";

/**
 * Minimal ESLint config for @fyndstigen/shared.
 *
 * Single rule: forbid `throw new Error(...)`.
 * Domain and adapter code must throw appError(code) instead.
 * Genuine programming-error guards may suppress with:
 *   // eslint-disable-next-line no-restricted-syntax -- <reason>
 */
const sharedConfig = defineConfig([
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ThrowStatement > NewExpression[callee.name='Error']",
          message:
            "Throw appError(code) instead of new Error(). For unreachable guards, add eslint-disable-next-line with a reason.",
        },
      ],
    },
  },
]);

export default sharedConfig;
