<script lang="ts" setup>
import { computed, ref } from "vue"
// import { provideRoomManager } from "../mod/http/room"
// import { useSettingStore } from "../mod/state/setting"
// import { gqClientWs } from "../mod/http/graphql"
import { useQuery, gql, useMutation } from "@urql/vue"

// const setting = useSettingStore()
// const rm = provideRoomManager(`${setting.endpoint}/ws?token=${setting.token}&name=${setting.name}`)
// provideClient(gqClientWs(rm.ws.createGQWSClient()))

const search = ref("")
const newroom = ref("")
const newroomtype = ref("normal")
const actived = ref("")

const { data, executeQuery: reloadRooms } = useQuery({
    query: /* GraphQL */ gql`
        query ($name_like: String) {
            rooms(name_like: $name_like) {
                id
                name
                type
                updateAt
                max_users
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
    `,
    variables: {
        name_like: computed(() => search.value.trim() || null),
    },
    requestPolicy: "cache-and-network",
})

const rooms = computed(
    () =>
        (data?.value.rooms as any[]).sort((a, b) => {
            if (new Date(a.msgs[0]?.createdAt || a.updateAt) > new Date(b.msgs[0]?.createdAt || b.updateAt)) {
                return -1
            }
            return 1
        }) || []
)

const { executeMutation: createRoom } = useMutation(gql`
    mutation ($name: String!) {
        createRoom(data: { name: $name }) {
            success
            message
            room {
                id
            }
        }
    }
`)

async function doCreateRoom() {
    const result = await createRoom({ name: newroom.value.trim(), type: newroomtype.value })
    if (result.data?.createRoom?.success) {
        newroom.value = ""
        await reloadRooms()
        actived.value = result.data.createRoom.room.id
    }
}

function toRoomLastMsgTime(room: any) {}

function toLocaleTimeString(timestamp: number) {
    const date = new Date(timestamp)
    if (date.toLocaleDateString() !== new Date().toLocaleDateString()) {
        return date.toLocaleDateString()
    }
    return date.toLocaleTimeString().slice(0, -3)
}
</script>

<template>
    <div class="w-full h-full flex overflow-hidden">
        <div class="flex flex-col flex-none w-60 overflow-hidden border-r-[1px] border-base-300/50 max-md:hidden">
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
            <ScrollArea class="flex-1 overflow-hidden">
                <div
                    @click="actived = r.id"
                    v-if="data"
                    v-for="r in rooms"
                    :key="r.id"
                    class="w-60 h-16 bg-base-100 p-4 flex flex-col justify-center group"
                    :class="{ 'active bg-primary': actived === r.id }"
                >
                    <!-- 房间名 -->
                    <div class="flex justify-between group-[.active]:text-base-100 space-x-4">
                        <div v-if="r.type" class="tag">{{ r.type }}</div>
                        <div class="whitespace-nowrap flex-1 overflow-hidden text-ellipsis text-sm">{{ r.name }}</div>
                        <div class="text-xs text-base-content/70 group-[.active]:text-base-100">{{ toLocaleTimeString(r.msgs[0]?.createdAt || r.updateAt) }}</div>
                    </div>
                    <!-- 最新消息 -->
                    <div class="flex justify-between group-[.active]:text-base-100 text-base-content/50 space-x-4">
                        <div v-if="r.msgs[0]" class="whitespace-nowrap text-xs flex-1 overflow-hidden text-ellipsis">{{ r.msgs[0].user.name }}: {{ r.msgs[0].content }}</div>
                        <div v-if="r.msgCount > 0" class="whitespace-nowrap text-xs font-bold text-base-100 rounded-lg bg-base-300 px-2 group-[.active]:hidden">
                            {{ r.msgCount }}
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
        <div class="grow">
            <Suspense>
                <ChatRoom v-if="actived" :roomId="actived" />
                <template #fallback>
                    <div class="w-full h-full flex justify-center items-center">
                        <span class="loading loading-spinner loading-md"></span>
                    </div>
                </template>
            </Suspense>
        </div>
    </div>
</template>
