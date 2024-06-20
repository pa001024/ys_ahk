import { build as viteBuild } from "vite"
import vue from "@vitejs/plugin-vue"

export async function build(isProduction: boolean) {
    await viteBuild({
        root: "./browser_src",
        mode: isProduction ? "production" : "development",
        clearScreen: false,

        build: {
            emptyOutDir: true,
            outDir: "../dist",
        },
        plugins: [vue()],
    })
}

if (import.meta.main == true) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    build(true)
}
