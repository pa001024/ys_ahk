import { nanoid } from "nanoid"
import * as fs from "fs"
import { EventEmitter } from "events"
import type { WsServer } from "./ws"

export interface IMessage {
    id: string
    user: string
    text: string
    time: number
}

interface IUIDItem extends Partial<ICookData> {
    id: string
    uid: string
    cookTime: number
    cooker: string
}

interface IPendingItem extends ICookData {
    id: string
    cookTime: number
}

export interface ICookData {
    uid: string
    cooker: string
    img: string
    name: string
    sign: string
    lv: number
    chat: string[]
    status: "pending" | "rejected" | "success"
    tag: "f2" | "owned" | "auto"
}

interface IUIDHistoryItem extends IUIDItem {
    user: string
    time: number
}

interface IRoomOnlineUser {
    ref: number // 引用计数
    time: number
}

export interface IRoomActivity {
    id: string
    uid: string
    owner: string
    req: number // 需求 1龙2芙4万
    users: string[]
    time: number
}

export interface IRtcSession {
    id: string
    user: string
    time: number
}

const modes = ["normal", "melt"] as const
type Mode = (typeof modes)[number]

export interface IRoom {
    id: string
    name: string
    password?: string
    current: IUIDItem[]
    pending: IPendingItem[]
    history: IUIDHistoryItem[]
    count: number
    clientCount: number
    maxClient: number
    mode: Mode
    msgs: IMessage[]
    onlineUsers: { [key: string]: IRoomOnlineUser }
    activities: IRoomActivity[]
    rtcSessions: { [key: string]: IRtcSession }
}
const maskUid = (uid: string) => uid.slice(0, 3) + "***" + uid.slice(6)

type RoomEventTypes = "join" | "leave" | "msg" | "add_uid" | "new_act" | "join_act" | "del_act" | "mode_change" | "max_client_change" | "rtc_joined" | "rtc_leaved"
interface RoomEventPayload {
    room: Room
    data: any
}
export class Room implements IRoom {
    static emitter = new EventEmitter()
    id = "default"
    name = "万民堂"
    current: IUIDItem[] = []
    pending: IPendingItem[] = []
    history: IUIDHistoryItem[] = []
    count: number = 0
    clientCount: number = 0
    maxClient: number = 50
    mode: Mode = "normal"
    msgs: IMessage[] = []
    onlineUsers: { [key: string]: IRoomOnlineUser } = {}
    activities: IRoomActivity[] = []
    rtcSessions: { [key: string]: IRtcSession } = {}
    constructor(id = "default") {
        if (!fs.existsSync("rooms")) fs.mkdirSync("rooms", { recursive: true })
        this.id = id
        this.load()
    }

    static rooms: { [key: string]: Room } = {}

    join(user: string) {
        if (!user || user.length > 10) return false
        if (this.clientCount >= this.maxClient) return false
        this.clientCount++
        if (user in this.onlineUsers) {
            this.onlineUsers[user].ref++
            return true
        }
        this.onlineUsers[user] = { ref: 1, time: Math.floor(Date.now() / 1000) }
        this.msgs = [
            ...this.msgs.filter((item) => item.user !== user || item.text !== "<enter>").slice(-19),
            {
                id: nanoid(10),
                user: user,
                text: "<enter>",
                time: Math.floor(Date.now() / 1000),
            },
        ]
        this.emit("join", user)
        return true
    }
    leave(user: string) {
        this.clientCount--
        if (user in this.onlineUsers) {
            this.onlineUsers[user].ref--
            setTimeout(() => {
                if (this.onlineUsers[user]?.ref <= 0) {
                    delete this.onlineUsers[user]
                    this.msgs = [
                        ...this.msgs.filter((item) => item.user !== user || item.text !== "<leave>").slice(-19),
                        {
                            id: nanoid(10),
                            user: user,
                            text: "<leave>",
                            time: Math.floor(Date.now() / 1000),
                        },
                    ]
                    this.emit("leave", user)
                }
            }, 30e3)
        }
    }
    setMaxClient(count: number) {
        this.maxClient = count
        this.emit("max_client_change", count)
        this.save()
    }
    setMode(mode: Mode) {
        this.mode = mode
        this.emit("mode_change", mode)
        this.save()
    }

