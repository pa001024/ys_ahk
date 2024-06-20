<template>
    <header>
        <div class="menu-list flex-box w100">
            <div class="menu-item player-name">
                {{ room.mode === "melt" ? "🔥" : "" }}
                {{ roomId === "default" ? "万民堂" : roomId }}
                <span style="font-size: 12rem; color: #999">({{ room.clientCount }} / {{ room.maxClient }}) ~{{ room.count }}份</span>
            </div>
            <div class="menu-item flex-box">
                <div class="username">{{ player.name }}</div>
                <button type="button" class="ys-btn" @click="showSetting = !showSetting">设置</button>
            </div>
        </div>
    </header>
    <article v-if="!showSetting" class="public-room vertical-box">
        <div class="uid-list">
            <transition-group name="list" tag="ul">
                <li
                    class="ys-list-item"
                    v-for="item in activeItems"
                    :key="item.id"
                    :style="{ '--h': idToColor(item.id) }"
                    :class="{ active: item.users?.includes(player.name) }"
                    @click="item.users?.includes(player.name) && copyText(item.uid)"
                >
                    <div class="content">
                        <div class="cooker">
                            <div class="tag joined" v-if="item.users?.includes(player.name)">已加入</div>
                            <div class="tag" v-else-if="item.owner">已开始</div>
                            {{ item.owner || item.cooker }}
                        </div>
                        <div class="uid">UID: {{ item.users?.includes(player.name) ? item.uid : maskUid(item.uid) }}</div>
                        <div class="uid-hover" v-if="player.name === item.owner && item.status === 'success'">
                            <div class="uid-img" v-if="item.img"><img :src="'data:image/png;base64,' + item.img" alt="uid" /></div>
                            <div class="level"><b>Lv. </b>{{ item.lv }}</div>
                            <div class="name"><b>昵称: </b>{{ item.name }}</div>
                            <div class="sign"><b>签名: </b>{{ item.sign }}</div>
                            <div class="chat">
                                对话内容:
                                <div class="chat-item" v-for="(chat, index) in item.chat" :key="index">{{ chat }}</div>
                            </div>
                        </div>
                    </div>
                    <div class="detail">
                        <ul class="users">
                            <li class="uname" v-for="user in item.users?.slice(1)" :key="user">{{ user }}</li>
                        </ul>
                        <div class="time" v-if="item.owner">⚔️{{ formatTime(item.time, "") }}</div>
                        <div class="time" v-else>⏳{{ formatTime(item.cookTime) }}</div>
                    </div>
                    <div class="box">
                        <div class="num" v-if="item.owner">{{ item.users?.length + 1 }} / 4</div>
                        <button
                            type="button"
                            class="ys-btn"
                            :disabled="!item.users?.includes(player.name) && !(!item.req || item.req & player.flag)"
                            @click.stop="addActivity(item.id)"
                        >
                            {{ item.owner ? (item.owner === player.name ? "结束" : "加入") : "匹配" }}
                        </button>
                    </div>
                </li>
                <li v-for="item in room.pending" :key="item.id" class="ys-list-item" :style="{ '--h': idToColor(item.id) }">
                    <div class="content">
                        <div class="cooker">
                            <div class="tag pending">未确认</div>
                            {{ item.cooker }}
                        </div>
                        <div class="uid">UID: {{ item.uid }}</div>
                        <div class="uid-hover">
                            <div class="uid-img" v-if="item.img"><img :src="'data:image/png;base64,' + item.img" alt="uid" /></div>
                            <div class="level"><b>Lv. </b>{{ item.lv }}</div>
                            <div class="name"><b>昵称: </b>{{ item.name }}</div>
                            <div class="sign"><b>签名: </b>{{ item.sign }}</div>
                            <div class="chat">
                                对话内容:
                                <div class="chat-item" v-for="(chat, index) in item.chat" :key="index">{{ chat }}</div>
                            </div>
                        </div>
                    </div>
                    <div class="detail">
                        <ul class="users"></ul>
                        <div class="time">⏳{{ formatTime(item.cookTime) }}</div>
                    </div>
                    <div class="ys-btn-group">
                        <button type="button" class="ys-btn" @click="removeUid(item.uid)">忽略</button>
                        <button type="button" class="ys-btn checked" @click="addUid(item.uid)">确认</button>
                    </div>
                </li>
            </transition-group>
        </div>
        <div class="follow" v-if="follow.user && follow.enable">
            已隐藏除{{ follow.user }}外的其他匹配
            <button type="button" class="ys-btn xs" @click="follow.enable = false">取消</button>
        </div>
        <div class="follow" v-if="follow.user && nowSeconds < follow.time && !follow.enable">
            是否关注{{ follow.user }}
            <button type="button" class="ys-btn xs" @click="follow.enable = true">关注</button>
        </div>
        <div class="follow" v-if="nowSeconds < count.tip && count.value < 0">
            开启自动计数
            <button type="button" class="ys-btn xs" @click="count.value = 1">开启</button>
        </div>

        <div class="msg-list flex-1">
            <ul>
                <li class="ys-msg-item" :key="msg.id" v-for="(msg, index) in mixMsgList">
                    <div class="content banner" v-if="msg.cookTime">
                        <div class="tip" v-if="msg.user !== msg.cooker">{{ renderUserName(msg.user) }}使用了{{ msg.cooker }}的{{ msg.uid }}</div>
                        <div class="tip" v-else>{{ renderUserName(msg.user) }}开始匹配{{ msg.uid }}</div>
                        <div class="time">{{ formatTime(msg.time) }}</div>
                    </div>
                    <div class="content banner" v-else-if="translateTag(msg.text, msg) !== msg.text">
                        <div class="tip">{{ translateTag(msg.text, msg) }}</div>
                        <div class="time">{{ formatTime(msg.time) }}</div>
                    </div>
                    <div class="content" v-else>
                        <div class="user">{{ renderUserName(msg.user) }}</div>
                        <div class="text" @click="msg.text.includes('(点击加入列表)') && addUid(msg.text.match(/\d{9}/g)[0])">
                            {{ msg.text }}
                        </div>
                        <div class="time">{{ formatTime(msg.time) }}</div>
                    </div>
                    <div class="flex-1"></div>
                </li>
            </ul>
        </div>
        <form @submit.prevent="submitInput" class="flex-box msg-form">
            <VoiceChat :rtcSessions="room.rtcSessions" :socket="socket"></VoiceChat>
            <div class="ys-autocomplete flex-1">
                <ul v-show="newUid.startsWith('/')">
                    <li @click="setCmd('/c 1')">/c[ount] &lt;当前计数&gt; - 自动计数</li>
                    <li @click="setCmd('/ct 1')">/ct &lt;当前计数&gt; - 自动计数并计时</li>
                    <li @click="setCmd('/s', true)">/s[top] - 停止计数</li>
                    <li @click="setCmd('/u', true)">/u[ser] - 显示用户列表</li>
                    <li @click="setCmd('/f ')">/f[ollow] &lt;用户名&gt; - 关注指定用户</li>
                    <li @click="setCmd('/mode melt')">/mode normal|melt - 设置子频道模式</li>
                    <li @click="setCmd('/clear', true)">/clear - 清空列表</li>
                </ul>
                <input type="text" class="ys-input flex-1" v-model="newUid" placeholder="输入消息或UID..." />
            </div>
            <button type="submit" class="ys-btn ml-0">发送</button>
        </form>
    </article>
    <article v-else class="welcome">
        <div class="ys-btn-group">
            <button type="button" class="ys-btn" :class="{ checked: formRoomType === 'public' }" @click="formRoomType = 'public'">万民堂</button>
            <button type="button" class="ys-btn" :class="{ checked: formRoomType === 'private' }" @click="formRoomType = 'private'">新月轩</button>
        </div>
        <input class="ys-input" type="text" v-model="formPlayer.name" placeholder="请输入昵称" />
        <div class="ys-btn-group" v-if="formRoomType === 'public'">
            <button type="button" class="ys-btn" :class="{ checked: 1 & formPlayer.flag }" @click="formPlayer.flag = 1 ^ formPlayer.flag">龙</button>
            <button type="button" class="ys-btn" :class="{ checked: 2 & formPlayer.flag }" @click="formPlayer.flag = 2 ^ formPlayer.flag">芙</button>
            <button type="button" class="ys-btn" :class="{ checked: 4 & formPlayer.flag }" @click="formPlayer.flag = 4 ^ formPlayer.flag">万</button>
            <!-- <button type="button" class="ys-btn" :class="{ checked: 8 & formPlayer.flag }" @click="formPlayer.flag = 8 ^ formPlayer.flag">淹</button> -->
        </div>
        <input v-if="formRoomType === 'private'" class="ys-input" type="text" v-model="formRoomId" placeholder="房间号" />
        <button type="button" class="ys-btn" @click="joinRoom">加入</button>
        <a class="link center" href="https://beian.miit.gov.cn" target="_blank">浙ICP备2024097919号-1</a>
    </article>
