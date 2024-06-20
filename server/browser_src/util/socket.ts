export type EventSign = { event: string; handler: (data: any) => void }

export class SocketIO {
    heartbeat: any
    ws!: any
    id?: string
    constructor(public roomId: string, public playerName: string) {
        this.reconnect(roomId, playerName)
    }
    reconnect(roomId: string, playerName: string) {
        if (this.ws) this.ws.close()
        let url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/?room=${roomId}&user=${playerName}`
        console.log("[io] connect to", url)
        this.ws = new WebSocket(url)
        this.ws.onmessage = (event: MessageEvent) => {
            const data = JSON.parse(event.data)
            if (data.event) {
                this.ws?.dispatchEvent(new CustomEvent(data.event, { detail: data }))
            }
        }
        this.ws.onclose = () => {
            console.info("[io] disconnected")
            clearInterval(this.heartbeat)
            setTimeout(() => {
                this.reconnect(roomId, playerName)
            }, 1)
        }
        this.on("joined", (id: string) => {
            this.id = id
            console.info("[io] connected:", id)
        })
        this.events.pop()
        this.events.forEach(({ event, handler }) => {
            this.ws.addEventListener(event, handler)
        })
    }
    emit(event: string, data?: any) {
        this.ws.send(JSON.stringify({ event, data }))
    }
    sendto(id: string, event: string, data?: any) {
        this.ws.send(JSON.stringify({ to: id, event, data }))
    }
    dispatchEvent(ev: string, data?: any) {
        this.ws.dispatchEvent(new CustomEvent(ev, { detail: data }))
    }
    events: EventSign[] = []
    #on(event: string, handler: (event: CustomEvent) => void) {
        const ev = { event, handler }
        this.events.push(ev)
        this.ws.addEventListener(event, handler)
        return ev
    }
    on(event: string, callback: (data: any) => void) {
        let handler = (event: CustomEvent) => {
            callback(event.detail.data)
        }
        return this.#on(event, handler)
    }
    once(event: string, callback: (data: any) => void) {
        let handler = (ev: CustomEvent) => {
            callback(ev.detail.data)
            this.ws.removeEventListener(event, handler)
        }
        this.ws.addEventListener(event, handler)
    }
    onFrom(from: string, event: string, callback: (data: any) => void) {
        let handler = (ev: CustomEvent) => {
            if (from === ev.detail.from) callback(ev.detail.data)
        }
        return this.#on(event, handler)
    }
    onceFrom(from: string, event: string, callback: (data: any) => void) {
        let handler = (ev: CustomEvent) => {
            if (from === ev.detail.from) {
                callback(ev.detail.data)
                this.ws.removeEventListener(event, handler)
            }
        }
        this.ws.addEventListener(event, handler)
    }
    off(ev: EventSign) {
        this.events = this.events.filter((e) => e !== ev)
        this.ws.removeEventListener(ev.event, ev.handler)
    }
    wait<T extends any>(event: string) {
        return new Promise<T>((resolve) => {
            const handler = (ev: CustomEvent) => {
                this.ws.removeEventListener(event, handler)
                resolve(ev.detail.data)
            }
            this.ws.addEventListener(event, handler)
        })
    }
}
