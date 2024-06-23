<script lang="ts" setup>
import { useTimestamp } from "@vueuse/core"
import { useInfiniteScroll, useScroll } from "@vueuse/core"
import { FunctionDirective, computed, nextTick, onMounted, ref, watch } from "vue"
import { isImage, sanitizeHTML } from "../mod/util/html"
import { gql, useMutation, useQuery, useSubscription } from "@urql/vue"
import { gqClient } from "../mod/http/graphql"

const props = defineProps<{ roomId: string }>()
const roomId = computed(() => props.roomId)

const el = ref<HTMLElement | null>(null)

const { arrivedState } = useScroll(el, { offset: { left: 0, top: 20, right: 0, bottom: 200 } })

type Msg = {
    id: string
    content: string
    createdAt: string
    user: { id: string; name: string; qq: number }
}

const reachedTop = ref(false)
const loadingTop = ref(false)
const messages = ref<Msg[]>([])

async function getMsgs() {
    const { data } = await gqClient
        .query<{ msgs: Msg[] }>(
            gql`
                query ($room_id: String!, $limit: Int, $offset: Int) {
                    msgs(room_id: $room_id, limit: $limit, offset: $offset) {
                        id
                        content
                        createdAt
                        room_id
                        user {
                            id
                            name
                            qq
                        }
                    }
                }
            `,
            { room_id: props.roomId, limit: 10, offset: messages.value.length },
            { requestPolicy: "cache-and-network" }
        )
        .toPromise()
    return data?.msgs
}

async function loadHistory() {
    messages.value = []
    const msgs = await getMsgs()
    if (msgs) {
        reachedTop.value = false
        messages.value = msgs

        nextTick(() => {
            el.value?.scrollTo({
                top: el.value.scrollHeight,
                left: 0,
                // behavior: "smooth",
            })
        })
    }
}

onMounted(loadHistory)

watch(() => props.roomId, loadHistory)

useSubscription<{ newMessage: Msg }, Msg[]>(
    {
        query: gql`
            subscription ($room_id: String!) {
                newMessage(room_id: $room_id) {
                    id
                    edited
                    content
                    user {
                        id
                        name
                        qq
                    }
                }
            }
        `,
        variables: { room_id: roomId },
    },
    (_, data) => {
        addMessage(data.newMessage)
        return []
    }
)

const { executeMutation: sendMessageMut } = useMutation(gql`
    mutation ($content: String!, $room_id: String!) {
        sendMessage(content: $content, room_id: $room_id) {
            success
            message
            msg {
                id
                createdAt
            }
        }
    }
`)

const time = useTimestamp({ interval: 1000, offset: 0 })
const nowSeconds = computed(() => ~~(time.value / 1000))

useInfiniteScroll(
    el,
    () => {
        nextTick(async () => {
            if (messages.value.length < 10 || (arrivedState.top && arrivedState.bottom)) return
            // load more
            const oriH = el.value!.scrollHeight
            if (reachedTop.value) return
            loadingTop.value = true
            const msgs = await getMsgs()
            loadingTop.value = false
            if (!msgs || msgs.length === 0) {
                reachedTop.value = true
                return
            }
            messages.value.unshift(...msgs)
            nextTick(() => {
                el.value!.scrollTop = el.value!.scrollHeight - oriH
            })
        })
    },
    { distance: 20, direction: "top" }
)

function addMessage(msg: Msg) {
    messages.value.push(msg)
    if (arrivedState.bottom) {
        if (messages.value.length > 50) {
            messages.value = messages.value.slice(-50)
        }
        nextTick(() => {
            el.value?.scrollTo({
                top: el.value.scrollHeight,
                left: 0,
                behavior: "smooth",
            })
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
    const { data } = await sendMessageMut({ content, room_id: props.roomId })
    if (data?.sendMessage.success) {
        input.value!.innerHTML = ""
        input.value!.focus()
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
            <ScrollArea class="flex-1 overflow-hidden" @loadref="(r) => (el = r)">
                <div class="flex w-full h-full flex-col gap-2 p-4">
                    <div v-if="loadingTop" class="flex justify-center items-center">
                        <span class="loading loading-spinner loading-md"></span>
                    </div>
                    <div class="flex justify-center items-center text-xs" v-if="reachedTop">{{ $t("chat.reachedTop") }}</div>
                    <!-- 消息列表 -->
                    <div class="flex items-start gap-2" v-for="item in messages" :key="item.id">
                        <QQAvatar class="mt-2" :qq="item.user.qq" :name="item.user?.name"></QQAvatar>
                        <div class="flex flex-col">
                            <div class="text-base-content/60 text-sm">{{ item.user.name }}</div>
                            <div
                                class="safe-html rounded-lg bg-base-100 select-text inline-flex flex-col text-sm max-w-80 overflow-hidden gap-2"
                                :class="{ 'p-2': !isImage(item.content) }"
                                v-html="sanitizeHTML(item.content)"
                            ></div>
                        </div>
                    </div>
                </div>
            </ScrollArea>
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
        <!-- <div class="w-44 h-full flex-none flex flex-col overflow-hidden bg-base-100/20 border-l-[1px] border-base-300/50">
            <div class="p-2 text-sm">成员列表</div>
        </div> -->
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
