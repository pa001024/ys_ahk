import { Elysia } from "elysia"
import * as bun from "bun"
import { staticPlugin } from "@elysiajs/static"
import { ICookData, Room } from "./room"
import { WsServer } from "./ws"
import { watch } from "fs"

const app = new Elysia().use(staticPlugin({ prefix: "/" }))

const io = new WsServer(app)
io.on("connection", (ws) => {
    const { roomId, user } = ws
    const room = Room.getRoom(roomId)

    if (!room || !room.join(user)) return
    ws.on("disconnect", () => {
        console.log(`user ${user} left room ${roomId}`)
        room.leave(user)
        ws.broadcast("update", room.toJSON("clientCount", "msgs"))
    })

    ws.on("add_uid", (uid: string) => {
        const parts = room.addUid(String(uid), user)
        ws.broadcast("update", room.toJSON(...parts))
        ws.reply("update", room.toJSON(...parts))
    })

    ws.on("del_uid", (uid: string) => {
        const parts = room.delUid(uid, user)
        ws.broadcast("update", room.toJSON(...parts))
        ws.reply("update", room.toJSON(...parts))
    })

    ws.on("clear_uid", () => {
        room.clearUid(user)
        ws.broadcast("update", room.toJSON("current", "history"))
        ws.reply("update", room.toJSON("current", "history"))
    })

    ws.on("add_act", ({ id, flag }) => {
        const act = room.addAct(id, user, flag)
        ws.broadcast("update", room.toJSON("activities"))
        ws.reply("update", room.toJSON("activities"))
        ws.reply("act_ok", act)
    })

    ws.on("del_act", ({ id }) => {
        room.delAct(id, user)
        ws.broadcast("update", room.toJSON("activities"))
        ws.reply("update", room.toJSON("activities"))
    })

    console.log(`user ${user} joined room ${roomId}`)
    ws.broadcast("update", room.toJSON("clientCount", "onlineUsers", "msgs"))
    ws.reply("update", room.toJSON())
    ws.reply("sync", Date.now() + 300)
})

watch("./public", { recursive: true }, (rev, filename) => {
    console.log("🦊 File changed:", filename)
    console.log("🦊 Reloading static files...")
    io.emit("reload")
})

const roomRouter = <T extends Elysia<any, any, any>>(app: T) =>
    app
        .get("/", () => bun.file("public/index.html"))
        .get("/uid", (r) => {
            const room = r.params?.room
            return JSON.stringify(Room.getRoom(room)?.toJSON())
        })
        .get("/list", (r) => {
            const room = r.params?.room
            return Room.getRoom(room)
                ?.current.map(({ uid }) => uid)
                .join(",")
        })
        .get("/history", (r) => {
            const room = r.params?.room
            return Room.getRoom(room)
                ?.history.map(({ uid }) => uid)
                .join(",")
        })
        .get("/add/:uid", ({ params: { room, uid }, query: { cooker } }) => {
            const r = Room.getRoom(room)
            if (!r) return null
            const res = r.addUid(decodeURI(uid), cooker)
            res.length && io.to(room)?.emit("update", r.toJSON(...res))
            return "ok"
        })
        .get("/del/:uid", ({ params: { room, uid } }) => {
            const r = Room.getRoom(room)
            if (!r) return null
            const res = r.delUid(uid)
            io.to(room)?.emit("update", r.toJSON(...res))
            return "ok"
        })
        .get("/act/:id", ({ params: { room, id }, query: { user, flag } }) => {
            const r = Room.getRoom(room)
            if (!r) return null
            const res = r.addAct(id, user, flag)
            io.to(room)?.emit("update", r.toJSON("activities"))
            return res
        })
        .post("/new", ({ params, body }: { params: { room: string }; body: ICookData }) => {
            if (!body || typeof body !== "object") return "err"
            const room = params?.room
            const r = Room.getRoom(room)!
            const res = r.addRichUid(body)
            res.length && io.to(room)?.emit("update", r.toJSON(...res))
            return "ok" //r.toJSON("current")
        })

roomRouter(app) // mount to /
app.group("/r/:room", roomRouter) // mount to /r/:room

app.listen(8887)
console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`)