    addMsg(text: string, user = "[system]") {
        const msg = {
            id: nanoid(10),
            user: user,
            text: text.slice(0, 40),
            time: Math.floor(Date.now() / 1000),
        }
        this.msgs = [...this.msgs.slice(1 - 40), msg]
        this.save()
        this.emit("msg", msg)
    }

    addUid<T extends keyof IRoom>(uid: string, user = "[bot]"): T[] {
        if (typeof uid !== "string") uid = String(uid)
        if (!/^\d{9}\.?$/.test(uid)) {
            this.addMsg(uid, user)
            return []
        }

        const index = this.pending.findIndex((item) => item.uid === uid)
        if (index !== -1) {
            const item = { ...this.pending[index], status: "success" as const }
            this.pending.splice(index, 1)
            this.current.push(item)
            this.count++
            this.save()
            this.emit("add_uid", item)
            return ["current", "pending"] as T[]
        }
        // 自动进入活动
        let autoAct = uid.endsWith(".")
        if (autoAct) uid = uid.slice(0, -1)
        if (this.mode === "melt") autoAct = true
        if (this.current.some((item) => item.uid === uid)) return []
        if (this.history.some((item) => item.uid === uid)) {
            this.history.splice(
                this.history.findIndex((item) => item.uid === uid),
                1
            )
        }
        if (autoAct) {
            if (this.activities.some((item) => item.uid === uid)) return []
            const act = {
                id: nanoid(10),
                uid: uid,
                owner: user,
                req: 0,
                users: [user],
                time: Math.floor(Date.now() / 1000),
            }
            this.activities = [
                // 超过10分钟的活动自动清理
                ...this.activities.filter((item) => Math.floor(Date.now() / 1000) - item.time < 10 * 60),
                act,
            ]
            this.history = [
                ...this.history.slice(-9),
                {
                    id: nanoid(10),
                    uid: uid,
                    user: user,
                    cookTime: Math.floor(Date.now() / 1000),
                    cooker: user,
                    time: Math.floor(Date.now() / 1000),
                },
            ]
            this.count++
            this.save()
            this.emit("new_act", act)
            return ["activities", "history"] as T[]
        } else {
            const item = {
                id: nanoid(10),
                uid: uid,
                cookTime: Math.floor(Date.now() / 1000),
                cooker: user,
            }
            this.current.push(item)
            this.count++
            this.save()
            this.emit("add_uid", item)
            return ["current"] as T[]
        }
    }

    getActiveUids() {
        return new Set([...this.current.map((item) => item.uid), ...this.pending.map((item) => item.uid), ...this.activities.map((item) => item.uid)])
    }

    addRichUid<T extends keyof IRoom>(data: ICookData): T[] {
        if (data.uid.length > 9) {
            data.uid = data.uid.slice(0, 9)
        }
        if (this.getActiveUids().has(data.uid)) return []
        if (data.status === "pending" && data.chat.length > 0) {
            this.pending.push({
                id: nanoid(10),
                uid: data.uid,
                cookTime: Math.floor(Date.now() / 1000),
                cooker: data.cooker,
                // from ICookData
                img: data.img,
                name: data.name,
                sign: data.sign,
                lv: data.lv,
                chat: data.chat,
                status: data.status,
                tag: data.tag,
            })
            this.save()
            return ["pending"] as T[]
        }
        if (data.status === "success") {
            this.current.push({
                id: nanoid(10),
                uid: data.uid,
                cookTime: Math.floor(Date.now() / 1000),
                cooker: data.cooker,
                // from ICookData
                img: data.img,
                name: data.name,
                sign: data.sign,
                lv: data.lv,
                chat: data.chat,
                status: data.status,
                tag: data.tag,
            })
            this.count++
            this.save()
            return ["current"] as T[]
        }
        return [] as T[]
    }

    delUid<T extends keyof IRoom>(uid: string, user = "[bot]"): T[] {
        {
            const index = this.pending.findIndex((item) => item.uid === uid)
            if (index !== -1) {
                this.pending.splice(index, 1)
                this.save()
                return ["pending"] as T[]
            }
        }

        const index = this.current.findIndex((item) => item.uid === uid)
        if (index === -1) return []
        while (this.history.length >= 10) this.history.pop()
        this.history.unshift(...this.current.splice(index, 1).map(({ img, ...item }) => ({ ...item, user, time: Math.floor(Date.now() / 1000) })))
        this.save()
        return ["current", "history"] as T[]
    }

