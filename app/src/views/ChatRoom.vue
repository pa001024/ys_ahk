<script lang="ts" setup>
import { useTimestamp } from "@vueuse/core"
import { useScroll } from "@vueuse/core"
import { FunctionDirective, computed, ref } from "vue"
import { isImage, sanitizeHTML } from "../mod/util/html"
import { gql, useMutation, useSubscription } from "@urql/vue"
import { useSettingStore } from "../mod/state/setting"
import { useRoute } from "vue-router"

const route = useRoute()
const roomId = computed(() => route.params.room as string)
const setting = useSettingStore()

const el = ref<HTMLElement | null>(null)

const { arrivedState } = useScroll(el, { offset: { left: 0, top: 20, right: 0, bottom: 200 } })

const Query = /* GraphQL */ `
    query ($roomId: String!, $limit: Int, $offset: Int) {
        msgs(roomId: $roomId, limit: $limit, offset: $offset) {
            id
            edited
            content
            createdAt
            roomId
            user {
                id
                name
                qq
            }
        }
    }
`
const variables = computed(() => ({ roomId: roomId.value }))

type Msg = {
    id: string
    edited: number
    content: string
    createdAt: string
    user: { id: string; name: string; qq: number }
}

useSubscription<{ newMessage: Msg; msgEdited: Msg }, Msg[]>(
    {
        query: gql`
            subscription RoomEvents($roomId: String!) {
                newMessage(roomId: $roomId) {
                    id
                    edited
                    content
                    createdAt
                    user {
                        id
                        name
                        qq
                    }
                }
            }
        `,
        variables: { roomId },
    },
    (_, data) => {
        if (data.newMessage) {
            addMessage(data.newMessage)
        }
        return []
    }
)

const { executeMutation: sendMessageMut } = useMutation(gql`
    mutation ($content: String!, $roomId: String!) {
        sendMessage(content: $content, roomId: $roomId) {
            id
        }
    }
`)

const { executeMutation: editMessageMut } = useMutation(gql`
    mutation ($content: String!, $msgId: String!) {
        editMessage(content: $content, msgId: $msgId) {
            id
        }
    }
`)

const time = useTimestamp({ interval: 1000, offset: 0 })
const nowSeconds = computed(() => ~~(time.value / 1000))

async function addMessage(msg: Msg) {
    if (arrivedState.bottom) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        el.value?.scrollTo({
            top: el.value.scrollHeight,
            left: 0,
            behavior: "smooth",
        })
    }
}

const input = ref<HTMLDivElement | null>(null)
const inputForm = ref<HTMLDivElement | null>(null)

async function sendMessage(e: Event) {
    if ((e as KeyboardEvent)?.shiftKey) {
        return
    }
    e.preventDefault()
    const html = input.value?.innerHTML
    if (!html) return
    const content = sanitizeHTML(html)
    if (!content) return
    input.value!.innerHTML = ""
    input.value!.focus()
    await sendMessageMut({ content, roomId: roomId.value })
    el.value?.scrollTo({
        top: el.value.scrollHeight,
        left: 0,
        behavior: "smooth",
    })
}

const editId = ref("")
const editInput = ref<HTMLDivElement[] | null>(null)
async function editMessage(msgId: string, content: string) {
    await editMessageMut({ content, msgId })
}
const retractCache = new WeakMap()
async function retractMessage(msg: Msg) {
    retractCache.set(msg, msg.content)
    await editMessage(msg.id, "")
    msg.content = ""
}
async function restoreMessage(msg: Msg) {
    const content = retractCache.get(msg)
    msg.content = content || msg.content
    startEdit(msg)
}
async function startEdit(msg: Msg) {
    editId.value = msg.id
    await new Promise((resolve) => setTimeout(resolve, 100))
    if (editInput.value?.[0]) {
        let el = editInput.value[0]
        el.focus()
        el.onblur = async () => {
            const newVal = sanitizeHTML(el.innerHTML || "")
            await editMessage(editId.value, newVal)
            msg.content = newVal
            msg.edited = 1
            editId.value = ""
        }
    }
}

