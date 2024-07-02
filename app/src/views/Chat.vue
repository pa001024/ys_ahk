<script lang="ts" setup>
import { computed, ref } from "vue"
import { gql, useMutation } from "@urql/vue"
import { htmlToText } from "../mod/util/html"
import { useRoute, useRouter } from "vue-router"

const router = useRouter()
const route = useRoute()
const search = ref("")
const newroom = ref("")
const newroomtype = ref("normal")
const actived = computed(() => route.params.room)
const variables = computed(() => ({ name_like: search.value.trim() || null }))

const Query = /* GraphQL */ `
    query ($name_like: String, $limit: Int, $offset: Int) {
        rooms(name_like: $name_like, limit: $limit, offset: $offset) {
            id
            name
            type
            updateAt
            maxUsers
            owner {
                id
                name
                qq
            }
            msgs(limit: 1) {
                id
                content
                createdAt
                user {
                    id
                    name
                    qq
                }
            }
        }
    }
`

interface Room {
    id: string
    name: string
    type: string
    updateAt: string
    maxUsers: string
    owner: string
    msgs: any[]
}

const { executeMutation: createRoom } = useMutation(gql`
    mutation ($name: String!) {
        createRoom(data: { name: $name }) {
            id
        }
    }
`)

async function doCreateRoom() {
    const result = await createRoom({ name: newroom.value.trim(), type: newroomtype.value })
    if (result.data?.createRoom) {
        newroom.value = ""
        await reloadRooms()
        router.push({ name: "room", params: { room: result.data.createRoom.id } })
    }
}

function toLocaleTimeString(timestamp: number) {
    const date = new Date(timestamp)
    if (date.toLocaleDateString() !== new Date().toLocaleDateString()) {
        return date.toLocaleDateString()
    }
    return date.toLocaleTimeString().slice(0, -3)
}

const handle = ref<null | (() => Promise<void>)>(null)
async function reloadRooms() {
    await handle.value!()
}

async function enterRoom(room: Room) {
    router.push({ name: "room", params: { room: room.id } })
}

const toggleMenu = ref(true)
</script>

<template>
    <div class="w-full h-full flex overflow-hidden">
        <transition name="slide-right">
            <div class="flex flex-col flex-none overflow-hidden w-full sm:w-60 sm:border-r-[1px] sm:border-base-300/50" :class="{ 'max-sm:hidden': actived }" v-show="toggleMenu">
                <div class="flex p-2 gap-2 bg-base-100">
                    <!-- 搜索 -->
                    <label class="text-base-content/70 flex-1 input input-ghost input-sm flex items-center gap-2 bg-base-200">
                        <Icon icon="la:search-solid" />
                        <input type="text" class="flex-1 w-8" :placeholder="$t('chat.search')" v-model="search" />
                    </label>
                    <Tooltip :tooltip="$t('chat.addRoom')" side="bottom">
                        <Popover class="btn btn-square btn-sm" :title="$t('chat.addRoom')" @confirm="doCreateRoom">
                            <Icon icon="la:plus-solid" />
                            <template #content>
                                <div class="form-control p-2">
                                    <label class="cursor-pointer label">
                                        <span class="label-text">{{ $t("chat.roomName") }}</span>
                                        <input v-model="newroom" type="text" class="input input-bordered input-sm" />
                                    </label>

                                    <label class="cursor-pointer label">
                                        <span class="label-text">{{ $t("chat.roomType") }}</span>
                                        <Select v-model="newroomtype" :placeholder="$t('chat.roomType')">
                                            <SelectItem value="normal">{{ $t("chat.normal") }}</SelectItem>
                                            <SelectItem value="legend">{{ $t("chat.legend") }}</SelectItem>
                                        </Select>
                                    </label>
                                </div>
                            </template>
                        </Popover>
                    </Tooltip>
                    <Tooltip :tooltip="$t('chat.refresh')" side="bottom">
                        <div class="btn btn-square btn-sm" @click="reloadRooms">
                            <Icon icon="la:sync-solid" />
                        </div>
                    </Tooltip>
                </div>
                <!-- 列表 -->
                <GQAutoPage @load="handle = $event" class="flex-1 overflow-hidden" :size="10" :query="Query" :variables="variables" dataKey="rooms" v-slot="{ data }">
                    <div
                        @click="enterRoom(r)"
                        v-if="data"
                        v-for="r in data.rooms"
                        :key="r.id"
                        class="h-16 bg-base-100 p-4 flex flex-col justify-center group"
                        :class="{ 'active bg-primary': actived === r.id }"
                    >
                        <!-- 房间名 -->
                        <div class="flex justify-between group-[.active]:text-base-100 space-x-4">
                            <div v-if="r.type" class="tag">{{ r.type }}</div>
                            <div class="whitespace-nowrap flex-1 overflow-hidden text-ellipsis text-sm">{{ r.name }}</div>
                            <div class="text-xs text-base-content/70 group-[.active]:text-base-100">{{ toLocaleTimeString(r.msgs?.[0]?.createdAt || r.updateAt) }}</div>
                        </div>
                        <!-- 最新消息 -->
                        <div class="flex justify-between group-[.active]:text-base-100 text-base-content/50 space-x-4">
                            <div v-if="r.msgs?.[0]" class="whitespace-nowrap text-xs flex-1 overflow-hidden text-ellipsis">
                                {{ r.msgs[0].user.name }}: {{ htmlToText(r.msgs[0].content) }}
                            </div>
                            <div v-if="r.msgCount > 0" class="whitespace-nowrap text-xs font-bold text-base-100 rounded-lg bg-base-300 px-2 group-[.active]:hidden">
                                {{ r.msgCount }}
                            </div>
                        </div>
                    </div>
                </GQAutoPage>
            </div>
        </transition>
        <!-- 展开按钮 -->
        <div class="h-full flex flex-none relative items-center max-sm:hidden group">
            <div class="absolute z-10">
                <button class="btn btn-ghost m-1 w-6 p-1 h-32 btn-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500" @click="toggleMenu = !toggleMenu">
                    <span class="flex-none items-center justify-center text-lg text-base-content/50 swap swap-flip" :class="{ 'swap-active': toggleMenu }">
                        <Icon icon="tabler:arrow-bar-to-left" class="swap-on" />
                        <Icon icon="tabler:arrow-bar-to-right" class="swap-off" />
                    </span>
                </button>
            </div>
        </div>
        <div class="grow" :class="{ 'max-sm:block': actived, 'max-sm:hidden': !actived }">
            <RouterView v-slot="{ Component, route }">
                <transition name="slide-right">
                    <Suspense>
                        <component :is="Component" :key="route.path" />
                        <template #fallback>
                            <div class="w-full h-full flex justify-center items-center">
                                <span class="loading loading-spinner loading-md"></span>
                            </div>
                        </template>
                    </Suspense>
                </transition>
            </RouterView>
        </div>
    </div>
</template>
