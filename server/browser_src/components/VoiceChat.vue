<script setup lang="ts">
const { rtcSessions, socket } = defineProps<{
    rtcSessions: { [key: string]: IRtcSession }
    socket: SocketIO
}>()
import { ref } from "vue"
import { voiceChat, RTCClient } from "../util/rtc"
import { SocketIO } from "../util/socket"
import type { IRtcSession } from "../../src/rt/room"

const isMicOn = ref(false)

let vc: RTCClient
const toggleMic = async () => {
    isMicOn.value = !isMicOn.value
    if (isMicOn.value) {
        vc = await voiceChat(socket)
    } else {
        vc?.dispose()
    }
}
</script>
<template>
    <div class="vc-container">
        <div class="vc-users" v-show="isMicOn">
            <div class="vc-users-item" v-for="user in rtcSessions" :key="user.id">
                {{ user.user }}
            </div>
        </div>
        <div class="ys-btn icon-btn" :class="{ checked: isMicOn }" @click="toggleMic">
            <svg class="icon icon-mic">
                <use xlink:href="#icon-mic" />
            </svg>
        </div>
    </div>
</template>
