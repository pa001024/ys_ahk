import { Elysia } from "elysia"
import * as bun from "bun"
import { staticPlugin } from "@elysiajs/static"
import { cors } from "@elysiajs/cors"
import { ICookData, IRoomActivity, Room } from "./rt/room"
import { WsServer } from "./rt/ws"
import { Stream } from "@elysiajs/stream"
import { hot } from "./hot"
import { yogaPlugin } from "./db"

const app = new Elysia()
    .use(staticPlugin({ prefix: "/", assets: "dist" }))
    .use(cors())
    .use(yogaPlugin())

const io = new WsServer(app)
io.use(Room.plugin)

const roomRouter = () => {
    const app = new Elysia<"/r/:room">()
    app.get("/", () => bun.file("dist/index.html"))
        .get("/poll", (r) => {
            // 长轮询，返回最后一条活动的 UID
            const room = Room.getRoom(r.params?.room)
            const user = r.query?.user
            const follow = r.query?.follow
            if (!room) return ""
            if (room.activities.length) {
                const act = (follow ? room.getFollowedActivities(follow) : room.activities).at(-1)!
                if (user) room.addAct(act.id, user, 7)
                return act.uid
            }
            const stream = new Stream()
            const handler = (act: IRoomActivity) => {
                if (follow && act.owner !== follow) return
                if (user) room.addAct(act.id, user, 7)
                stream.send(new TextEncoder().encode(act.uid))
                stream.close()
                room.off("new_act", handler)
            }
            room.once("new_act", handler)
            setTimeout(() => {
                stream.close()
                room.off("new_act", handler)
            }, 30e3) // 超时返回
            return stream
        })
        .get("/add/:uid", ({ params: { room, uid }, query: { cooker } }) => {
            const r = Room.getRoom(room)
            if (!r) return null
            const res = r.addUid(decodeURI(uid), cooker)
            res.length && io.to(room, "update", r.toJSON(...res))
            return "ok"
        })
        .get("/del/:uid", ({ params: { room, uid } }) => {
            const r = Room.getRoom(room)
            if (!r) return null
            const res = r.delUid(uid)
            res && io.to(room, "update", r.toJSON(...res))
            return "ok"
        })
        .get("/act/:id", ({ params: { room, id }, query: { user, flag } }) => {
            const r = Room.getRoom(room)
            if (!r) return null
            const res = r.addAct(id, user, flag as any)
            io.to(room, "update", r.toJSON("activities"))
            return res
        })
        .post("/new", ({ params, body }: { params: { room: string }; body: ICookData }) => {
            if (!body || typeof body !== "object") return "err"
            const room = params?.room
            const r = Room.getRoom(room)!
            const res = r.addRichUid(body)
            res.length && io.to(room, "update", r.toJSON(...res))
            return "ok"
        })
    return app
}
app.use(roomRouter())
app.group("/r/:room", roomRouter) // mount to /r/:room
app.group("/api", (app) =>
    app
        // 房间列表
        .get("/rooms", () => JSON.stringify(Room.getRooms().map((v) => ({ ...v.toJSON() }))))
)

if (bun.env._BUN_WATCHER_CHILD) {
    console.log("🔥 --watch detected, HMR enabled")
    hot(io)
    // setTimeout(() => {
    //     io.emit("reload")
    // }, 1e3)
}

app.listen(8887)
console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`)