const imgLoading = ref(false)

function onPaste(e: ClipboardEvent) {
    e.preventDefault()
    if (e.clipboardData?.types.includes("Files")) {
        imgLoading.value = true
        const files = e.clipboardData.files
        const file = files[0]
        if (["image/png", "image/jpeg", "image/gif"].includes(file.type)) {
            // TODO: 处理文件上传逻辑
            const reader = new FileReader()
            reader.readAsDataURL(file)
            const clt = setTimeout(() => {
                imgLoading.value = false
            }, 3e3)
            reader.onload = (e) => {
                const url = e.target?.result
                const img = new Image()
                img.src = url as string
                const sel = window.getSelection()!
                const range = sel.getRangeAt(0)
                range.deleteContents()
                range.insertNode(img)
                range.collapse(false)
                imgLoading.value = false
                clearTimeout(clt)
            }
        }
        return
    }
    const text = e.clipboardData?.getData("text/plain")
    if (!text) return
    const sel = window.getSelection()!
    const range = sel.getRangeAt(0)
    const node = document.createElement("div")
    node.innerText = text!
    let frag = document.createDocumentFragment()
    while (node.firstChild) frag.appendChild(node.firstChild)
    range.deleteContents()
    range.insertNode(frag)
    range.collapse(false)
}

const vHResizeFor: FunctionDirective = (el, { value: { el: target, min, max } }) => {
    const onPointerDown = (e: PointerEvent) => {
        const rect = target.getBoundingClientRect()
        const y = e.clientY
        const h = rect.height
        el.setPointerCapture(e.pointerId)
        const drag = (e: MouseEvent) => {
            const dy = y - e.clientY
            target.style.height = `${Math.max(min, Math.min(max, h + dy))}px`
        }
        const stopDrag = () => {
            el.releasePointerCapture(e.pointerId)
            el.removeEventListener("pointermove", drag)
        }
        el.addEventListener("pointermove", drag)
        el.addEventListener("pointerup", stopDrag)
    }

    el.onpointerdown = onPointerDown
}
</script>

