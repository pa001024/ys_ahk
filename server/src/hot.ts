import { watch, readFileSync, writeFileSync } from "fs"
import { filter, fromEventPattern, map, throttleTime } from "rxjs"
import type { WsServer } from "./rt/ws"
import { build } from "./build"

export function hot(io: WsServer) {
    // dev hot loader
    fromEventPattern(
        (handler) => watch("./dist", { recursive: true }, handler),
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
                const html_file = "./dist/index.html"
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
            filter(({ ev, filename }) => ev === "change"),
            map(({ filename }) => filename.replace(/\\/g, "/")),
            throttleTime(1e3)
        )
        .subscribe((path) => {
            console.log("🦊 Building", path)
            build(false)
        })
}
