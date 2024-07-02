<script lang="ts" setup>
import { gql } from "@urql/vue"
import { until, useInfiniteScroll } from "@vueuse/core"
import { Ref, computed, nextTick, onMounted, ref, watch } from "vue"

type gqlQuery = string

const props = defineProps<{
    distance?: number
    direction?: "top" | "bottom"
    limit?: number
    offset?: number
    innerClass?: string
    query: gqlQuery
    variables: any
    dataKey: string
    requestPolicy?: "cache-first" | "cache-only" | "network-only" | "cache-and-network"
}>()

defineSlots<{
    default: (props: { data: any; fetching: boolean; stale: boolean }) => any
}>()

const el = ref<HTMLElement | null>(null)
useInfiniteScroll(el, getNextPage, { distance: props.distance ?? 20, direction: props.direction ?? "bottom" })

const pages: Ref<{ limit: number; offset: number; loaded: boolean }[]> = ref([])
const end = ref(true)
const loading = ref(true)

async function getNextPage() {
    if (end.value || loading.value) return
    const limit = props.limit ?? 10
    const offset = props.offset ?? 0
    const isTop = props.direction === "top"
    loading.value = true
    const oriHeight = el.value?.scrollHeight
    pages.value[isTop ? "unshift" : "push"]({ limit, offset: offset + pages.value.length * limit, loaded: false })
    await until(computed(() => pages.value[pages.value.length - 1].loaded)).toBe(true)
    loading.value = false
    if (isTop && oriHeight) {
        await nextTick()
        el.value!.scrollTop = el.value!.scrollHeight - oriHeight
    }
}

async function ready() {
    console.log("loaded data", props.dataKey, el.value)
    await nextTick()
    if (props.direction === "top") {
        el.value?.scrollTo({
            top: el.value.scrollHeight,
            left: 0,
            // behavior: "smooth",
        })
    }
}

reload()
async function reload() {
    pages.value = []
    loading.value = false
    end.value = false
    await nextTick()
    while (!end.value) {
        await getNextPage()
        if (el.value!.scrollTop + el.value!.offsetHeight !== el.value!.scrollHeight) break
    }
    ready()
}

const emit = defineEmits(["load", "loadref"])
onMounted(() => {
    emit("load", reload)
})
watch(el, (newVal) => {
    emit("loadref", newVal)
})
</script>

<template>
    <ScrollArea v-bind="$attrs" @loadref="(r) => (el = r)">
        <div :class="innerClass">
            <div v-if="loading && direction === 'top'" class="flex justify-center items-center p-2">
                <span class="loading loading-spinner loading-md"></span>
            </div>
            <GQQuery
                v-for="(page, index) in pages"
                :query="gql(query)"
                :variables="variables"
                :limit="page.limit"
                :offset="page.offset"
                @load="pages[index].loaded = true"
                @end="end = true"
                :dataKey="dataKey"
            >
                <template #default="{ data, fetching, stale }">
                    <slot :data="data" :fetching="fetching" :stale="stale"></slot>
                </template>
            </GQQuery>
            <div v-if="loading && direction !== 'top'" class="flex justify-center items-center p-2">
                <span class="loading loading-spinner loading-md"></span>
            </div>
        </div>
    </ScrollArea>
</template>
