<script setup lang="ts">
import { window } from "@tauri-apps/api"
import { invoke } from "@tauri-apps/api/core"
import { exit } from "@tauri-apps/plugin-process"
import { onMounted, onUnmounted, ref, watch, watchEffect } from "vue"
import { useSettingStore } from "../mod/state/setting"
import Tooltip from "./Tooltip.vue"
import Icon from "./Icon.vue"

const props = defineProps({
    title: { type: String },
    icon: { type: String, default: "/app-icon.png" },
    resizable: { type: Boolean, default: true },
    darkable: { type: Boolean, default: false },
    pinable: { type: Boolean, default: false },
    minimizable: { type: Boolean, default: true },
    maximizable: { type: Boolean, default: true },
    closable: { type: Boolean, default: true },
    draggable: { type: Boolean, default: true },
})

const appWindow = window.getCurrent()

watchEffect(() => {
    appWindow.setResizable(props.resizable)
})

const setting = useSettingStore()
const alwaysOnTop = ref(false)
const maximized = ref(false)
const isDark = ref(setting.theme === "dark")

watch(alwaysOnTop, (newValue) => {
    appWindow.setAlwaysOnTop(newValue)
})

watch(isDark, async (newValue) => {
    setting.theme = newValue ? "dark" : "light"
    setting.windowTrasnparent = !newValue
})

function handleMinimize() {
    appWindow.minimize()
}

async function handleMaximize() {
    const state = await appWindow.isMaximized()
    state ? appWindow.unmaximize() : appWindow.maximize()
}

function handleClose() {
    invoke("app_close").catch(() => exit())
}

async function handlePin() {
    await appWindow.setAlwaysOnTop(!alwaysOnTop.value)
    alwaysOnTop.value = !alwaysOnTop.value
}
let unlisten: Function

onMounted(async () => {
    unlisten = await appWindow.listen("tauri://resize", async () => {
        maximized.value = await appWindow.isMaximized()
    })
})

onUnmounted(() => {
    unlisten?.()
})
</script>
<template>
    <!-- Root -->
    <div class="relative w-screen h-screen flex overflow-hidden bg-base-100/40">
        <!-- SideBar -->
        <slot name="sidebar"></slot>

        <!-- Header -->
        <div className="relative flex flex-col overflow-hidden w-full h-full">
            <!-- ActionBar -->
            <div class="relative w-full h-10 pb-1 mt-1 flex items-center space-x-1 sm:space-x-2 pl-2 pr-1">
                <div :data-tauri-drag-region="draggable" className="pointer-events-none w-full h-full font-semibold text-2xl flex items-center space-x-2">
                    <img :src="icon" class="w-6 h-6" />
                    <span className="hidden sm:block text-sm">
                        {{ title }}
                    </span>
                </div>
                <!-- fix resize -->
                <div class="pointer-events-none flex-none opacity-0 self-start transition-none">
                    <div class="flex items-center space-x-2">
                        <label class="btn btn-ghost btn-sm btn-square swap swap-rotate" v-if="darkable">
                            <!-- this hidden checkbox controls the state -->
                            <input type="checkbox" class="theme-controller" value="dark" v-model="isDark" />

                            <!-- sun icon -->
                            <svg class="swap-off fill-current w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path
                                    d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"
                                />
                            </svg>

                            <!-- moon icon -->
                            <svg class="swap-on fill-current w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path
                                    d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"
                                />
                            </svg>
                        </label>
                        <button class="btn btn-ghost btn-sm btn-square"></button>
                        <button class="btn btn-ghost btn-sm btn-square disabled:bg-transparent" :disabled="!minimizable"></button>
                        <button class="btn btn-ghost btn-sm btn-square disabled:bg-transparent" :disabled="!maximizable"></button>
                        <button class="btn btn-ghost btn-sm btn-square"></button>
                    </div>
                </div>
                <!-- fix resize -->
                <div class="pointer-events-none fixed right-1 top-1">
                    <div class="flex pointer-events-auto items-center space-x-2">
                        <label class="btn btn-ghost btn-sm btn-square swap swap-rotate" v-if="darkable">
                            <!-- this hidden checkbox controls the state -->
                            <input type="checkbox" class="theme-controller" value="dark" v-model="isDark" />

                            <!-- sun icon -->
                            <svg class="swap-off fill-current w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path
                                    d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"
                                />
                            </svg>

                            <!-- moon icon -->
                            <svg class="swap-on fill-current w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path
                                    d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"
                                />
                            </svg>
                        </label>
                        <Tooltip side="bottom" :tooltip="alwaysOnTop ? $t('main.btn_unpin_window') : $t('main.btn_pin_window')">
                            <button class="btn btn-ghost btn-sm btn-square" @click="handlePin">
                                <Icon bold icon="ri:pushpin-2-fill" v-if="alwaysOnTop" />
                                <Icon bold icon="ri:pushpin-fill" v-else />
                            </button>
                        </Tooltip>
                        <button class="btn btn-ghost btn-sm btn-square disabled:bg-transparent" :disabled="!minimizable" @click="handleMinimize">
                            <Icon bold icon="codicon:chrome-minimize" />
                        </button>
                        <button class="btn btn-ghost btn-sm btn-square disabled:bg-transparent" :disabled="!maximizable" @click="handleMaximize">
                            <Icon bold icon="codicon:chrome-maximize" v-if="!maximized" />
                            <Icon bold icon="codicon:chrome-restore" v-else />
                        </button>
                        <button class="btn btn-ghost btn-sm btn-square" @click="handleClose">
                            <Icon bold icon="codicon:chrome-close" />
                        </button>
                    </div>
                </div>
            </div>
            <!-- Body -->
            <div :class="{ 'rounded-tl-box': !!$slots.sidebar }" class="w-full relative bg-base-200/50 flex-1 overflow-hidden">
                <slot></slot>
            </div>
        </div>
    </div>
</template>
