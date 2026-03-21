import path from "path"

import {defineConfig} from "vite"

export default defineConfig(({mode}) => {
    return {
        root: path.resolve(__dirname, "src"),
        base: "./",

        build: {
            outDir: path.resolve(__dirname, "submission"),
            emptyOutDir: true,
            assetsDir: ".",
            assetsInlineLimit: 0,
            minify: false,
            sourcemap: mode !== "production",
            modulePreload: {
                polyfill: false,
            },
            rollupOptions: {
                input: path.resolve(__dirname, "src", "submission.html"),
                output: {
                    entryFileNames: "[name].js",
                    chunkFileNames: "[name]-[hash].js",
                    assetFileNames: "assets/[name][extname]"
                },
            },
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'src')
            }
        },
        optimizeDeps: {
            exclude: [],
        },
    }
})
