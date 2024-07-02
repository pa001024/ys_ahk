<script setup lang="ts">
import { watchEffect } from "vue"
import ResizeableWindow from "./components/ResizeableWindow.vue"
import { useSettingStore } from "./mod/state/setting"
import { useRoute } from "vue-router"
import { provideClient } from "@urql/vue"
import { gqClient } from "./mod/http/graphql"
const setting = useSettingStore()
const route = useRoute()
watchEffect(() => {
    document.body.setAttribute("data-theme", setting.theme)
    document.body.style.background = setting.windowTrasnparent ? "transparent" : ""
    document.documentElement.style.setProperty("--uiscale", String(setting.uiScale))
})

provideClient(gqClient)
</script>

<template>
    <ResizeableWindow :title="$t(`${String(route.name)}.title`)" darkable pinable>
        <RouterView v-slot="{ Component, route }">
            <transition name="slide-right">
                <KeepAlive v-if="route.meta.keepAlive">
                    <Suspense>
                        <component :is="Component" />
                        <template #fallback>
                            <div class="w-full h-full flex justify-center items-center">
                                <span class="loading loading-spinner loading-md"></span>
                            </div>
                        </template>
                    </Suspense>
                </KeepAlive>
                <component :is="Component" :key="route.path" v-else />
            </transition>
        </RouterView>
        <template #sidebar>
            <Sidebar />
        </template>
    </ResizeableWindow>
</template>

<style>
.slide-right-enter-active {
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-right-leave-active {
    transition: all 0.2s cubic-bezier(0.6, -0.28, 0.73, 0.04);
}

.slide-right-enter-from {
    opacity: 0;
    transform: translateX(-2rem);
}

.slide-right-leave-to {
    opacity: 0;
    transform: translateX(2rem);
}
</style>