    clearUid(user = "[bot]") {
        this.history = [
            // 保留最近10个uid
            ...this.history.slice(-10 - this.current.length),
            ...this.current.map((item) => ({ ...item, user, time: Math.floor(Date.now() / 1000) })),
        ]
        this.current = []
        this.save()
        return true
    }

    getCurrent(id: string) {
        const index = this.current.findIndex((item) => item.id === id)
        if (index === -1) return null
        return this.current[index]
    }

    getFollowedActivities(user: string) {
        return this.activities.filter((item) => item.owner === user)
    }

    getAct(id: string) {
        const index = this.activities.findIndex((item) => item.id === id)
        if (index === -1) return null
        return this.activities[index]
    }

    addAct(id: string, user = "[bot]", flag = 0) {
        const activity = this.getAct(id)
        if (!activity) {
            const data = this.getCurrent(id)
            if (!data) return null
            const act = {
                id,
                uid: data.uid,
                owner: user,
                req: 7 ^ flag,
                users: [user],
                time: Math.floor(Date.now() / 1000),
                // from ICookData
                img: data.img,
                name: data.name,
                sign: data.sign,
                lv: data.lv,
                chat: data.chat,
                status: data.status,
                tag: data.tag,
            }
            this.activities = [
                // 超过10分钟的活动自动清理
                ...this.activities.filter((item) => Math.floor(Date.now() / 1000) - item.time < 10 * 60),
                act,
            ]
            this.emit("new_act", act)
            this.delUid(data.uid, user)
            return act
        }
        if (activity.users.includes(user) || !(!activity.req || activity.req & flag)) return null
        activity.users.push(user)
        activity.req &= ~flag
        this.emit("join_act", activity)
        this.save()
        return activity
    }

    delAct(id: string, user = "[bot]") {
        const index = this.activities.findIndex((item) => item.id === id)
        if (index === -1) return false
        const activity = this.activities[index]
        if (activity.owner !== user) return false
        this.activities.splice(index, 1)
        this.emit("del_act", activity)
        this.save()
        return true
    }

    toJSON<T extends keyof IRoom>(...names: T[]) {
        const data: IRoom = {
            id: this.id,
            name: this.name,
            clientCount: this.clientCount,
            maxClient: this.maxClient,
            mode: this.mode,
            current: this.current.map(({ img, ...item }) => ({ ...item, uid: maskUid(item.uid) })),
            history: this.history.map(({ img, ...item }) => ({ ...item, uid: maskUid(item.uid) })),
            pending: this.pending,
            count: this.count,
            msgs: this.msgs,
            onlineUsers: this.onlineUsers,
            activities: this.activities,
            rtcSessions: this.rtcSessions,
        }
        if (names.length === 0) return data
        const patial: { [key in T]: IRoom[key] } = {} as any
        for (const name of names) patial[name] = data[name]
        return patial
    }

    toJSONServer() {
        return {
            name: this.name,
            mode: this.mode,
            maxClient: this.maxClient,
            current: this.current,
            history: this.history,
            pending: this.pending,
            count: this.count,
            msgs: this.msgs,
            activities: this.activities,
        }
    }

    static getRoom(id = "default", roomMeta: Partial<IRoom> = {}) {
        if (!id || !id.match(/^[A-Za-z0-9_\-]+$/)) return null
        if (id in this.rooms) {
            return this.rooms[id]
        }
        const data = new Room(id)
        this.rooms[id] = data
        return data
    }

    static getRooms() {
        return Object.values(this.rooms).filter((room) => room.clientCount > 0)
    }

    save() {
        const json = JSON.stringify(this.toJSONServer(), null, 2)
        fs.writeFile("rooms/" + this.id + ".json", json, () => {})
    }

