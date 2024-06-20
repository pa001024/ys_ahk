import EventEmitter from "eventemitter3"
import { createClient } from "graphql-ws"

export type WSEvent<DataType = any> = {
    message: (data: DataType) => void
    open: () => void
    close: () => void
}

export type WSOptions = {
    immediate: boolean
    protocols: string | string[]
    binaryType: "arraybuffer" | "blob"
    autoReconnect: boolean
    reconnectInterval: number
    heartbeat?: {
        message?: string
        interval?: number
    }
}

export class WSClient<MessageType = any> extends EventEmitter<WSEvent<MessageType>> {
    heartbeat: any
    ws?: WebSocket
    private options: WSOptions
    constructor(public url: string, options?: Partial<WSOptions>) {
        super()
        this.options = {
            immediate: true,
            protocols: [],
            binaryType: "arraybuffer",
            autoReconnect: false,
            reconnectInterval: 1000,
            ...options,
        }
        if (this.options.immediate) this.connect(url)
    }
    connect(url: string) {
        this.ws?.close()
        console.log("[ws] connect to", url)
        this.ws = new WebSocket(url, this.options.protocols)
        this.ws.binaryType = this.options.binaryType
        this.ws.onmessage = (event: MessageEvent) => {
            this.emit("message", JSON.parse(event.data))
        }
        this.ws.onclose = () => {
            console.info("[ws] disconnected")
            clearInterval(this.heartbeat)
            setTimeout(() => {
                this.connect(url)
            }, this.options.reconnectInterval || 1000)
        }
        this.ws.onopen = () => {
            console.info("[ws] connected")
            this.emit("open")
            if (this.options.heartbeat) {
                const message = this.options.heartbeat.message || "ping"
                this.heartbeat = setInterval(() => {
                    this.ws?.send(message)
                }, this.options.heartbeat.interval || 10000)
            }
        }
    }
    send(event: string, data?: any) {
        this.ws?.send(JSON.stringify({ e: event, d: data }))
    }
    close() {
        clearInterval(this.heartbeat)
        this.ws?.close()
        this.removeAllListeners()
    }

    createGQWSClient() {
        return createClient({
            url: this.url,
            webSocketImpl: this.getWebSocketImpl(),
            lazy: true,
            disablePong: true,
        })
    }

    // 模拟一个WebSocket对象给 graphql-ws 使用
    getWebSocketImpl() {
        const _this = this
        let onmessage: ((event: MessageEvent) => void) | null = null
        class fakeWebSocket {
            constructor() {
                // do nothing haha
            }

            static readonly OPEN = WebSocket.OPEN
            static readonly CLOSED = WebSocket.CLOSED
            static readonly CONNECTING = WebSocket.CONNECTING
            static readonly CLOSING = WebSocket.CLOSING

            get readyState() {
                return _this.ws?.readyState || WebSocket.CLOSED
            }

            send(data: any) {
                _this.send("gq", data)
            }

            close() {
                // _this.close()
            }

            onerror?: (event: Event) => void
            onopen?: (event: Event) => void
            onclose?: (event: CloseEvent) => void
            get onmessage() {
                const fallback = () => {}
                return onmessage || fallback
            }
            set onmessage(value: (event: MessageEvent) => void) {
                onmessage = value
            }
        }
        this.on("message", (data: any) => {
            if (data.e === "gq") {
                onmessage?.({ data: data.d } as any)
            }
        })
        return fakeWebSocket
    }
}
