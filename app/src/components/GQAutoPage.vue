<script lang="ts" setup>
import { AnyVariables, TypedDocumentNode } from "@urql/vue"
import { until, useInfiniteScroll } from "@vueuse/core"
import { Ref, computed, nextTick, ref } from "vue"

const props = defineProps<{
    distance?: number
    direction?: "top" | "bottom"
    size?: number
    query: TypedDocumentNode<any, AnyVariables>
    variables: any
    dataKey: string
    requestPolicy?: "cache-first" | "cache-only" | "network-only" | "cache-and-network"
}>()

defineSlots<{
    item: (props: { data: any; fetching: boolean; stale: boolean }) => any
}>()

const el = ref<HTMLElement | null>(null)
useInfiniteScroll(el, getNextPage, { distance: props.distance ?? 20, direction: props.direction ?? "bottom" })

const pages: Ref<{ limit: number; offset: number; loaded: boolean }[]> = ref([])
const end = ref(true)
const loading = ref(true)

async function getNextPage() {
    if (end.value || loading.value) return
    const size = props.size ?? 10
    const isTop = props.direction === "top"
    loading.value = true
    const oriHeight = el.value?.scrollHeight
    pages.value[isTop ? "unshift" : "push"]({ limit: size, offset: pages.value.length * size, loaded: false })
    await until(computed(() => pages.value[pages.value.length - 1].loaded)).toBe(true)
    loading.value = false
    if (isTop && oriHeight) {
        nextTick(() => {
            el.value!.scrollTop = el.value!.scrollHeight - oriHeight
        })
    }
}

reload()
async function reload() {
    pages.value = []
    loading.value = false
    end.value = false
    while (!end.value) {
        await getNextPage()
        if (el.value!.scrollTop + el.value!.offsetHeight !== el.value!.scrollHeight) break
    }
}
</script>

<template>
    <ScrollArea v-bind="$attrs" @loadref="(r) => (el = r)">
        <div v-if="loading && direction === 'top'" class="flex justify-center items-center p-2">
            <span class="loading loading-spinner loading-md"></span>
        </div>
        <GQQuery
            v-for="(page, index) in pages"
            :query="query"
            :variables="variables"
            :limit="page.limit"
            :offset="page.offset"
            @load="pages[index].loaded = true"
            @end="end = true"
            :dataKey="dataKey"
        >
            <template #default="{ data, fetching, stale }">
                <slot name="item" :data="data" :fetching="fetching" :stale="stale"></slot>
            </template>
        </GQQuery>
        <div v-if="loading && direction !== 'top'" class="flex justify-center items-center p-2">
            <span class="loading loading-spinner loading-md"></span>
        </div>
    </ScrollArea>
</template>
