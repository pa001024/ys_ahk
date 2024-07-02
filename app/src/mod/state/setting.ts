import { useLocalStorage } from "@vueuse/core"
import { defineStore } from "pinia"
import { gqClient, gql } from "../http/graphql"

export const useSettingStore = defineStore("setting", {
    state: () => {
        return {
            theme: useLocalStorage("setting_theme", "light"),
            endpoint: useLocalStorage("setting_endpoint", "http://localhost:8887"),
            name: useLocalStorage("setting_nickname", "游客"),
            email: useLocalStorage("setting_email", ""),
            qq: useLocalStorage("setting_qq", ""),
            token: useLocalStorage("setting_token", ""),
            uiScale: useLocalStorage("setting_ui_scale", 1),
            autoCount: useLocalStorage("setting_auto_count", false),
            minCountInterval: useLocalStorage("setting_min_count_interval", 50),
            windowTrasnparent: useLocalStorage("setting_window_trasnparent", true),
            yunlianAPIKey: useLocalStorage("setting_yunlian_apikey", ""),
            yunlianPhone: useLocalStorage("setting_yunlian_phone", ""),
        }
    },
    getters: {
        userId(state) {
            if (state.token) {
                const token = state.token.split(".")[1]
                const payload = JSON.parse(atob(token))
                return payload.id
            }
            return ""
        },
    },
    actions: {
        setTheme(theme: string) {
            this.theme = theme
        },
        setNickname(nickname: string) {
            this.name = nickname
        },
        async login(email: string, password: string) {
            const result = await gqClient
                .mutation(
                    gql`
                        mutation login($email: String!, $password: String!) {
                            login(email: $username, password: $password) {
                                token
                                user {
                                    id
                                    email
                                    nickname
                                    qq
                                }
                            }
                        }
                    `,
                    { email, password }
                )
                .toPromise()

            if (result.data.login.token) {
                this.token = result.data.login.token
                this.name = result.data.login.user.nickname
                this.qq = result.data.login.user.qq
                this.email = result.data.login.user.email
                return true
            }
            return false
        },
    },
})