    load() {
        if (!fs.existsSync("rooms/" + this.id + ".json")) return
        try {
            const json = fs.readFileSync("rooms/" + this.id + ".json", "utf8")
            const obj: ReturnType<typeof Room.prototype.toJSONServer> = JSON.parse(json)

            this.maxClient = obj.maxClient || 50
            this.mode = obj.mode || "normal"
            this.name = obj.name || this.id
            this.current = obj.current || []
            this.history = obj.history || []
            this.pending = obj.pending || []
            this.count = obj.count || 0
            this.msgs = obj.msgs || []
            this.activities = obj.activities || []
        } catch (e) {
            console.error(`读取房间数据失败：${this.id}`)
        }
    }

    join_rtc(id: string, user: string) {
        let session = { id, user, time: Math.floor(Date.now() / 1000) }
        this.rtcSessions[id] = session
        this.addMsg("<rtcjoin>", user)
        this.save()
        this.emit("rtc_joined", session)
        return session
    }

    leave_rtc(id: string) {
        let session = this.rtcSessions[id]
        if (!session) return
        this.addMsg("<rtcleave>", session.user)
        delete this.rtcSessions[id]
        this.save()
        this.emit("rtc_leaved", session)
    }
    emit(ev: RoomEventTypes, data: any) {
        Room.emitter.emit(ev, { room: this, data })
        Room.emitter.emit(this.id + ":" + ev, data)
    }
    on(event: RoomEventTypes, listener: (data: any) => void) {
        return Room.emitter.on(this.id + ":" + event, listener)
    }
    once(event: RoomEventTypes, listener: (data: any) => void) {
        return Room.emitter.once(this.id + ":" + event, listener)
    }
    off(event: RoomEventTypes, listener: (data: any) => void) {
        return Room.emitter.off(this.id + ":" + event, listener)
    }
    static on(event: RoomEventTypes, listener: (payload: RoomEventPayload) => void) {
        return Room.emitter.on(event, listener)
    }
    static once(event: RoomEventTypes, listener: (payload: RoomEventPayload) => void) {
        return Room.emitter.once(event, listener)
    }
    static off(event: RoomEventTypes, listener: (payload: RoomEventPayload) => void) {
        return Room.emitter.off(event, listener)
    }

    static plugin(ws: WsServer<ClientEvent, ServerEvent>) {
        // ws.on("q::room_list", (wc) => {
        //     wc.reply(
        //         "q::room_list",
        //         Room.getRooms().map((room) => room.toJSON())
        //     )
        // })
        ws.on("connection", (wc) => {
            const { id, user } = wc

            wc.on("q::room_join", (roomId) => {
                const room = Room.getRoom(roomId)
                if (!room) {
                    wc.reply("q::room_join", false)
                    return
                }
                wc.reply("q::room_join", true)

                wc.once("disconnect", () => {
                    console.log(`user ${user} left room ${roomId}`)
                    room.leave(user)
                    room.leave_rtc(id)
                    wc.broadcast(roomId, `r:${roomId}:update`, room.toJSON("clientCount", "onlineUsers", "msgs"))
                })

                wc.on(`r:${roomId}:m`, (text: string) => {
                    room.addMsg(text, user)
                    wc.broadcast(roomId, "msg", { id: nanoid(10), user, text, time: Math.floor(Date.now() / 1000) })
                })

                wc.on(`r:${roomId}:set_mode`, (mode: string) => {
                    if (mode === "normal" || mode === "melt") {
                        room.setMode(mode)
                        wc.broadcast(roomId, `r:${roomId}:update`, room.toJSON("mode"))
                    }
                })

                wc.on(`r:${roomId}:add_uid`, (uid: string) => {
                    const parts = room.addUid(uid, user)
                    parts.length && wc.emit(roomId, `r:${roomId}:update`, room.toJSON(...parts))
                })

                wc.on(`r:${roomId}:del_uid`, (uid: string) => {
                    const parts = room.delUid(uid, user)
                    parts.length && wc.emit(roomId, `r:${roomId}:update`, room.toJSON(...parts))
                })

                wc.on(`r:${roomId}:clear_uid`, () => {
                    room.clearUid(user)
                    wc.emit(roomId, `r:${roomId}:update`, room.toJSON("current", "history"))
                })

                // act
                wc.on(`r:${roomId}:add_act`, (id) => {
                    const act = room.addAct(id, user)
                    if (!act) return
                    wc.emit(roomId, `r:${roomId}:update`, room.toJSON("activities"))
                    wc.reply(`r:${roomId}:add_act`, act)
                    if (room.mode === "melt" && act?.users.length === 2) {
                        setTimeout(() => {
                            room.delAct(id, act.owner)
                            wc.emit(roomId, `r:${roomId}:update`, room.toJSON("activities"))
                        }, 20e3)
                    }
                })
                wc.on(`r:${roomId}:del_act`, (id) => room.delAct(id, user) && wc.emit(roomId, `r:${roomId}:update`, room.toJSON("activities")))

                // WebRTC signaling
                // client1 --ask--> client2
                // client2 --offer--> client1
                // client1 --answer--> client2
                // client2 --candidate--> client1
                // client1 --candidate--> client2
                // end
                const rtc_channel = "__rtc__" + roomId
                wc.on(`r:${roomId}:rtc_join`, () => {
                    wc.subscribe(rtc_channel)
                    room.join_rtc(id, user)
                    wc.to(rtc_channel, `r:${roomId}:rtc_ask`, id)
                    wc.reply(
                        `r:${roomId}:rtc_join`,
                        Object.keys(room.rtcSessions).filter((v) => v !== id)
                    )
                    wc.emit(roomId, `r:${roomId}:update`, room.toJSON("rtcSessions"))
                })
                wc.on(`r:${roomId}:rtc_leave`, () => {
                    room.leave_rtc(id)
                    wc.to(rtc_channel, `r:${roomId}:rtc_leave`, id)
                    wc.unsubscribe(rtc_channel)
                    wc.emit(roomId, `r:${roomId}:update`, room.toJSON("rtcSessions"))
                })

                console.log(`user ${user} joined room ${roomId}`)

                wc.broadcast(roomId, `r:${roomId}:update`, room.toJSON("clientCount", "onlineUsers", "msgs"))
                wc.reply(`r:${roomId}:update`, room.toJSON())
            })
        })
    }
}

