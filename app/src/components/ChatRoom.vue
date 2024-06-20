<script lang="ts" setup>
import { useTimestamp } from "@vueuse/core"
import { useInfiniteScroll, useScroll } from "@vueuse/core"
import { FunctionDirective, computed, nextTick, ref, watchEffect } from "vue"
import { useRoom, useRoomManager } from "../mod/http/room"
import { sanitizeHTML } from "../mod/util/html"
import { gql, useQuery } from "@urql/vue"

const props = defineProps<{ roomId: string }>()

const el = ref<HTMLElement | null>(null)

const { arrivedState } = useScroll(el, { offset: { left: 0, top: 20, right: 0, bottom: 20 } })

const { data } = useQuery<{ msgs: { id: string; content: string; createdAt: string; user: { id: string; name: string; qq: number } }[] }>({
    query: /* GraphQL */ gql`
        query ($eq: String!) {
            msgs(where: { room_id: { eq: $eq } }) {
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
    `,
    variables: { eq: props.roomId },
})

watchEffect(() => {
    if (data.value) {
        data.value.msgs.forEach((msg) => {
            const { id, content, createdAt, user } = msg
            const { name, qq } = user
            const time = new Date(createdAt).getTime()
            addMessage({ id, name, qq, content, time })
        })
    }
})
// mock data
// setInterval(() => {
//     addMessage({
//         id: Math.random().toString(36).substring(2, 15),
//         name: "pa",
//         qq: 756458112,
//         content: Math.random().toString(36).substring(2, 15),
//         time: 1718269479,
//     })
// }, 1000)

const rm = useRoomManager()
const room = await useRoom(props.roomId)
const time = useTimestamp({ interval: 1000, offset: rm?.timeOffset })
const nowSeconds = computed(() => ~~(time.value / 1000))
interface Msg {
    id: string
    name: string
    qq: number
    content: string
    time: number
}
const messages = ref<Msg[]>([])

function getMsg(n: number) {
    return Array(n)
        .fill(0)
        .map((_, i) => ({
            id: Math.random().toString(36).substring(2, 15),
            name: "pa",
            qq: 756458112,
            content: Math.random().toString(36).substring(2, 15),
            time: 1718269479,
        }))
}

useInfiniteScroll(
    el,
    () => {
        if (arrivedState.top && arrivedState.bottom) return
        // load more
        const oriH = el.value!.scrollHeight
        messages.value.unshift(...getMsg(5))
        nextTick(() => {
            el.value!.scrollTop = el.value!.scrollHeight - oriH
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

function sendMessage(e: Event) {
    if ((e as KeyboardEvent)?.shiftKey) {
        return
    }
    e.preventDefault()
    const html = input.value?.innerHTML
    if (!html) return
    const content = sanitizeHTML(html)
    console.log(content)
    const msg: Msg = {
        id: Math.random().toString(36).substring(2, 15),
        name: "pa",
        qq: 756458112,
        content,
        time: nowSeconds.value,
    }
    addMessage(msg)
    room?.send(content)
    input.value!.innerHTML = ""
    input.value!.focus()
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
                    <div class="flex items-start gap-2" v-for="item in messages" :key="item.id">
                        <QQAvatar class="mt-2" :qq="item.qq" :name="item.name"></QQAvatar>
                        <div class="flex flex-col">
                            <div class="text-base-content/60 text-sm">{{ item.name }}</div>
                            <div class="rounded-lg bg-base-100 p-2 px-3 select-text inline-block" v-html="sanitizeHTML(item.content)"></div>
                        </div>
                    </div>
                </div>
            </ScrollArea>
            <div class="flex-none w-full relative">
                <div class="w-full absolute -mt-1 h-2 cursor-ns-resize z-100" v-h-resize-for="{ el: inputForm, min: 120, max: 400 }"></div>
            </div>
            <!-- 输入 -->
            <form class="h-44 flex flex-col relative" ref="inputForm" @submit="sendMessage">
                <div v-if="imgLoading" class="absolute top-0 left-0 bottom-0 right-0 cursor-progress z-100 flex justify-center items-center">
                    <span class="loading loading-spinner loading-md"></span>
                </div>
                <div class="flex-none p-1 px-2 border-t-[1px] border-base-300/50">
                    <div class="btn btn-sm btn-square text-2xl hover:text-primary">
                        <Icon icon="la:smile" />
                    </div>
                </div>
                <ScrollArea class="flex-1 overflow-hidden" :class="{ 'pointer-events-none': imgLoading }">
                    <div
                        ref="input"
                        id="msgInput"
                        contenteditable
                        class="p-1 px-2 table-cell text-sm focus:outline-none"
                        @keydown.enter="sendMessage"
                        @paste="onPaste"
                        dropzone="copy"
                    ></div>
                </ScrollArea>
                <div class="flex p-2">
                    <div class="flex-1"></div>
                    <button class="btn btn-sm btn-primary px-6">发送</button>
                </div>
            </form>
        </div>
        <!-- 成员列表 -->
        <!-- <div class="w-44 h-full flex-none flex flex-col overflow-hidden bg-base-100/20 border-l-[1px] border-base-300/50">
            <div class="p-2 text-sm">成员列表</div>
        </div> -->
    </div>
</template>
<style>
#msgInput img {
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
</style>
