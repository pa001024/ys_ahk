import http from "http"
import fs from "fs"
import express from "express"
import { Server } from "socket.io"
import { nanoid } from "nanoid"
const app = express()
const server = http.createServer(app)
const io = new Server(server)

interface IMessage {
    id: string
    user: string
    text: string
    time: number
}

interface IUIDItem {
    uid: string
    cookTime: number
    cooker: string
}

interface IUIDHistoryItem extends IUIDItem {
    user: string
    time: number
}

interface IRoomActiveItem {
    ref: number // 引用计数
    time: number
}

class Room {
    id = "default"
    uidList: IUIDItem[] = []
    uidHistory: IUIDHistoryItem[] = []
    uidCount: number = 0
    clientCount: number = 0
    maxClient: number = 50
    msgs: IMessage[] = []
    onlineUsers: { [key: string]: IRoomActiveItem } = {}
    constructor(id = "default") {
        if (!fs.existsSync("rooms")) fs.mkdirSync("rooms", { recursive: true })
        this.id = id
        this.load()
    }

    static rooms: { [key: string]: Room } = {}

    join(user: string) {
        if (this.clientCount >= this.maxClient) return false
        this.clientCount++
        if (user in this.onlineUsers) {
            this.onlineUsers[user].ref++
            return true
        }
        this.onlineUsers[user] = { ref: 1, time: Math.floor(Date.now() / 1000) }
        console.log("join", this.msgs.slice(-2))
        this.msgs = [
            ...this.msgs.filter((item) => item.user !== user || item.text !== "<enter>").slice(-19),
            {
                id: nanoid(10),
                user: user,
                text: "<enter>",
                time: Math.floor(Date.now() / 1000),
            },
        ]
        return true
    }
    leave(user: string) {
        this.clientCount--
        if (user in this.onlineUsers) {
            this.onlineUsers[user].ref--
            if (this.onlineUsers[user].ref <= 0) {
                delete this.onlineUsers[user]
                console.log("leave", this.msgs.slice(-2))
                this.msgs = [
                    ...this.msgs.filter((item) => item.user !== user || item.text !== "<leave>").slice(-19),
                    {
                        id: nanoid(10),
                        user: user,
                        text: "<leave>",
                        time: Math.floor(Date.now() / 1000),
                    },
                ]
            }
        }
    }
    setMaxClient(count: number) {
        this.maxClient = count
        this.save()
    }
    addUid(uid: string, user = "[system]") {
        if (!/^\d{9}$/.test(uid)) {
            this.msgs = [
                ...this.msgs.slice(-19),
                {
                    id: nanoid(10),
                    user: user,
                    text: uid.slice(0, 40),
                    time: Math.floor(Date.now() / 1000),
                },
            ]
            this.save()
            return
        }
        if (this.uidList.some((item) => item.uid === uid)) return
        if (this.uidHistory.some((item) => item.uid === uid)) {
            this.uidHistory.splice(
                this.uidHistory.findIndex((item) => item.uid === uid),
                1
            )
        }
        this.uidList.push({ uid: uid, cookTime: Math.floor(Date.now() / 1000), cooker: user })
        this.uidCount++
        this.save()
    }

    delUid(uid: string, user = "[system]") {
        const index = this.uidList.findIndex((item) => item.uid === uid)
        if (index === -1) return
        while (this.uidHistory.length >= 10) this.uidHistory.pop()
        this.uidHistory.unshift(...this.uidList.splice(index, 1).map((item) => ({ ...item, user, time: Math.floor(Date.now() / 1000) })))
        this.save()
    }

    toJSON() {
        return {
            clientCount: this.clientCount,
            maxClient: this.maxClient,
            current: this.uidList,
            history: this.uidHistory,
            count: this.uidCount,
            msgs: this.msgs,
            onlineUsers: this.onlineUsers,
        }
    }

    toJSONServer() {
        return {
            maxClient: this.maxClient,
            current: this.uidList,
            history: this.uidHistory,
            count: this.uidCount,
            msgs: this.msgs,
        }
    }

