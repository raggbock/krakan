import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Forbid `throw new Error(...)` — use appError(code) or HttpError instead.
    // For genuine programming-error guards that should never reach users, add:
    //   // eslint-disable-next-line no-restricted-syntax
    // with a one-line explanation.
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

export default eslintConfig;
