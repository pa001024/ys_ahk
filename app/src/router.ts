import { RouteRecordRaw, createMemoryHistory, createRouter } from "vue-router"
import { LogicalSize, getCurrent } from "@tauri-apps/api/window"

import Home from "./views/Home.vue"
import Setting from "./views/Setting.vue"
import Game from "./views/Game.vue"
import User from "./views/User.vue"
import Chat from "./views/Chat.vue"
import Room from "./views/Room.vue"

async function setMinSize(w: number, h: number) {
    const win = getCurrent()
    win.setMinSize(new LogicalSize(w, h))
    const size = await win.innerSize()
    const factor = await win.scaleFactor()
    const logicalSize = size.toLogical(factor)
    win.setSize(new LogicalSize(Math.max(w, logicalSize.width), Math.max(h, logicalSize.height)))
}

const routes: readonly RouteRecordRaw[] = [
    { name: "home", path: "/", component: Home, beforeEnter: () => setMinSize(367, 430) },
    { name: "game", path: "/game", component: Game, beforeEnter: () => setMinSize(406, 430) },
    { name: "user", path: "/user", component: User, beforeEnter: () => setMinSize(367, 430) },
    { name: "chat", path: "/chat", component: Chat, beforeEnter: () => setMinSize(367, 430), meta: { keepAlive: true } },
    { name: "room", path: "/room", component: Room, beforeEnter: () => setMinSize(367, 430) },
    // { name: "map", path: "/map", component: About },
    { name: "setting", path: "/setting", component: Setting, beforeEnter: () => setMinSize(540, 430) },
]

export const router = createRouter({
    history: createMemoryHistory(),
    routes,
})
