<script setup lang="ts">
import { ref, watchEffect } from "vue"
import gsap from "gsap"
import { useTranslation } from "i18next-vue"
import SidebarButton from "./SidebarButton.vue"
import { useState } from "../mod/state"
import { useUIStore } from "../mod/state/ui"
import type { IconTypes } from "../components/Icon.vue"
import { env } from "../env"

const { t } = useTranslation()
const target = ref<HTMLDivElement | null>(null)

const tabs = (
    [
        {
            name: "home",
            path: "/",
            icon: "la:bookmark",
        },
        {
            name: "game",
            path: "/game",
            icon: "la:gamepad-solid",
            if: env.isApp,
        },
        {
            name: "chat",
            path: "/chat",
            icon: "la:comment-alt",
        },
        // {
        //     name: "map",
        //     path: "/map",
        //     icon: LiaMap,
        // },
        {
            name: "user",
            path: "/user",
            icon: "la:user",
        },
    ] satisfies { name: string; path: string; icon: IconTypes; if?: boolean }[]
).filter((tab) => tab.if !== false)
const UI = useUIStore()
const [expand, setExpand] = useState(UI, "sidebarExpand")
watchEffect(() => {
    if (target.value) gsap.to(target.value, { duration: 0.3, width: expand.value ? "13rem" : "3.5rem", ease: "back" })
})
</script>
<template>
    <div class="flex h-full">
        <!-- <div class="flex-none scrollbar-hide"> -->
        <div ref="target" class="flex flex-col space-y-1 py-2 px-2 h-full">
            <button class="w-full btn btn-ghost border-none justify-start min-h-fit h-auto flex-nowrap whitespace-nowrap px-0 gap-1 overflow-hidden" @click="setExpand(!expand)">
                <span class="flex-none w-10 h-8 items-center justify-center text-lg text-base-content/50 swap swap-flip" :class="{ 'swap-active': expand }">
                    <Icon icon="tabler:arrow-bar-to-left" class="swap-on" />
                    <Icon icon="tabler:arrow-bar-to-right" class="swap-off" />
                </span>
                <div class="font-medium text-xs text-base-content/50 leading-none">
                    {{ t("main.btn_collapse_menu") }}
                </div>
            </button>
            <SidebarButton v-for="tab in tabs" :to="tab.path" :key="tab.name" :tooltip="t(`${tab.name}.title`)">
                <Icon :icon="tab.icon" />
            </SidebarButton>
            <div class="flex-1" data-tauri-drag-region></div>
            <SidebarButton to="/setting" :tooltip="t(`setting.title`)">
                <Icon icon="la:cog-solid" />
            </SidebarButton>
        </div>
        <!-- </div> -->
    </div>
</template>