<template>
    <div class="w-full h-full bg-base-200/50 flex">
        <!-- 聊天窗口 -->
        <div class="flex-1 flex flex-col overflow-hidden">
            <GQAutoPage
                @loadref="(r) => (el = r)"
                direction="top"
                class="flex-1 overflow-hidden"
                innerClass="flex w-full h-full flex-col gap-2 p-4"
                :size="10"
                :query="Query"
                :variables="variables"
                dataKey="msgs"
                v-slot="{ data }"
            >
                <!-- 消息列表 -->
                <ContextMenu v-if="data" class="group flex items-start gap-2" v-for="item in data.msgs" :key="item.id">
                    <div v-if="!item.content && editId !== item.id" class="text-xs text-base-content/60 m-auto">
                        {{ $t("chat.retractedAMessage", { name: setting.userId === item.user.id ? $t("chat.you") : item.user?.name }) }}
                        <span class="text-xs text-primary underline cursor-pointer" @click="restoreMessage(item)">{{ $t("chat.restore") }}</span>
                    </div>
                    <div class="flex-1 flex items-start gap-2" :class="{ 'flex-row-reverse': setting.userId === item.user.id }" v-else>
                        <QQAvatar class="mt-2" :qq="item.user.qq" :name="item.user?.name"></QQAvatar>
                        <div class="flex items-start flex-col" :class="{ 'items-end': setting.userId === item.user.id }">
                            <div class="text-base-content/60 text-sm">{{ item.user.name }}</div>
                            <div
                                v-if="editId === item.id"
                                ref="editInput"
                                contenteditable
                                class="safe-html rounded-lg bg-base-100 select-text inline-flex flex-col text-sm max-w-80 overflow-hidden gap-2"
                                :class="{ 'p-2': !isImage(item.content), 'bg-primary text-base-100': setting.userId === item.user.id }"
                                v-html="sanitizeHTML(item.content)"
                            ></div>
                            <div
                                v-else
                                class="safe-html rounded-lg bg-base-100 select-text inline-flex flex-col text-sm max-w-80 overflow-hidden gap-2"
                                :class="{ 'p-2': !isImage(item.content), 'bg-primary text-base-100': setting.userId === item.user.id }"
                                v-html="sanitizeHTML(item.content)"
                            ></div>
                        </div>
                        <div class="text-xs text-base-content/60 self-end" v-if="item.edited">{{ $t("chat.edited") }}</div>
                        <div class="flex-1"></div>
                        <div class="hidden group-hover:block p-1 text-xs text-base-content/60">{{ item.createdAt }}</div>
                    </div>

                    <template #menu>
                        <ContextMenuItem
                            @click="retractMessage(item)"
                            class="group text-sm p-2 leading-none text-base-content rounded flex items-center relative select-none outline-none data-[disabled]:text-base-content/60 data-[disabled]:pointer-events-none data-[highlighted]:bg-primary data-[highlighted]:text-base-100"
                        >
                            <Icon class="size-4 mr-2" icon="la:reply-solid" />
                            {{ $t("chat.revert") }}
                        </ContextMenuItem>
                        <ContextMenuItem
                            @click="startEdit(item)"
                            class="group text-sm p-2 leading-none text-base-content rounded flex items-center relative select-none outline-none data-[disabled]:text-base-content/60 data-[disabled]:pointer-events-none data-[highlighted]:bg-primary data-[highlighted]:text-base-100"
                        >
                            <Icon class="size-4 mr-2" icon="la:edit-solid" />
                            {{ $t("chat.edit") }}
                        </ContextMenuItem>
                    </template>
                </ContextMenu>
            </GQAutoPage>
            <div class="flex-none w-full relative">
                <div class="w-full absolute -mt-[3px] h-[6px] cursor-ns-resize z-100" v-h-resize-for="{ el: inputForm, min: 120, max: 400 }"></div>
            </div>
            <!-- 输入 -->
            <form class="h-44 flex flex-col relative border-t-[1px] border-base-300/50 pointer-events-none" ref="inputForm" @submit="sendMessage">
                <div v-if="imgLoading" class="absolute top-0 left-0 bottom-0 right-0 cursor-progress z-100 flex justify-center items-center">
                    <span class="loading loading-spinner loading-md"></span>
                </div>
                <div class="flex-none p-1 px-2 border-t-[1px] border-base-300/50">
                    <div class="btn btn-sm btn-square text-2xl hover:text-primary pointer-events-auto">
                        <Icon icon="la:smile" />
                    </div>
                </div>
                <ScrollArea class="flex-1 overflow-hidden" :class="{ 'pointer-events-auto': !imgLoading }">
                    <div
                        ref="input"
                        id="msgInput"
                        contenteditable
                        class="p-1 px-2 table-cell text-sm focus:outline-none text-wrap break-all overflow-x-hidden"
                        @keydown.enter="sendMessage"
                        @paste="onPaste"
                        dropzone="copy"
                    ></div>
                </ScrollArea>
                <div class="flex p-2 pointer-events-auto">
                    <div class="flex-1"></div>
                    <button class="btn btn-sm btn-primary px-6" :disabled="imgLoading">{{ $t("chat.send") }}</button>
                </div>
            </form>
        </div>
        <!-- 成员列表 -->
        <div class="w-44 h-full flex-none flex flex-col overflow-hidden bg-base-100/20 border-l-[1px] border-base-300/50 max-lg:hidden">
            <div class="p-2 text-sm">成员列表</div>
        </div>
    </div>
</template>
<style lang="less">
> #msgInput img {
    max-width: 200px;
    max-height: 200px;
}
#msgInput:empty:before {
    content: attr(placeholder);
    color: #9ca3af;
}
#msgInput * {
    display: inline;
    vertical-align: baseline;
}

.safe-html {
    img {
        border-radius: 0.3rem;
    }
}
</style>
