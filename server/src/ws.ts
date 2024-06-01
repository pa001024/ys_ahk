import { ServerWebSocket } from "bun"
import { Elysia } from "elysia"
import { EventEmitter } from "events"
import { Room } from "./room"

export class WsServer {
    private emitter = new EventEmitter()
    wsMap = new Map<string, WsConnection>()
    roomMap = new Map<string, WsConnection[]>()
    constructor(private app: Elysia) {
        this.app
            .derive(({ query: { user, room } }) => {
                return { user, roomId: room }
            })
            .ws("/ws", {
                open: (ws) => {
                    const { roomId, user } = ws.data
                    ws.id
                    if (!roomId || !user) return
                    ws.subscribe(roomId)
                    ws.send({ event: "joined", data: ws.id })
                    const wc = new WsConnection(ws as any)
                    this.emitter.emit("connection", wc)
                    this.wsMap.set(ws.id, wc)
                    if (this.roomMap.has(roomId)) this.roomMap.get(roomId)!.push(wc)
                    else this.roomMap.set(roomId, [wc])
                },
                close: (ws, code, reason) => {
                    const { roomId, user } = ws.data
                    const room = Room.getRoom(roomId)
                    const wc = this.wsMap.get(ws.id)
                    if (wc) wc.emitter.emit("disconnect", room, user)
                    this.wsMap.delete(ws.id)
                    const roomConnections = this.roomMap.get(roomId!)
                    if (roomConnections) {
                        roomConnections.splice(roomConnections.indexOf(wc!), 1)
                        if (roomConnections.length === 0) this.roomMap.delete(roomId!)
                    }
                },
                message: (ws, message: any) => {
                    if (message.to) {
                        this.id(message.to)?.send(ws.id, message.event, message.data)
                    } else if (message.event) {
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
    to(roomId = "default") {
        return this.roomMap.get(roomId)!.at(0)
    }
    id(id: string) {
        return this.wsMap.get(id)
    }
}

export class WsConnection {
    id: string
    roomId: string
    user: string
    emitter = new EventEmitter()
    constructor(private ws: Omit<ServerWebSocket, "data"> & { id: string; data: { roomId: string; user: string } }) {
        this.id = ws.id
        this.roomId = ws.data.roomId
        this.user = ws.data.user
    }
    on(event: string, listener: (...args: any[]) => void) {
        this.emitter.on(event, listener)
    }
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
    send(from: string, event: string, data: any) {
        this.ws.send(JSON.stringify({ from, event, data }))
    }
    to(topic: string, event: string, data: any) {
        this.ws.publish(topic, JSON.stringify({ event, data }))
    }
    subscribe(topic: string) {
        this.ws.subscribe(topic)
    }
    unsubscribe(topic: string) {
        this.ws.unsubscribe(topic)
    }
}
