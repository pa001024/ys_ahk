import { Elysia } from "elysia"
import * as bun from "bun"
import { staticPlugin } from "@elysiajs/static"
import { ICookData, IRoomActivity, Room } from "./room"
import { WsServer } from "./ws"
import { watch } from "fs"
import { Stream } from "@elysiajs/stream"

const app = new Elysia().use(staticPlugin({ prefix: "/" }))

const io = new WsServer(app)
io.on("connection", (ws) => {
    const { roomId, user } = ws
    const room = Room.getRoom(roomId)

    // 拒绝连接
    if (!room || !room.join(user)) return

    ws.on("disconnect", () => {
        console.log(`user ${user} left room ${roomId}`)
        room.leave(user)
        ws.broadcast("update", room.toJSON("clientCount", "msgs"))
    })

    ws.on("add_uid", (uid: string) => {
        const parts = room.addUid(uid, user)
        ws.emit("update", room.toJSON(...parts))
    })

    ws.on("set_mode", (mode: string) => {
        if (mode === "normal" || mode === "melt") {
            room.setMode(mode)
            ws.broadcast("update", room.toJSON("mode"))
        }
    })

    ws.on("del_uid", (uid: string) => {
        const parts = room.delUid(uid, user)
        ws.emit("update", room.toJSON(...parts))
    })

    ws.on("clear_uid", () => {
        room.clearUid(user)
        ws.emit("update", room.toJSON("current", "history"))
    })

    ws.on("add_act", ({ id, flag }) => {
        const act = room.addAct(id, user, flag)
        ws.emit("update", room.toJSON("activities"))
        ws.reply("act_ok", act)
        if (room.mode === "melt" && act?.users.length === 2) {
            setTimeout(() => {
                room.delAct(id, act.owner)
                ws.emit("update", room.toJSON("activities"))
            }, 20e3)
        }
    })

    ws.on("del_act", ({ id }) => {
        if (room.delAct(id, user)) ws.emit("update", room.toJSON("activities"))
    })

    // WebRTC
    ws.on("join_rtc", () => {
        room.addUid("<rtcjoin>", user)
        ws.broadcast("join_rtc", { user })
        ws.emit("update", room.toJSON("msgs"))
    })
    ws.on("leave_rtc", () => {
        room.addUid("<rtcleave>", user)
        ws.broadcast("leave_rtc", { user })
        ws.emit("update", room.toJSON("msgs"))
    })
    ws.on("offer", (sdp) => ws.broadcast("offer", { user, sdp }))
    ws.on("answer", (sdp) => ws.broadcast("answer", { user, sdp }))
    ws.on("candidate", (candidate) => ws.broadcast("candidate", { user, candidate }))

    console.log(`user ${user} joined room ${roomId}`)
    ws.reply("sync", Date.now() + 300)
    ws.broadcast("update", room.toJSON("clientCount", "onlineUsers", "msgs"))
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
        .get("/uid", (r) => {
            const room = r.params?.room
            return JSON.stringify(Room.getRoom(room)?.toJSON())
        })
        .get("/list", (r) => {
            const room = Room.getRoom(r.params?.room)
            if (!room) return ""
            return room.current.map(({ uid }) => "1").join(",")
        })
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
            room.on("new_act", handler)
            setTimeout(() => {
                stream.close()
                room.off("new_act", handler)
            }, 30e3) // 超时返回
            return stream
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
            res && io.to(room)?.emit("update", r.toJSON(...res))
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
