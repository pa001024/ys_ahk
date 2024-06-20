import { defineStore } from "pinia"

export const useUIStore = defineStore("ui", {
    state: () => {
        return {
            sidebarExpand: false,
        }
    },
    actions: {
        toggleSidebar() {
            this.sidebarExpand = !this.sidebarExpand
        },
    },
})
