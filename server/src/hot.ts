import * as bun from "bun"
import { watch, readFileSync, writeFileSync } from "fs"
import { filter, fromEventPattern, map, throttleTime } from "rxjs"
import type { WsServer } from "./ws"

export function hot(io: WsServer) {
    // dev hot loader
    fromEventPattern(
        (handler) => watch("./public", { recursive: true }, handler),
        void 0,
        (ev: string, filename: string) => ({ ev, filename })
    )
        .pipe(
            filter(({ ev, filename }) => ev === "change" && !!filename),
            map(({ filename }) => filename.replace(/\\/g, "/")),
            throttleTime(10)
        )
        .subscribe((path) => {
            // console.log("File changed:", path)
            if (path.endsWith(".html")) {
                console.log(`🔥 Refresh html`)
                io.emit("reload")
            } else if (path.endsWith(".css")) {
                console.log(`🔥 HMR reload css: ${path}`)
                io.emit("reload_css", path)
            } else if (path.endsWith(".js")) {
                const html_file = "./public/index.html"
                const html = readFileSync(html_file, "utf-8")
                const reg = new RegExp(`/${path.replace(".", "\\.")}\\?v=(\\d+)`)
                const match = html.match(reg)
                if (match) {
                    console.log(`🔥 HMR reload js ${path}`)
                    const [, v] = match
                    writeFileSync(html_file, html.replace(reg, `/${path}?v=${Date.now()}`))
                    io.emit("reload")
                }
            }
        })

    // dev hot builder
    fromEventPattern(
        (handler) => watch("./browser_src", { recursive: true }, handler),
        void 0,
        (ev: string, filename: string) => ({ ev, filename })
    )
        .pipe(
            filter(({ ev, filename }) => ev === "change" && (filename.endsWith(".ts") || filename.endsWith(".js"))),
            map(({ filename }) => filename.replace(/\\/g, "/")),
            throttleTime(10)
        )
        .subscribe((path) => {
            console.log("🦊 Building", path)
            bun.build({
                entrypoints: [`./browser_src/${path}`],
                outdir: "./public/js",
            })
        })
}
