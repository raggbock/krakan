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
    // Forbid `from '@/lib/supabase'` in hooks — read state through useDeps()
    // instead. The supabase client is wired into api / Deps factories via
    // providers/query-provider; hooks that bypass that defeat the layering.
    files: ["src/hooks/**/*.ts", "src/hooks/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{
            name: "@/lib/supabase",
            message: "Don't import the supabase client in hooks. Use useDeps() (RFC #36) — add a port method if a new query shape is needed.",
          }],
        },
      ],
    },
  },
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
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='invoke'][callee.object.type='MemberExpression'][callee.object.property.name='functions']",
          message:
            "Don't call supabase.functions.invoke() directly. Use api.endpoints['<key>'].invoke(input) (RFC #39). The only allowed exception is the wrapper in web/src/lib/invoke.ts.",
        },
      ],
    },
  },
]);

export default eslintConfig;
