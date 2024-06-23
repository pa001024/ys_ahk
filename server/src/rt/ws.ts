import { ServerWebSocket } from "bun"
import { Elysia } from "elysia"
import { EventEmitter } from "events"
import jwt from "jsonwebtoken"
import type { ElysiaWS } from "elysia/dist/ws"
import { GRAPHQL_TRANSPORT_WS_PROTOCOL, makeServer } from "graphql-ws"
import { genSchema, jwtToken } from "../db/yoga"
import { createSchema } from "graphql-yoga"

export type WsServerEvent<T = {}, U extends Record<string, any> = {}> = {
    connection: (wc: WsConnection<T, U>) => void
    disconnect: (wc: WsConnection<T, U>) => void
}

export type WsClientEvent = {
    disconnect: () => void
}

type ElysiaWSConnection = ElysiaWS<ServerWebSocket<any>, any, any>

interface GQClient {
    handleMessage: (data: string) => Promise<void>
    closed: (code: number, reason: string) => Promise<void>
}

export type WithServer<T extends Record<string, any>, U, V extends Record<string, any>> = {
    [K in keyof T]: K extends infer L extends keyof T ? (wc: WsConnection<U, V>, ...args: Parameters<T[L]>) => void : never
}

export class WsServer<
    C = {},
    S extends Record<string, any> = {},
    ClientEvent extends Record<string, any> = C & WsClientEvent,
    ServerEvent extends Record<string, any> = WsServerEvent<ClientEvent, S> & WithServer<S, ClientEvent, S>
> {
    private emitter = new EventEmitter()
    wsMap = new Map<string, WsConnection<ClientEvent, ServerEvent>>()
    roomMap = new Map<string, WsConnection<ClientEvent, ServerEvent>[]>()

    // graphql-ws clients
    gqClients = new WeakMap<ServerWebSocket<{ validator?: any }>, GQClient>()
    gqServer = makeServer<{
        user: { id: string } | null
    }>({ schema: createSchema(genSchema()), context: (req) => ({ user: req.connectionParams?.user || null }) })
    constructor(private app: Elysia) {
        this.app
            .derive(({ query: { token, name } }) => {
                if (token) {
                    const user = jwt.verify(token, jwtToken) as { id: string }
                    return { user }
                } else {
                    return { user: { id: "", name } }
                }
            })
            .ws("/ws", {
                open: (ws) => {
                    const wc = new WsConnection<ClientEvent, ServerEvent>(ws)
                    this.emitter.emit("connection", wc)
                    this.wsMap.set(ws.id, wc)
                    wc.reply("syn", { id: wc.id, t: Date.now() + 300 })

                    // graphql-ws
                    const client: GQClient = {
                        handleMessage: () => {
                            throw new Error("Message received before handler was registered")
                        },
                        closed: () => {
                            throw new Error("Closed before handler was registered")
                        },
                    }

                    client.closed = this.gqServer.opened(
                        {
                            // TODO: use protocol on socket once Bun exposes it
                            protocol: GRAPHQL_TRANSPORT_WS_PROTOCOL,
                            send: async (message) => {
                                // ws might have been destroyed in the meantime, send only if exists
                                if (this.gqClients.has(ws.raw)) {
                                    wc.gq(message)
                                }
                            },
                            close: (code, reason) => {
                                if (this.gqClients.has(ws.raw)) {
                                    // wc.close()
                                }
                            },
                            onMessage: (cb) => (client.handleMessage = cb),
                        },
                        { socket: ws.raw, user: ws.data.user }
                    )

                    this.gqClients.set(ws.raw, client)
                },
                message: async (ws, message: any) => {
                    if (message === 6) return ws.send(message)
                    if (message.e === "gq") {
                        const client = this.gqClients.get(ws.raw)
                        if (client) {
                            await client.handleMessage(message.msg)
                        }
                    } else if (message.to) {
                        this.id(message.to)?.sendFrom(ws.id, message.e, message.d)
                    } else if (message.e) {
                        this.emitter.emit(message.e, this.id(ws.id), message.d)
                        this.wsMap.get(ws.id)?.emitter.emit(message.e, message.d)
                    }
                },
                close: (ws, code, reason) => {
                    const wc = this.id(ws.id)
                    if (wc) wc.emitter.emit("disconnect", wc)
                    this.wsMap.delete(ws.id)
                    // graphql-ws
                    const client = this.gqClients.get(ws.raw)
                    if (!client) throw new Error("Closing a missing client")
                    client.closed(code, reason)
                },
            })
    }

    on<K extends keyof ServerEvent>(event: K, listener: ServerEvent[K]) {
        this.emitter.on(event as any, listener as any)
    }
    off<K extends keyof ServerEvent>(event: K, listener: ServerEvent[K]) {
        this.emitter.off(event as any, listener as any)
    }
    emit(topic: string, event: string, data?: any) {
        for (const wc of this.wsMap.values()) {
            wc.emit(topic, event, data)
            break
        }
    }
    to(room: string, event: string, data?: any) {
        for (const wc of this.wsMap.values()) {
            wc.to(room, event, data)
            break
        }
    }
    id(id: string) {
        return this.wsMap.get(id)
    }

    use(plugin: (ws: typeof this) => void) {
        plugin(this)
        return this
    }
}

export class WsConnection<ClientEvent = {}, ServerEvent extends Record<string, any> = {}> {
    id: string
    user: string
    emitter = new EventEmitter()
    constructor(private wc: ElysiaWSConnection) {
        this.id = wc.id
        this.user = wc.data.user.id
    }
    /** graphql-ws */
    gq(msg: string) {
        this.wc.send(JSON.stringify({ e: "gq", msg }))
    }
    close() {
        this.wc.close()
    }

    on<T extends keyof ClientEvent>(event: T, listener: ClientEvent[T]) {
        this.emitter.on(event as any, listener as any)
    }
    once<T extends keyof ClientEvent>(event: T, listener: ClientEvent[T]) {
        this.emitter.once(event as any, listener as any)
    }
    off<T extends keyof ClientEvent>(event: T, listener: ClientEvent[T]) {
        this.emitter.off(event as any, listener as any)
    }
    broadcast(room: string, event: string, data: any) {
        this.wc.publish(room, JSON.stringify({ e: event, d: data }))
    }
    emit<T extends keyof ServerEvent>(room: string, event: T, data: Parameters<ServerEvent[T]>[0]) {
        this.wc.publish(room, JSON.stringify({ e: event, d: data }))
        this.wc.send(JSON.stringify({ e: event, d: data }))
    }
    reply<T extends keyof ServerEvent>(event: T, data: Parameters<ServerEvent[T]>[0]) {
        this.wc.send(JSON.stringify({ e: event, d: data }))
    }
    sendFrom<T extends keyof ServerEvent>(from: string, event: T, data: Parameters<ServerEvent[T]>[0]) {
        this.wc.send(JSON.stringify({ from, e: event, d: data }))
    }
    to<T extends keyof ServerEvent>(topic: string, event: T, data: Parameters<ServerEvent[T]>[0]) {
        this.wc.publish(topic, JSON.stringify({ e: event, d: data }))
    }
    subscribe(topic: string) {
        this.wc.subscribe(topic)
    }
    unsubscribe(topic: string) {
        this.wc.unsubscribe(topic)
    }
}