</template>
<script setup lang="ts">
import { ref, watch, nextTick, computed, reactive } from "vue"
import { SocketIO } from "../util/socket"
import { SoundEffect } from "../util/soundeffect"
import VoiceChat from "./VoiceChat.vue"
import type { IMessage, IRoom, IRoomActivity } from "../../src/rt/room"

// extenals
const baseURL = location.pathname.endsWith("/") ? location.pathname : location.pathname + "/"
const se = new SoundEffect()

// ref
const roomId = ref((location.pathname.match(/\/[A-Za-z0-9]+$/) || "/")[0].substr(1) || "default")
const formRoomType = ref("public")
const formRoomId = ref("")
const formPlayer = ref({ name: "", flag: 0 })
const player = ref({ name: "", flag: 0 })
if (localStorage.getItem("player")) formPlayer.value = player.value = JSON.parse(localStorage.getItem("player")!)
const socket = player.value.name ? new SocketIO(roomId.value, player.value.name) : ({} as SocketIO)
const showSetting = ref(!player.value.name)
const nowSeconds = ref(~~(Date.now() / 1000))
let timeOffset = 0
setInterval(() => (nowSeconds.value = ~~((Date.now() + timeOffset) / 1000)), 1e3)
const newUid = ref("")
const room = reactive({
    // props
    id: "",
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
const follow = reactive({ user: "", time: 0, enable: false })
const count = ref({ tip: 0, ct: true, value: -1 })

// computed
const mixMsgList = computed(() => [...room.history, ...room.msgs].sort((a, b) => a.time - b.time) as any)
const activeItems = computed(() => {
    if (follow.user && follow.enable) return room.activities.filter((activity) => activity.owner === follow.user || activity.users.includes(follow.user))
    else return [...room.activities, ...room.current] as any[]
})

watch(
    () => room.activities,
    (newVal, oldVal) => {
        if (!newVal.length || !follow.user || !follow.enable) return
        const idnew = newVal.filter((item) => item.owner === follow.user || item.users.includes(follow.user)).map((item) => item.id)
        const idold = new Set(oldVal.map((item) => item.id))
        if (idnew.some((id) => !idold.has(id))) se.notice()
    }
)

// methods

try {
    const countValue = JSON.parse(localStorage.getItem("count")!)
    if (countValue) {
        if (typeof countValue === "number") count.value.value = countValue
        else if (typeof countValue === "object") Object.assign(count.value, countValue)
    }
} catch (e) {}

// init
setTimeout(fetchData, 1000)
setInterval(fetchData, 10000)

function updateData(data: Partial<IRoom>) {
    Object.assign(room, data)
    if (data.activities) {
        // 需要从当前列表中删除已开始的活动
        const ids = new Set(data.activities.map((item) => item.id))
        const ex = new Set(room.current.map((item) => item.id).filter((id) => ids.has(id)))
        if (ex.size) {
            // @ts-ignore
            room.history = [
                //
                ...room.history.filter((item) => !ex.has(item.id)),
                ...data.activities.filter((item) => ex.has(item.id)).map((v) => ({ ...v, user: v.owner, ...room.current.find((i) => i.id == v.id) })),
            ]
            room.current = room.current.filter((item) => !ex.has(item.id))
        }
    }
}
async function fetchData() {
    if (socket.id || !player.value.name) return
    const response = await fetch(baseURL + "uid")
    const data = await response.json()
    updateData(data)
    scrollToBottom(true)
}

function scrollToBottom(force = false) {
    const list = document.querySelector(".msg-list")
    if (list && list.scrollTop >= list.scrollHeight * 0.8 - list.clientHeight) {
        nextTick(() => (list.scrollTop = list.scrollHeight))
    }
}

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
    socket.on("msg", (msg) => {
        room.msgs.push(msg)
        scrollToBottom()
    })
    socket.on("reload", () => {
        location.reload()
    })
    socket.on("reload_css", (path) => {
        console.log("reload_css", path)
        const styles = document.querySelectorAll(`link[rel="stylesheet"]`) as NodeListOf<HTMLLinkElement>
        const css = [...styles].find((item) => item.href.includes(path))
        if (css) {
            css.href += "?v=" + Date.now()
        }
    })
}

function formatTimeDiff(diff: number, subfix = "前") {
    const minute = ~~(diff / 60)
    const second = diff % 60
    return `${minute}分${second}秒${subfix}`
}
function formatTime(time: number, subfix = "前") {
    const diff = nowSeconds.value - time
    if (diff <= 0) return "刚刚"
    if (diff > 24 * 3600) return new Date(time * 1000).toLocaleString("zh")
    if (diff > 3600) return new Date(time * 1000).toLocaleTimeString("zh")
    return formatTimeDiff(diff, subfix)
}
const renderUserName = (user: string) => (user !== player.value.name ? user : "你")
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
const copyText = async (text: string) => {
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
const removeUid = async (uid: string) => {
    if (socket.id) {
        socket.emit("del_uid", uid)
    } else {
        await fetch(baseURL + "del/" + uid)
    }
}

const addUid = async (text: string) => {
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
                localStorage.setItem("count", String(value))
                room.msgs.push({
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
                follow.user = user
                follow.enable = true
                follow.time = 0
                break
            case "u":
            case "user":
                room.msgs.push({
                    id: Math.random().toString(36).substr(3),
                    user: player.value.name,
                    text: `<users>`,
                    time: Math.floor(Date.now() / 1000),
                })
                scrollToBottom()
                break
            case "mode":
                const mode = cmd[1] || "normal"
                if (mode === "melt" || mode === "normal") {
                    room.mode = mode
                    socket.emit("set_mode", mode)
                }
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
                if (room.current.some((item) => item.uid == text)) return
                if (room.history.some((item) => item.uid == text)) {
                    room.history.splice(
                        room.history.findIndex((item) => item.uid == text),
                        1
                    )
                }
            } else {
                room.msgs.push({
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
const addActivity = async (id: string) => {
    function copyAct(act: IRoomActivity) {
        copyText(act.uid)
        // 关注
        if (act.owner !== player.value.name && !follow.enable) {
            Object.assign(follow, { user: act.owner, time: nowSeconds.value + 15, enable: false })
        }
    }
    const act = room.activities.find((item) => item.id == id)
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
        const act = (await socket.wait("act_ok")) as IRoomActivity
        copyAct(act)
    } else {
        await fetch(baseURL + "act/" + id + `?user=${player.value.name}&flag=${player.value.flag}`)
    }
    return
}

const maskUid = (uid: string) => uid.slice(0, 3) + "***" + uid.slice(6)
const idToColor = (id: string) => {
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
}
const translateTag = (tag: string, msg: IMessage) => {
    const table = {
        "<enter>": `${msg.user}进入了房间`,
        "<leave>": `${msg.user}离开了房间`,
        "<rtcjoin>": `${msg.user}加入了语音通话`,
        "<rtcleave>": `${msg.user}离开了语音通话`,
        "<count>": `已设置计数为${count.value.value} (输入/s停止)`,
        "<count-stop>": `已停止自动计数`,
        "<users>": `当前在线用户: ${Object.keys(room.onlineUsers).join(", ")}`,
    } as { [k: string]: string }
    return table[tag] || tag
}
const setCmd = (cmd: string, send = false) => {
    newUid.value = cmd
    if (send) submitInput()
    else (document.querySelector(".ys-input") as HTMLInputElement)?.focus()
}
</script>
