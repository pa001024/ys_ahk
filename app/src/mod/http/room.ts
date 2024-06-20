import { createGlobalState } from "@vueuse/core"
import EventEmitter from "eventemitter3"
import { inject, onUnmounted, provide, reactive, ref, watchEffect } from "vue"
import type { IRoom, ServerRoomEvent, ServerQueryEvent, ClientEvent, ServerEvent, ClientQueryEvent } from "../../../../server/src/rt/room"
import { WSClient } from "./ws"

class Room extends EventEmitter<ServerRoomEvent> {
    data = reactive({
        id: "",
        name: "",
        mode: "normal",
        current: [],
        history: [],
        pending: [],
        msgs: [],
        activities: [],
        clientCount: 0,
        maxClient: 0,
        count: 0,
        onlineUsers: {},
        rtcSessions: {},
    } as IRoom)

    constructor(public roomId: string, private rm: RoomManager) {
        super()

        this.on("update", (data) => {
            Object.assign(this.data, data)
            if (data.activities) {
                // 需要从当前列表中删除已开始的活动
                const ids = new Set(data.activities.map((item) => item.id))
                const ex = new Set(this.data.current.map((item) => item.id).filter((id) => ids.has(id)))
                if (ex.size) {
                    // @ts-ignore
                    this.data.history = [
                        //
                        ...this.data.history.filter((item) => !ex.has(item.id)),
                        ...data.activities.filter((item) => ex.has(item.id)).map((v) => ({ ...v, user: v.owner, ...this.data.current.find((i) => i.id == v.id) })),
                    ]
                    this.data.current = this.data.current.filter((item) => !ex.has(item.id))
                }
            }
        })
    }

    send(message: string) {
        this.rm.send(`r:${this.roomId}:m`, message)
    }
}

type ServerMessage<T extends keyof ClientEvent = keyof ClientEvent> = { e: T; d: Parameters<ClientEvent[T]>[0] }

class RoomManager extends EventEmitter<ClientEvent> {
    id!: string
    rooms: Record<string, Room> = {}

    get(roomId: string) {
        if (!this.rooms[roomId]) {
            return null
        }
        return this.rooms[roomId]
    }
    ws: WSClient

    ready!: PromiseLike<void>
    constructor(url: string) {
        super()
        this.ws = new WSClient<ServerMessage>(url, {
            autoReconnect: true,
            heartbeat: {
                message: "6",
                interval: 30000,
            },
        })

        this.ws.on("message", (data: ServerMessage) => {
            if (data.e) {
                const [channel, roomId, event] = data.e.split(":") as [string, string, keyof ServerRoomEvent | keyof ServerQueryEvent]
                if (channel === "q") {
                    const e = event as keyof ServerQueryEvent
                    this.emit(`q::${e}`, data.d as any)
                } else if (channel === "r" && event && roomId) {
                    const e = event as keyof ServerRoomEvent
                    this.get(roomId)?.emit(e, data.d as any)
                    this.emit(`r:${roomId}:${e}`, data.d as any)
                } else {
                    this.emit(data.e, data.d as any)
                }
            }
        })

        const syn = () => {
            this.ready = this.wait("syn").then(({ id, t }) => {
                console.log("room syn", id)
                this.id = id
                this.timeOffset = t - Date.now()
            })
        }

        // 重新连接时触发
        this.ws.on("open", syn)
        syn()
    }

    /** __core:__ send message to server */
    send(event: keyof ClientEvent, data?: any) {
        this.ws.send(event, data)
    }

    /** __core:__ wait for server event */
    wait<T extends keyof ServerEvent>(event: T, timeout = 10000) {
        return new Promise<Parameters<ServerEvent[T]>[0]>((resolve, reject) => {
            this.once<any>(event, (data) => {
                resolve(data)
            })
            setTimeout(() => {
                reject(new Error("timeout"))
            }, timeout)
        })
    }

    /** __core:__ query server */
    async query<T extends keyof ClientQueryEvent>(query: T, data?: Parameters<ClientQueryEvent[T]>[0]) {
        this.send(`q::${query}`, data)
        return await this.wait(`q::${query}`)
    }

    async join(roomId: string) {
        await this.ready
        const success = await this.query(`room_join`, roomId)
        if (!success) return null
        if (this.rooms[roomId]) {
            return this.rooms[roomId]
        }
        const room = new Room(roomId, this)
        return room
    }

    async leave(roomId: string) {
        if (this.rooms[roomId]) {
            await this.query(`room_leave`, roomId)
            delete this.rooms[roomId]
        }
    }

    async createRoom(name: string) {
        const room = await this.query("room_create", { name })
        return this.join(room.id)
    }

    async deleteRoom(roomId: string) {
        await this.query("room_delete", roomId)
    }

    // 时间同步
    timeOffset = 0
    now() {
        return Date.now() + this.timeOffset
    }

    dispose() {
        this.ws.close()
        this.removeAllListeners()
    }
}

const useRoomManagerHost = createGlobalState(() => {
    const rm = { value: null as unknown as RoomManager }
    const url = ref("")
    return { rm, url }
})

export function provideRoomManager(newUrl: string) {
    const { rm, url } = useRoomManagerHost()
    watchEffect(() => {
        if (newUrl !== url.value) {
            console.log("new url", newUrl)
            url.value = newUrl
            rm.value?.dispose()
            rm.value = new RoomManager(newUrl)
        }
        provide("roomManager", rm.value)
    })
    return rm.value
}

export function useRoomManager() {
    const rm = inject("roomManager") as RoomManager
    return rm
}

export function useRoomList() {
    const rm = inject("roomManager") as RoomManager
    if (!rm) return null
    const list = ref([] as IRoom[])
    const query = async () => {
        const data = await rm.query("room_list")
        list.value = data
    }
    query()
    return list
}

export async function useRoom(roomId: string) {
    const rm = inject("roomManager") as RoomManager
    if (!rm) return null
    const room = await rm.join(roomId)
    onUnmounted(() => {
        rm.leave(roomId)
    })
    return room
}
