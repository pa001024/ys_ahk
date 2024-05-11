import { ServerWebSocket } from "bun"
import { Elysia } from "elysia"
import { EventEmitter } from "events"
import { Room } from "./room"

export class WsServer {
    private emitter = new EventEmitter()
    wsMap = new Map<string, WsConnection>()
    constructor(private app: Elysia) {
        this.app
            .derive(({ query: { user, room } }) => {
                return { user, roomId: room }
            })
            .ws("/ws", {
                open: (ws) => {
                    const { roomId, user } = ws.data
                    if (!roomId || !user) return
                    ws.subscribe(roomId)
                    ws.send({ event: "joined", data: ws.id })
                    const wc = new WsConnection(ws as any)
                    this.emitter.emit("connection", wc)
                    this.wsMap.set(ws.id, wc)
                },
                close: (ws, code, reason) => {
                    const { roomId, user } = ws.data
                    const room = Room.getRoom(roomId)
                    if (room && user) room.leave(user)
                    const wc = this.wsMap.get(ws.id)
                    if (wc) wc.emitter.emit("disconnect", room, user)
                    this.wsMap.delete(ws.id)
                },
                message: (ws, message: any) => {
                    if (message.event) {
                        this.emitter.emit(message.event, message.data)
                        this.wsMap.get(ws.id)?.emitter.emit(message.event, message.data)
                    }
                },
            })
    }
    on(event: string, listener: (ws: WsConnection, ...args: any[]) => void) {
        this.emitter.on(event, listener)
    }
    emit(event: string, data?: any) {
        for (const wc of this.wsMap.values()) {
            wc.emit(event, data)
            break
        }
    }
    to(roomId: string) {
        for (const wc of this.wsMap.values()) {
            if (wc.roomId === roomId) return wc
        }
    }
}

export class WsConnection {
    emitter = new EventEmitter()
    constructor(private ws: Omit<ServerWebSocket, "data"> & { data: { roomId: string; user: string } }) {
        this.roomId = ws.data.roomId
        this.user = ws.data.user
    }
    on(event: string, listener: (...args: any[]) => void) {
        this.emitter.on(event, listener)
    }
    roomId = ""
    user = ""
    broadcast(event: string, data: any) {
        this.ws.publish(this.roomId, JSON.stringify({ event, data }))
    }
    emit(event: string, data?: any) {
        this.ws.publish(this.roomId, JSON.stringify({ event, data }))
        this.ws.send(JSON.stringify({ event, data }))
    }
    reply(event: string, data: any) {
        this.ws.send(JSON.stringify({ event, data }))
    }
}