    static getRoom(id = "default") {
        if (!id.match(/^[A-Za-z0-9_\-]+$/)) return null
        if (id in this.rooms) {
            return this.rooms[id]
        }
        const data = new Room(id)
        this.rooms[id] = data
        return data
    }

    save() {
        const json = JSON.stringify(this.toJSONServer(), null, 2)
        fs.writeFile("rooms/" + this.id + ".json", json, () => {})
    }

    load() {
        if (!fs.existsSync("rooms/" + this.id + ".json")) return
        try {
            const json = fs.readFileSync("rooms/" + this.id + ".json", "utf8")
            const obj = JSON.parse(json)

            this.maxClient = obj.maxClient || []
            this.uidList = obj.current || []
            this.uidHistory = obj.history || []
            this.uidCount = obj.count || 0
            this.msgs = obj.msgs || []
        } catch (e) {
            console.error(`读取房间数据失败：${this.id}`)
        }
    }
}

function cors(res: any) {
    return res.set("Access-Control-Allow-Origin", "*")
}

io.on("connection", (socket) => {
    const id = socket.handshake.query.room || "default"
    const user = typeof socket.handshake.query.user === "string" ? socket.handshake.query.user : ""
    if (!id || typeof id !== "string" || !id.match(/^[A-Za-z0-9_\-]+$/)) return
    const room = Room.getRoom(id)!

    socket.on("disconnect", () => {
        console.log("io: client disconnected")
        room.leave(user)
        io.to(room.id).emit("update", room.toJSON())
    })

    socket.on("add_uid", (uid: string) => {
        room.addUid(uid, user)
        io.to(room.id).emit("update", room.toJSON())
    })

    socket.on("del_uid", (uid: string) => {
        room.delUid(uid, user)
        io.to(room.id).emit("update", room.toJSON())
    })

    if (!room.join(user)) return
    console.log("io: client connected")
    socket.join(room.id)
    io.to(room.id).emit("update", room.toJSON())
})

app.get("/list", (req, res) => {
    const room = Room.getRoom()!
    return cors(res).send(room.uidList.map((v) => v.uid).join())
})

app.get("/uid", (req, res) => {
    const room = Room.getRoom()!
    return cors(res).json(room.toJSON())
})

app.get("/add/:uid", (req, res) => {
    const room = Room.getRoom()!
    let uid = req.params.uid.replace(/[,<>\s%&]/g, "")
    room.addUid(uid)
    io.emit("update", room.toJSON())
    return cors(res).send(room.uidList.map((v) => v.uid).join())
})

app.get("/del/:uid", (req, res) => {
    const room = Room.getRoom()!
    let uid = req.params.uid
    room.delUid(uid)
    io.to(room.id).emit("update", room.toJSON())
    return cors(res).send(room.uidList.map((v) => v.uid).join())
})

app.get("/", (req, res) => {
    return res.sendFile(__dirname + "/static/index.html")
})

// static
app.use(express.static(__dirname + "/static"))

app.get("/r/:room", (req, res) => {
    return res.sendFile(__dirname + "/static/index.html")
})

app.get("/r/:room/list", (req, res) => {
    const room = Room.getRoom(req.params.room)!
    return cors(res).send(room.uidList.map((v) => v.uid).join())
})

app.get("/r/:room/uid", (req, res) => {
    const room = Room.getRoom(req.params.room)!
    return cors(res).json(room.toJSON())
})

app.get("/r/:room/add/:uid", (req, res) => {
    const room = Room.getRoom(req.params.room)!
    let uid = req.params.uid.replace(/[,<>\s%&]/g, "")
    room.addUid(uid)
    io.emit("update", room.toJSON())
    return cors(res).send(room.uidList.map((v) => v.uid).join())
})

app.get("/r/:room/del/:uid", (req, res) => {
    const room = Room.getRoom(req.params.room)!
    let uid = req.params.uid
    room.delUid(uid)
    io.to(room.id).emit("update", room.toJSON())
    return cors(res).send(room.uidList.map((v) => v.uid).join())
})

server.listen(8887, "0.0.0.0", () => {
    console.log("Server is running on port 8887")
})

fs.watch("static/index.html", () => {
    console.log("index.html changed, reload")
    io.emit("reload")
})
