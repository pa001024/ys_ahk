const { createApp, ref, watch } = Vue

const baseURL = location.pathname.endsWith("/") ? location.pathname : location.pathname + "/"

function io(roomId, playerName) {
    class ioClient {
        constructor(roomId, playerName) {
            this.reconnect(roomId, playerName)
        }
        reconnect(roomId, playerName) {
            if (this.ws) this.ws.close()
            let url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/?room=${roomId}&user=${playerName}`
            console.log("[io] connect to", url)
            this.ws = new WebSocket(url)
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data)
                if (data.event) {
                    this.ws.dispatchEvent(new CustomEvent(data.event, { detail: data }))
                }
            }
            this.ws.onclose = () => {
                console.info("[io] disconnected")
                setTimeout(() => {
                    this.reconnect(roomId, playerName)
                }, 1)
            }
            this.on("joined", (id) => {
                this.id = id
                console.info("[io] connected:", id)
            })
            this.events.pop()
            this.events.forEach(({ event, handler }) => {
                this.ws.addEventListener(event, handler)
            })
        }
        emit(event, data) {
            this.ws.send(JSON.stringify({ event, data }))
        }
        events = []
        on(event, callback) {
            let handler = (event) => {
                callback(event.detail.data)
            }
            this.events.push({ event, handler })
            this.ws.addEventListener(event, handler)
        }
        wait(event) {
            return new Promise((resolve) => {
                const handler = (e) => {
                    this.ws.removeEventListener(event, handler)
                    resolve(e.detail.data)
                }
                this.ws.addEventListener(event, handler)
            })
        }
    }
    return new ioClient(roomId, playerName)
}

window.addEventListener("online", handleNetworkStatusChange)
window.addEventListener("offline", handleNetworkStatusChange)

function handleNetworkStatusChange(event) {
    if (navigator.onLine && window.vc) {
        window.vc.connect() // 网络恢复时尝试重连
    }
}
async function voicechat(socket, denoise) {
    let stream = await navigator.mediaDevices.getUserMedia({
        audio: true, // 请求音频访问权限
        video: false,
    })
    if (denoise) {
        await loadDenoise()
        stream = await initAudioData(stream)
    }
    let pc = await rtc(socket, stream)
    console.log("[rtc] pc", pc)
    return pc
}

function rtc(socket, stream) {
    class RTCClient {
        constructor(socket) {
            this.audios = []
            this.socket = socket
            socket.on("offer", ({ sdp }) => this.answer(sdp))
            socket.on("answer", ({ sdp }) => this.pc.setRemoteDescription(sdp))
            socket.on("candidate", ({ candidate }) => this.addCandidate(candidate))
            socket.on("join_rtc", () => this.offer())
        }
        async offer() {
            const offer = await this.pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false,
            })
            await this.pc.setLocalDescription(offer)
            socket.emit("offer", offer)
        }
        async answer(desc) {
            await this.pc.setRemoteDescription(desc)
            const answer = await this.pc.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false,
            })
            await this.pc.setLocalDescription(answer)
            socket.emit("answer", answer)
        }
        async addCandidate(candidate) {
            await this.pc.addIceCandidate(new RTCIceCandidate(candidate))
        }
        addStream(stream) {
            this.pc.addTrack(stream.getTracks()[0], stream)
        }
        close() {
            this.pc.close()
            this.audios.forEach(({ audio, stream }) => {
                audio.pause()
                audio.srcObject = null
                audio.remove()
            })
        }
        async connect() {
            this.pc = new RTCPeerConnection({
                iceServers: [{ urls: "turn:xn--chq26veyq.icu:3478?transport=tcp", username: "rtc", credential: "rtc" }],
            })
            this.pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit("candidate", event.candidate)
                }
            }
            this.pc.ontrack = (event) => {
                console.log("[rtc] ontrack", event)
                const stream = event.streams[0]
                const audio = new Audio()
                this.audios.push({ audio, stream })
                audio.autoplay = true
                audio.srcObject = stream
                document.body.appendChild(audio)
            }
            this.addStream(stream)
            return this
        }
    }
    let pc = new RTCClient(socket)
    return pc.connect()
}

let loadJS = (function () {
    let loaded = []
    return function loadJS(lib) {
        if (loaded.includes(lib)) return Promise.resolve(lib)
        return new Promise((resolve, reject) => {
            let script = document.createElement("script")
            script.src = lib
            script.onload = function () {
                loaded.push(lib)
                resolve(lib)
            }
            document.body.appendChild(script)
        })
    }
})()

async function loadDenoise() {
    await loadJS("/js/denoise.js")
}

createApp({
    setup() {
        const roomId = ref((location.pathname.match(/\/[A-Za-z0-9]+$/) || "/")[0].substr(1) || "default")
        const formRoomType = ref("public")
        const formRoomId = ref("")
        const formPlayer = ref({ name: "", flag: 0 })
        const player = ref({ name: "", flag: 0 })
        try {
            if (localStorage.getItem("player")) formPlayer.value = player.value = JSON.parse(localStorage.getItem("player"))
        } catch (e) {}
        const socket = player.value.name ? io(roomId.value, player.value.name) : {}
        const showSetting = ref(!player.value.name)
        const nowSeconds = ref(~~(Date.now() / 1000))
        let timeOffset = 0
        setInterval(() => (nowSeconds.value = ~~((Date.now() + timeOffset) / 1000)), 1e3)
        const newUid = ref("")
        const room = ref({
            // props
            current: [],
            history: [],
            pending: [],
            msgs: [],
            activities: [],
            onlineCount: 0,
            maxClient: 0,
            uidCount: 0,
            mode: "normal",
        })
        const follow = ref({ user: "", time: 0, enable: false })
        const count = ref({ tip: 0, ct: true, value: -1 })
        try {
            const countValue = JSON.parse(localStorage.getItem("count"))
            if (countValue) {
                if (typeof countValue === "number") count.value.value = countValue
                else if (typeof countValue === "object") Object.assign(count.value, countValue)
            }
        } catch (e) {}
        const isMicOn = ref(false)

        const updateData = (data) => {
            Object.assign(room.value, data)
            if (data.activities) {
                // 需要从当前列表中删除已开始的活动
                const ids = new Set(data.activities.map((item) => item.id))
                const ex = new Set(room.value.current.map((item) => item.id).filter((id) => ids.has(id)))
                if (ex.size) {
                    room.value.history = [
                        //
                        ...room.value.history.filter((item) => !ex.has(item.id)),
                        ...data.activities.filter((item) => ex.has(item.id)).map((v) => ({ ...v, user: v.owner, ...room.value.current.find((i) => i.id == v.id) })),
                    ]
                    room.value.current = room.value.current.filter((item) => !ex.has(item.id))
                }
            }
        }
        const updateUidList = async () => {
            if (socket.id || !player.value.name) return
            const response = await fetch(baseURL + "uid")
            const data = await response.json()
            updateData(data)
            scrollToBottom(true)
        }

        const mixMsgList = () => [...room.value.history, ...room.value.msgs].sort((a, b) => a.time - b.time)

        const scrollToBottom = (force = false) => {
            const list = document.querySelector(".msg-list")
            if (list && list.scrollTop >= list.scrollHeight * 0.8 - list.clientHeight) {
                Vue.nextTick(() => {
                    list.scrollTop = list.scrollHeight
                })
            }
        }
        setTimeout(updateUidList, 1000)
        setInterval(updateUidList, 10000)

        if (socket.on) {
            socket.on("connect", () => {
                console.info("[io] connected:", socket.id)
            })
            socket.on("disconnect", () => {
                console.info("[io] disconnected")
            })
            socket.on("update", (data) => {
                console.info("[io] update:", data)
                updateData(data)
                scrollToBottom()
            })
            socket.on("sync", (t) => {
                timeOffset = t - Date.now()
            })
            socket.on("reload", () => {
                location.reload()
            })
        }

        const formatTimeDiff = (diff, subfix = "前") => {
            const minute = ~~(diff / 60)
            const second = diff % 60
            return `${minute}分${second}秒${subfix}`
        }
        const formatTime = (time, subfix = "前") => {
            const diff = nowSeconds.value - time
            if (diff <= 0) return "刚刚"
            if (diff > 24 * 3600) return new Date(time * 1000).toLocaleString("zh")
            if (diff > 3600) return new Date(time * 1000).toLocaleTimeString("zh")
            return formatTimeDiff(diff, subfix)
        }
        const renderUserName = (user) => (user !== player.value.name ? user : "你")
        const joinRoom = async () => {
            const rt = formRoomType.value
            const fp = formPlayer.value
            if (rt === "public") {
                if (fp.name) {
                    player.value = { name: fp.name.substring(0, 12), flag: fp.flag }
                    localStorage.setItem("player", JSON.stringify(player.value))
                    location.href = "/"
                } else {
                    alert("请输入昵称")
                }
            } else if (rt === "private") {
                if (formRoomId.value) {
                    location.href = "/r/" + formRoomId.value
                } else {
                    alert("请输入房间号")
                }
            }
        }
        const copyText = async (text) => {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text)
                return
            }
            const input = document.createElement("textarea")
            input.value = text
            input.style.position = "fixed"
            input.style.opacity = "0"
            document.body.appendChild(input)
            input.focus()
            input.select()
            const result = document.execCommand("copy")
            input.remove()
            if (!result) throw new Error("复制失败")
        }
        const removeUid = async (uid) => {
            if (socket.id) {
                socket.emit("del_uid", uid)
            } else {
                await fetch(baseURL + "del/" + uid)
            }
        }

        const addUid = async (text) => {
            // 内置指令
            if (text.startsWith("/")) {
                const cmd = text.slice(1).split(" ")
                // 计数器
                let isCt = false
                switch (cmd[0]) {
                    case "ct":
                    case "count-time":
                        isCt = true
                    case "c":
                    case "count":
                    case "s":
                    case "stop":
                        const value = cmd[0] === "s" || cmd[0] === "stop" ? -1 : +cmd[1] || 0
                        count.value.value = value
                        count.value.ct = isCt
                        localStorage.setItem("count", value)
                        room.value.msgs.push({
                            id: Math.random().toString(36).substr(3),
                            user: player.value.name,
                            text: value < 0 ? `<count-stop>` : `<count>`,
                            time: Math.floor(Date.now() / 1000),
                        })
                        scrollToBottom()
                        break
                    case "f":
                    case "follow":
                        const user = cmd[1] || ""
                        follow.value = { user, time: 0, enable: true }
                        break
                    case "u":
                    case "user":
                        room.value.msgs.push({
                            id: Math.random().toString(36).substr(3),
                            user: player.value.name,
                            text: `<users>`,
                            time: Math.floor(Date.now() / 1000),
                        })
                        scrollToBottom()
                        break
                    case "mode":
                        const mode = cmd[1] || "normal"
                        room.value.mode = mode
                        socket.emit("set_mode", mode)
                        break
                    case "clear":
                        socket.emit("clear_uid")
                        break
                }
            } else {
                if (socket.id) {
                    socket.emit("add_uid", text)
                } else {
                    await fetch(baseURL + "add/" + text + `?cooker=${player.value.name}&flag=${player.value.flag}`)
                    if (/^\d{9}?$/.test(text)) {
                        if (room.value.current.includes(text)) return
                        if (room.value.history.some((item) => item.uid == text)) {
                            room.value.history.splice(
                                room.value.history.find((item) => item.uid == text),
                                1
                            )
                        }
                    } else {
                        room.value.msgs.push({
                            id: Math.random().toString(36).substr(3),
                            user: player.value.name,
                            text,
                            time: Math.floor(Date.now() / 1000),
                        })
                        scrollToBottom()
                    }
                }
            }
        }
        const submitInput = () => {
            const text = newUid.value.trim()
            if (text) {
                addUid(text)
                newUid.value = ""
            }
        }
        const addActivity = async (id) => {
            function copyAct(act) {
                copyText(act.uid)
                // 关注
                if (act.owner !== player.value.name && !follow.value.enable) {
                    follow.value = { user: act.owner, time: nowSeconds.value + 15, enable: false }
                }
            }
            const act = room.value.activities.find((item) => item.id == id)
            if (act) {
                if (act.owner === player.value.name) {
                    if (socket.id) {
                        socket.emit("del_act", { id })
                    } else {
                        fetch(baseURL + "act/" + id + `?user=${player.value.name}&flag=${player.value.flag}`)
                    }
                    const timeUsed = nowSeconds.value - act.time
                    if (timeUsed > 45) {
                        if (count.value.value >= 0) {
                            ++count.value.value
                            localStorage.setItem("count", JSON.stringify(count.value))
                            if (count.value.ct) {
                                socket.emit("add_uid", `自动计数: ${count.value.value} (${formatTimeDiff(timeUsed, "")}) (输入/ct开启)`)
                            } else {
                                socket.emit("add_uid", `自动计数: ${count.value.value} (输入/c开启)`)
                            }
                        } else {
                            count.value.tip = nowSeconds.value + 10
                        }
                    }
                    return
                }
                if (act.users.includes(player.value.name)) {
                    copyAct(act)
                    return
                }
            }
            if (socket.id) {
                socket.emit("add_act", { id, flag: player.value.flag })
                const act = await socket.wait("act_ok")
                copyAct(act)
            } else {
                await fetch(baseURL + "act/" + id + `?user=${player.value.name}&flag=${player.value.flag}`)
            }
            return
        }

        return {
            roomId,
            showSetting,
            formRoomType,
            formRoomId,
            formPlayer,
            player,
            nowSeconds,
            room,
            newUid,
            follow,
            count,
            isMicOn,
            toggleMic: async () => {
                isMicOn.value = !isMicOn.value
                if (isMicOn.value) {
                    window.vc = await voicechat(socket, confirm("是否开启降噪?"))
                    socket.emit("join_rtc")
                } else {
                    window.vc?.close()
                    window.vc = null
                    socket.emit("leave_rtc")
                }
            },
            joinRoom,
            removeUid,
            copyText,
            addUid,
            submitInput,
            formatTime,
            mixMsgList,
            addActivity,
            renderUserName,
            maskUid: (uid) => uid.slice(0, 3) + "***" + uid.slice(6),
            idToColor: (id) => {
                let hash = 0,
                    i,
                    chr
                if (id.length === 0) return hash
                for (i = 0; i < id.length; i++) {
                    chr = id.charCodeAt(i)
                    hash = (hash << 5) - hash + chr
                    hash |= 0 // Convert to 32bit integer
                }
                return hash % 360
            },
            translateTag: (tag, msg) => {
                const table = {
                    "<enter>": `${msg.user}进入了房间`,
                    "<leave>": `${msg.user}离开了房间`,
                    "<rtcjoin>": `${msg.user}加入了语音通话`,
                    "<rtcleave>": `${msg.user}离开了语音通话`,
                    "<count>": `已设置计数为${count.value.value} (输入/s停止)`,
                    "<count-stop>": `已停止自动计数`,
                    "<users>": `当前在线用户: ${Object.keys(room.value.onlineUsers).join(", ")}`,
                }
                return table[tag] || tag
            },
            setCmd(cmd, send = false) {
                newUid.value = cmd
                if (send) submitInput()
                else document.querySelector(".ys-input").focus()
            },
        }
    },
}).mount("#app")
