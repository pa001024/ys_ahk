import { Elysia } from "elysia"
import * as bun from "bun"
import { staticPlugin } from "@elysiajs/static"
import { Room } from "./room"
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
        ws.broadcast("update", room.toJSON("clientCount"))
    })

    ws.on("add_uid", (uid: string) => {
        const isMsg = room.addUid(uid, user)
        ws.broadcast("update", isMsg ? room.toJSON("msgs") : room.toJSON("current", "history"))
        ws.reply("update", isMsg ? room.toJSON("msgs") : room.toJSON("current", "history"))
    })

    ws.on("del_uid", (uid: string) => {
        room.delUid(uid, user)
        ws.broadcast("update", room.toJSON("current", "history"))
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
    ws.broadcast("update", room.toJSON("clientCount"))
    ws.reply("update", room.toJSON())
})

watch("./public", { recursive: true }, (rev, filename) => {
    console.log("🦊 File changed:", filename)
    console.log("🦊 Reloading static files...")
    io.emit("reload")
})

const roomRouter = <T extends Elysia<any, any, any>>(app: T) =>
    app
        .get("/", () => bun.file("public/index.html"))
        .get("/uid", ({ params: { room } }) => JSON.stringify(Room.getRoom(room)?.toJSON()))
        .get("/list", ({ params: { room } }) => Room.getRoom(room)?.current.join(","))
        .get("/history", ({ params: { room } }) => Room.getRoom(room)?.history.join(","))
        .get("/add/:uid", ({ params: { room, uid }, query: { cooker } }) => {
            const r = Room.getRoom(room)
            if (!r) return
            const res = r.addUid(decodeURI(uid), cooker)
            io.to(room)?.emit("update", r.toJSON("current", "history"))
            return res
        })
        .get("/del/:uid", ({ params: { room, uid } }) => {
            const r = Room.getRoom(room)
            if (!r) return
            const res = r.delUid(uid)
            io.to(room)?.emit("update", r.toJSON("current", "history"))
            return res
        })
        .get("/act/:id", ({ params: { room, id }, query: { user, req } }) => {
            const r = Room.getRoom(room)
            if (!r) return
            const res = r.addAct(id, user, req)
            io.to(room)?.emit("update", r.toJSON("activities"))
            return res
        })

roomRouter(app) // mount to /
app.group("/r/:room", roomRouter) // mount to /r/:room

app.listen(8887)
console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`)
