<script lang="tsx" setup>
import { FunctionalComponent } from "vue"
import { useRouter } from "vue-router"
import { useStatisticsStore } from "../mod/state/statistics"
import { useGameStore } from "../mod/state/game"
import StatisticsProgress from "../components/StatisticsProgress.vue"

const stat = useStatisticsStore()
const game = useGameStore()
const nav = useRouter()

const StatisticsItem: FunctionalComponent<{
    progress?: number
    title: string
}> = ({ title, progress, ...props }, { slots }) => {
    return (
        <div {...props} class="flex w-full items-center space-x-4 p-6 bg-base-100/50 hover:bg-base-100 transition-all duration-500 rounded-lg">
            {typeof progress === "number" && <StatisticsProgress progress={progress} />}
            <div class="grid justify-center">
                <div class="text-sm text-neutral-500">{title}</div>
                <div class="text-2xl font-medium">{slots.default?.()}</div>
            </div>
        </div>
    )
}

function timeStr(ms: number) {
    // 返回3时42分18秒格式
    const h = ~~(ms / 36e5)
    const m = ~~((ms % 36e5) / 6e4)
    const s = ~~((ms % 6e4) / 1e3)
    return `${h}时${m}分${s}秒`
}
</script>

<template>
    <div class="p-4 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] w-full justify-items-center gap-4">
        <div class="join flex w-full items-center bg-base-100/50 hover:bg-base-100 transition-all duration-500 rounded-lg p-4">
            <div v-if="game.running" @click="game.launch_game" class="join-item btn btn-primary btn-disabled flex-1">{{ $t("game.launched") }}</div>
            <div v-else @click="game.launch_game" class="join-item btn btn-primary flex-1">{{ $t("game.launch") }}</div>
            <div @click="nav.push('/game')" class="join-item btn btn-primary">
                <svg class="h-6 w-6 fill-current" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                    <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"></path>
                </svg>
            </div>
        </div>
        <StatisticsItem :progress="stat.dailyElite / 400" title="今日精英">{{ stat.dailyElite }}</StatisticsItem>
        <StatisticsItem :progress="stat.dailyNormal / 2000" title="今日小怪">{{ stat.dailyNormal }}</StatisticsItem>
        <StatisticsItem title="今日收入">{{ stat.dailyIncome }}</StatisticsItem>
        <StatisticsItem title="游戏时长">{{ timeStr(game.liveDiff) }}</StatisticsItem>
        <StatisticsItem title="匹配次数">1</StatisticsItem>
    </div>
</template>
