/** @type {import('prettier').Config} */
const config = {
    plugins: [require("@ianvs/prettier-plugin-sort-imports")],
    bracketSpacing: false,
    bracketSameLine: false,
    singleAttributePerLine: false,
    printWidth: 120,
    proseWrap: "always",
    semi: false,
    tabWidth: 4,
    importOrder: [
        "<BUILTIN_MODULES>",
        "",
        "<THIRD_PARTY_MODULES>",
        "^@/.*\\.$css$",
        "[.]css$",
        "",
        "^@/(?!assets)(?!.*[.](?:css)$).*$",
        "^@/(?!assets).*[.]css$",
        "",
        "^(?!.*[.](?:css)$)[./].*$",
        "^[./].*[.]css$",
        "",
        "^@/assets(?!.*[.](?:css)$).*$",
        "^@/assets.*[.]css$",
    ],
}

module.exports = config;
