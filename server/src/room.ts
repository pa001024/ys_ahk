import { nanoid } from "nanoid"
import * as fs from "fs"

interface IMessage {
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

export interface ICookData {
    uid: string
    cooker: string
    img: string
    name: string
    sign: string
    lv: number
    chat: string[]
    status: "pending" | "rejected" | "accepted"
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

interface IRoomActivity {
    id: string
    uid: string
    owner: string
    req: number // 需求 1龙2芙4万
    users: string[]
    time: number
}

interface IRoom {
    current: IUIDItem[]
    history: IUIDHistoryItem[]
    count: number
    clientCount: number
    maxClient: number
    msgs: IMessage[]
    onlineUsers: { [key: string]: IRoomOnlineUser }
    activities: IRoomActivity[]
}
const maskUid = (uid: string) => uid.slice(0, 3) + "***" + uid.slice(6)

export class Room implements IRoom {
    id = "default"
    current: IUIDItem[] = []
    history: IUIDHistoryItem[] = []
    count: number = 0
    clientCount: number = 0
    maxClient: number = 50
    msgs: IMessage[] = []
    onlineUsers: { [key: string]: IRoomOnlineUser } = {}
    activities: IRoomActivity[] = []
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
        return true
    }
    leave(user: string) {
        this.clientCount--
        if (user in this.onlineUsers) {
            this.onlineUsers[user].ref--
            if (this.onlineUsers[user].ref <= 0) {
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
            }
        }
    }
    setMaxClient(count: number) {
        this.maxClient = count
        this.save()
    }
    addUid<T extends keyof IRoom>(uid: string, user = "[bot]"): T[] {
        if (!/^\d{9}\.?$/.test(uid)) {
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
            return ["msgs"] as T[]
        }
        let autoAct = uid.endsWith(".")
        if (autoAct) uid = uid.slice(0, -1)
        if (this.current.some((item) => item.uid === uid)) return []
        if (this.history.some((item) => item.uid === uid)) {
            this.history.splice(
                this.history.findIndex((item) => item.uid === uid),
                1
            )
        }
        if (autoAct) {
            this.activities = [
                // 超过10分钟的活动自动清理
                ...this.activities.filter((item) => Math.floor(Date.now() / 1000) - item.time < 10 * 60),
                {
                    id: nanoid(10),
                    uid: uid,
                    owner: user,
                    req: 0,
                    users: [user],
                    time: Math.floor(Date.now() / 1000),
                },
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
            return ["activities", "history"] as T[]
        } else {
            this.current.push({
                id: nanoid(10),
                uid: uid,
                cookTime: Math.floor(Date.now() / 1000),
                cooker: user,
            })
            this.count++
            this.save()
            return ["current"] as T[]
        }
    }

    addRichUid(data: ICookData) {
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
    }

    delUid(uid: string, user = "[bot]") {
        const index = this.current.findIndex((item) => item.uid === uid)
        if (index === -1) return false
        while (this.history.length >= 10) this.history.pop()
        this.history.unshift(...this.current.splice(index, 1).map((item) => ({ ...item, user, time: Math.floor(Date.now() / 1000) })))
        this.save()
        return true
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

    getAct(id: string) {
        const index = this.activities.findIndex((item) => item.id === id)
        if (index === -1) return null
        return this.activities[index]
    }

    addAct(id: string, user = "[bot]", flag = 0) {
        const activity = this.getAct(id)
        if (!activity) {
            const current = this.getCurrent(id)
            if (!current) return false
            const act = {
                id,
                uid: current.uid,
                owner: user,
                req: 7 ^ flag,
                users: [user],
                time: Math.floor(Date.now() / 1000),
            }
            this.activities = [
                // 超过10分钟的活动自动清理
                ...this.activities.filter((item) => Math.floor(Date.now() / 1000) - item.time < 10 * 60),
                act,
            ]
            this.delUid(current.uid, user)
            return act
        }
        if (activity.users.includes(user) || !(!activity.req || activity.req & flag)) return false
        activity.users.push(user)
        activity.req &= ~flag
        this.save()
        return activity
    }

    delAct(id: string, user = "[bot]") {
        const index = this.activities.findIndex((item) => item.id === id)
        if (index === -1) return false
        const activity = this.activities[index]
        if (activity.owner !== user) return false
        this.activities.splice(index, 1)
        return true
    }

    toJSON<T extends keyof IRoom>(...names: T[]) {
        const data: IRoom = {
            clientCount: this.clientCount,
            maxClient: this.maxClient,
            current: this.current.map((item) => ({ ...item, uid: maskUid(item.uid) })),
            history: this.history.map((item) => ({ ...item, uid: maskUid(item.uid) })),
            count: this.count,
            msgs: this.msgs,
            onlineUsers: this.onlineUsers,
            activities: this.activities,
        }
        if (names.length === 0) return data
        const patial: { [key in T]: IRoom[key] } = {} as any
        for (const name of names) patial[name] = data[name]
        return patial
    }

    toJSONServer() {
        return {
            maxClient: this.maxClient,
            current: this.current,
            history: this.history,
            count: this.count,
            msgs: this.msgs,
            activities: this.activities,
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
            this.current = obj.current || []
            this.history = obj.history || []
            this.count = obj.count || 0
            this.msgs = obj.msgs || []
            this.activities = obj.activities || []
        } catch (e) {
            console.error(`读取房间数据失败：${this.id}`)
        }
    }
}
