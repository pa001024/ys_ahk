import { useLocalStorage } from "@vueuse/core"
import { defineStore } from "pinia"

export const useStatisticsStore = defineStore("statistics", {
    state: () => {
        return {
            daily3000: useLocalStorage("daily_3000", 0),
            daily1200: useLocalStorage("daily_1200", 0),
            daily600: useLocalStorage("daily_600", 0),
            daily200: useLocalStorage("daily_200", 0),
            dailyNormal: useLocalStorage("daily_normal", 0),
        }
    },
    getters: {
        // 每日收益
        dailyIncome(state) {
            return state.daily3000 * 3000 + state.daily1200 * 1200 + state.daily600 * 600 + state.daily200 * 200
        },
        dailyElite(state) {
            return state.daily3000 + state.daily1200 + state.daily600 + state.daily200
        },
    },
    actions: {
        startGame() {},
    },
})
