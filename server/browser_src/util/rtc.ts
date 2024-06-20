import { EventSign, SocketIO } from "./socket"

export class RTCClient {
    connMap: Map<string, RTCConnection>
    rtc_ask: EventSign
    rtc_leave: EventSign
    constructor(public socket: SocketIO, public closeableStream: MediaStream, public localStream?: MediaStream) {
        this.localStream = localStream || closeableStream
        this.connMap = new Map()
        this.rtc_ask = socket.on("rtc_ask", (from) => this.createConnection(from))
        this.rtc_leave = socket.on("rtc_leave", (from) => this.get(from)?.close())
        this.connect()
    }
    get(id: string) {
        return this.connMap.get(id)
    }
    async connect() {
        this.socket.emit("rtc_join")
        const sessions = await this.socket.wait<string[]>("rtc_ok")
        for (const session of sessions) {
            let conn = this.createConnection(session)
            conn.offer()
        }
    }

    createConnection(from: string) {
        const conn = new RTCConnection(this.socket, from, this.localStream!)
        this.connMap.set(from, conn)
        conn.ondisconnect = () => {
            console.log("[rtc] connection closed", from)
            conn.close()
            this.connMap.delete(from)
        }
        return conn
    }
    dispose() {
        this.closeableStream.getTracks().forEach((track) => track.stop())
        this.connMap.forEach((conn) => conn.close())
        this.connMap.clear()
        this.socket.off(this.rtc_ask)
        this.socket.off(this.rtc_leave)
        this.socket.emit("rtc_leave")
    }
}

class RTCConnection {
    pc!: RTCPeerConnection
    audios: { audio: HTMLAudioElement; stream: MediaStream }[] = []
    ondisconnect = () => {}
    rtc_offer: EventSign
    rtc_answer: EventSign
    rtc_candidate: EventSign
    constructor(public socket: SocketIO, public to: string, public localStream: MediaStream) {
        this.rtc_offer = socket.onFrom(to, "rtc_offer", (sdp) => this.answer(sdp))
        this.rtc_answer = socket.onFrom(to, "rtc_answer", (sdp) => this.end(sdp))
        this.rtc_candidate = socket.onFrom(to, "rtc_candidate", (candidate) => this.addCandidate(candidate))

        this.connect()
    }
    send(ev: string, data: any) {
        this.socket.sendto(this.to, ev, data)
    }
    async offer() {
        const offer = await this.pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false,
        })
        await this.pc.setLocalDescription(offer)
        this.send("rtc_offer", offer)
    }
    async answer(desc: RTCSessionDescriptionInit) {
        await this.pc.setRemoteDescription(desc)
        const answer = await this.pc.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false,
        })
        await this.pc.setLocalDescription(answer)
        this.send("rtc_answer", answer)
    }
    async end(sdp: RTCSessionDescriptionInit) {
        if (this.pc.signalingState === "stable") {
            await new Promise<void>((resolve) => {
                const handler = () => {
                    if (this.pc.signalingState !== "stable") {
                        this.pc.removeEventListener("signalingstatechange", handler)
                        resolve()
                    }
                }
                this.pc.addEventListener("signalingstatechange", handler)
            })
        }
        await this.pc.setRemoteDescription(sdp)
    }
    async addCandidate(candidate: RTCIceCandidateInit) {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate))
    }
    close() {
        this.socket.off(this.rtc_offer)
        this.socket.off(this.rtc_answer)
        this.socket.off(this.rtc_candidate)
        this.pc.close()
        this.audios.forEach(({ audio, stream }) => {
            audio.pause()
            audio.srcObject = null
            stream.getTracks().forEach((track) => track.stop())
        })
        this.audios = []
    }
    async connect() {
        this.pc = new RTCPeerConnection({
            iceServers: [{ urls: "turn:xn--chq26veyq.icu:3478?transport=tcp", username: "rtc", credential: "rtc" }],
        })
        this.pc.onicecandidate = (event) => {
            if (event.candidate) this.send("rtc_candidate", event.candidate)
        }
        this.pc.ontrack = (event) => {
            const stream = event.streams[0]
            const audio = new Audio()
            this.audios.push({ audio, stream })
            audio.autoplay = true
            audio.srcObject = stream
        }
        this.pc.onconnectionstatechange = () => {
            if (!this.ondisconnect) return
            if (this.pc.connectionState === "disconnected") this.ondisconnect()
        }

        this.localStream.getTracks().forEach((track) => this.pc.addTrack(track, this.localStream))
    }
}

export async function voiceChat(socket: SocketIO) {
    let closeableStream = await navigator.mediaDevices.getUserMedia({
        audio: {
            channelCount: { ideal: 1 },
            noiseSuppression: { ideal: true },
            echoCancellation: { ideal: true },
            autoGainControl: { ideal: true },
            sampleRate: { ideal: 48000 },
        }, // 请求音频访问权限
    })
    let localStream
    // if (denoise) {
    //     await loadJS("/js/denoise.js")
    //     localStream = await connectDenoise(closeableStream)
    // }
    let rtc = new RTCClient(socket, closeableStream, localStream)
    console.log("[rtc]", rtc)
    return rtc
}