export type QueryEvent = {
    room_list: [void, list: IRoom[]]
    room_join: [roomId: string, success: boolean]
    room_leave: [roomId: string, success: boolean]
    room_create: [room: Partial<IRoom>, room: IRoom]
    room_delete: [roomId: string, success: boolean]
}
export type ClientQueryEvent = PickClientEvent<QueryEvent>
export type ServerQueryEvent = PickServerEvent<QueryEvent>

/** event: [请求 返回] */
export type RoomEvent = {
    joined: [never, id: string]
    left: [never, id: string]
    update: [never, data: Partial<IRoom>]
    m: [message: string, never]

    set_mode: [mode: string, never]
    add_uid: [uid: string, never]
    del_uid: [uid: string, never]
    clear_uid: [void, never]
    add_act: [id: string, IRoomActivity]
    del_act: [id: string, never]

    rtc_join: [void, string[]]
    rtc_leave: [void, string]
    rtc_ask: [never, id: string]
}

export type ClientRoomEvent = PickClientEvent<RoomEvent>
export type ServerRoomEvent = PickServerEvent<RoomEvent>

export type PickClientEvent<T extends Record<string, [any, any]>> = {
    [P in keyof T]: T[P][0] extends never ? never : (data: T[P][0]) => void
}
export type PickServerEvent<T extends Record<string, [any, any]>> = {
    [P in keyof T]: T[P][1] extends never ? never : (data: T[P][1]) => void
}

export type WithQuery<T extends Record<string, (...args: any) => void>, U extends string = keyof T extends string ? keyof T : never> = {
    [K in `q::${U}`]: K extends `q::${infer L extends U}` ? (T[L] extends never ? never : (...args: Parameters<T[L]>) => void) : never
}

export type WithRoom<T extends Record<string, (...args: any) => void>, U extends string = keyof T extends string ? keyof T : never> = {
    [K in `r:${string}:${U}`]: K extends `r:${string}:${infer L extends U}` ? (T[L] extends never ? never : (...args: Parameters<T[L]>) => void) : never
}

export type ServerEvent = WithRoom<ServerRoomEvent> &
    WithQuery<ServerQueryEvent> & {
        syn: (data: { id: string; t: number }) => void
    }
export type ClientEvent = WithRoom<ClientRoomEvent> & WithQuery<ClientQueryEvent>
