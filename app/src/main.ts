import { createApp } from "vue"
import "./style.css"
import "animate.css"
import i18next from "i18next"
import I18NextVue from "i18next-vue"
import { MotionPlugin } from "@vueuse/motion"
// prevent rightclicks
// window.addEventListener(
//   "contextmenu",
//   (e) => {
//     const ele = e.target as HTMLElement;
//     if (ele.nodeName !== "INPUT" && ele.nodeName !== "TEXTAREA") {
//       e.preventDefault();
//       return false;
//     }
//   },
//   false
// );

initI18n(navigator.language)

import App from "./App.vue"
import { initI18n } from "./i18n"
import { createPinia } from "pinia"
import { router } from "./router"
const app = createApp(App)
app.use(MotionPlugin).use(createPinia()).use(I18NextVue, { i18next }).use(router)
app.mount("#app")
