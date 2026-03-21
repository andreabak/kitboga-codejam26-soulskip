/** @type {import('eslint').Linter.Config[]} */
import {fileURLToPath} from "node:url"
import {includeIgnoreFile} from "@eslint/compat"
import js from "@eslint/js"
import prettier from "eslint-config-prettier"
import globals from "globals"
import ts from "typescript-eslint"
import unusedImports from "eslint-plugin-unused-imports"

const gitignorePath = fileURLToPath(new URL("./.gitignore", import.meta.url))

export default [
    includeIgnoreFile(gitignorePath),
    js.configs.recommended,
    ...ts.configs.recommended,
    prettier,
    {
        languageOptions: {
            globals: {...globals.browser, ...globals.node},
        },
        plugins: {
            "unused-imports": unusedImports,
        },
        rules: {
            // typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
            // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
            "no-undef": "off",

            // Stricter defaults - keeping these enabled for strictness
            // "@typescript-eslint/no-explicit-any": "off",
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "unused-imports/no-unused-imports": "error",
            "unused-imports/no-unused-vars": [
                "warn",
                {
                    "vars": "all",
                    "varsIgnorePattern": "^_",
                    "args": "after-used",
                    "argsIgnorePattern": "^_",
                },
            ],
            "no-useless-escape": "warn",
        },
    },
]
