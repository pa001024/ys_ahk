<script lang="ts" setup>
import { computed, ref } from "vue"
import { provideRoomManager } from "../mod/http/room"
import { useSettingStore } from "../mod/state/setting"
import { gqClientWs } from "../mod/http/graphql"
import { provideClient } from "@urql/vue"

const setting = useSettingStore()
const rm = provideRoomManager(`${setting.endpoint}/ws?token=${setting.token}&name=${setting.name}`)
provideClient(gqClientWs(rm.ws.createGQWSClient()))

const search = ref("")
const newroom = ref("")
const actived = ref("a")
const fakeRooms = ref([
    {
        name: "a",
        msgCount: 111,
        lastMsg: "zayu: 1222222222222222222222222222222222",
        time: 1718269479,
    },
])
const filteredRooms = computed(() => {
    const s = search.value.trim().toLowerCase()
    if (!s) return fakeRooms.value
    return fakeRooms.value.filter((r) => r.name.toLowerCase().includes(s))
})

function toLocaleTimeString(timestamp: number) {
    const date = new Date(timestamp * 1e3)
    return date.toLocaleTimeString()
}
</script>

<template>
    <div class="w-full h-full flex overflow-hidden">
        <div class="flex flex-col flex-none w-60 overflow-hidden border-r-[1px] border-base-300/50 max-md:hidden">
            <div class="flex p-2 gap-2 bg-base-100">
                <!-- 搜索 -->
                <label class="text-base-content/70 flex-1 input input-ghost input-sm flex items-center gap-2 bg-base-200">
                    <Icon icon="la:search-solid" />
                    <input type="text" class="flex-1 w-8" placeholder="搜索" v-model="search" />
                </label>
                <Popover class="btn btn-square btn-sm" :title="$t('chat.addRoom')" @confirm="console.log('add room')">
                    <Icon icon="la:plus-solid" />
                    <template #content>
                        <div class="form-control p-2">
                            <label class="cursor-pointer label">
                                <span class="label-text">{{ $t("chat.roomName") }}</span>
                                <input v-model="newroom" type="text" class="input input-bordered input-xs" />
                            </label>
                        </div>
                    </template>
                </Popover>
            </div>
            <!-- 列表 -->
            <ScrollArea class="flex-1 overflow-hidden">
                <div
                    @click="actived = r.name"
                    v-for="r in filteredRooms"
                    :key="r.name"
                    class="w-60 h-16 bg-base-100 p-4 flex flex-col justify-center group"
                    :class="{ 'active bg-primary': actived === r.name }"
                >
                    <!-- 房间名 -->
                    <div class="flex justify-between group-[.active]:text-base-100 space-x-4">
                        <div class="whitespace-nowrap flex-1 overflow-hidden text-ellipsis text-sm">{{ r.name }}</div>
                        <div class="text-xs text-base-content/70 group-[.active]:text-base-100">{{ toLocaleTimeString(r.time) }}</div>
                    </div>
                    <!-- 最新消息 -->
                    <div class="flex justify-between group-[.active]:text-base-100 text-base-content/50 space-x-4">
                        <div class="whitespace-nowrap text-xs flex-1 overflow-hidden text-ellipsis">{{ r.lastMsg }}</div>
                        <div v-if="r.msgCount > 0" class="whitespace-nowrap text-xs font-bold text-base-100 rounded-lg bg-base-300 px-2 group-[.active]:hidden">
                            {{ r.msgCount }}
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
        <div class="grow">
            <Suspense>
                <ChatRoom :roomId="actived" />
                <template #fallback>
                    <div class="w-full h-full flex justify-center items-center">
                        <span class="loading loading-spinner loading-md"></span>
                    </div>
                </template>
            </Suspense>
        </div>
    </div>
</template>
