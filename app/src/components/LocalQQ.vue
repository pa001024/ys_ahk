<script lang="ts" setup>
import { onMounted, ref } from "vue"
import { getLocalQQ } from "../mod/api/app"
import { env } from "../env"

type LocalQQ = (ReturnType<typeof getLocalQQ> extends Promise<infer T> ? T : never)[number]

const uins = ref([] as LocalQQ[])

onMounted(async () => {
    if (!env.isApp) return
    const list = ([] as LocalQQ[]).concat(...(await Promise.all([getLocalQQ(4301), getLocalQQ(4303)])))
    uins.value = Object.values(
        list.reduce((p, c) => {
            p[c.uin] = c
            return p
        }, {} as Record<string, LocalQQ>)
    )
})

const emit = defineEmits(["select"])
const select = (qq: LocalQQ) => emit("select", qq)
</script>

<template>
    <div v-if="env.isApp" class="flex flex-wrap gap-2">
        <div v-for="qq in Object.values(uins)" :key="qq.uin" class="flex flex-col items-center gap-1 btn btn-ghost" @click="select(qq)">
            <QQAvatar :qq="qq.uin" :name="qq.nickname" class="size-8" />
            <span>{{ qq.nickname }}</span>
        </div>
    </div>
</template>
