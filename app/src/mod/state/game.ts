import { useLocalStorage } from "@vueuse/core"
import { defineStore } from "pinia"
import * as shell from "@tauri-apps/plugin-shell"
import * as clipboard from "@tauri-apps/plugin-clipboard-manager"
import { SHA1, enc } from "crypto-js"
import { invoke } from "@tauri-apps/api/core"
import { useSettingStore } from "./setting"

interface Account {
    id: string
    desc?: string
    uid?: string
    usk?: string
    usd?: string
    regsk?: string
    login?: string
    pwd?: string
    lock?: boolean
}

async function get_regsk() {
    return (await invoke("plugin:game|get_regsk")) as string
}
async function set_regsk(str: string) {
    return (await invoke("plugin:game|set_regsk", { str })) as void
}

function hash(s: string) {
    return enc.Hex.stringify(SHA1(s))
}

function merge(a: { id: string }[], b: { id: string }[]) {
    const merged = a.reduce((acc, item) => {
        acc[item.id] = item
        return acc
    }, {} as { [key: string]: { id: string } })

    b.forEach((item) => {
        merged[item.id] = Object.assign(merged[item.id] || {}, item)
    })
    return Object.values(merged)
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

setTimeout(async () => {
    const game = useGameStore()
    while (true) {
        const running = (await invoke("plugin:game|get_game", { isRun: game.running })) as boolean
        if (game.running !== running) {
            game.running = running
            game.liveTime = Date.now()
        }
        const date = new Date().toLocaleDateString("zh")
        // 新的一天重新计时
        if (date !== game.liveDate) {
            game.liveDate = date
            game.liveDiff = 0
        }
        if (running) {
            game.liveDiff += Date.now() - game.liveTime
            game.liveTime = Date.now()
        }
        await sleep(100)
    }
}, 1e3)

export const useGameStore = defineStore("game", {
    state: () => {
        return {
            pathEnable: useLocalStorage("game_path_enable", true),
            beforeGameEnable: useLocalStorage("game_before_enable", false),
            afterGameEnable: useLocalStorage("game_after_enable", false),
            path: useLocalStorage("game_path", ""),
            beforeGame: useLocalStorage("game_before", ""),
            afterGame: useLocalStorage("game_after", ""),
            pathParams: useLocalStorage("game_path_params", "-screen-width 1600 -screen-height 900"),
            beforeGameParams: useLocalStorage("game_before_params", ""),
            afterGameParams: useLocalStorage("game_after_params", ""),
            accounts: useLocalStorage("game_accounts", [] as Account[]),
            liveDate: useLocalStorage("game_live_date", "1999/1/1"),
            liveTime: useLocalStorage("game_live_time", 0),
            liveDiff: useLocalStorage("game_live_diff", 0),
            selected: "",
            running: false,
            expend: useLocalStorage("game_expend", true),
        }
    },
    actions: {
        select_next() {
            if (!this.selected) {
                this.selected = this.accounts[0]?.id
                return true
            }
            const index = this.accounts.findIndex((s) => s.id === this.selected)
            const next = this.accounts[index]?.id
            if (!next) return false
            this.selected = next
            return true
        },

        clear_accounts() {
            this.accounts = this.accounts.filter((s) => s.lock)
        },

        async filter_accounts() {
            // 云链查询
            const setting = useSettingStore()
            const apikey = setting.yunlianAPIKey
            if (!apikey) {
                alert("请先到设置中配置云链APIKey")
            } else {
                const reverseMap: { [key: number]: Account } = {}
                this.accounts
                    .map((v, i) => {
                        reverseMap[i] = v
                        return `${v.login}----${v.pwd}`
                    })
                    .join("\n")
            }
        },

        add_accounts(...args: string[]) {
            const added = args
                .map((s) => {
                    const m = s.match(/(?:(\d{9})----)?([A-Za-z0-9_@\-\.]+?)----([^\s-]+)/)
                    if (m) return { id: hash(s), login: m[2], pwd: m[3], uid: m[1] }
                    else return null
                })
                .filter((s) => s) as Account[]
            this.accounts = merge(this.accounts, added)
            return added.length
        },

        lock_account(id: string) {
            const account = this.accounts.find((s) => s.id === id)
            if (account) {
                if (account.lock) delete account.lock
                else account.lock = true
            }
        },

        delete_account(id: string) {
            this.accounts = this.accounts.filter((s) => s.lock || s.id !== id)
        },

        copy_account(id: string) {
            const account = this.accounts.find((s) => s.id === id)
            if (account) {
                if (account.uid) {
                    clipboard.writeText(`${account.uid}----${account.login}----${account.pwd}`)
                } else {
                    clipboard.writeText(`${account.login}----${account.pwd}`)
                }
            }
        },

        async check_current_account() {
            const regsk = await get_regsk()
            const acc = this.accounts.find((s) => s.regsk === regsk)
            if (acc) {
                this.selected = acc.id
            }
        },

        async add_account_reg() {
            const regsk = await get_regsk()
            if (this.selected) {
                const acc = this.accounts.find((s) => s.id === this.selected)
                if (acc) {
                    if (!acc.uid) {
                        const { uid, usk, usd } = (await invoke("plugin:game|get_uid")) as { uid: string; usk: string; usd: string }
                        acc.uid = uid
                        acc.usk = usk
                        acc.usd = usd
                    }
                    if (acc.login && acc.pwd) {
                        acc.regsk = regsk
                        return
                    }
                }
            }
            const added = { id: hash(regsk), regsk }
            this.accounts = merge(this.accounts, [added])
        },

        async update_account_reg(id: string) {
            let account = this.accounts.find((s) => s.id === id)
            if (account) {
                account.regsk = await get_regsk()
            }
        },

        update_account_uid(id: string, uid: string) {
            let account = this.accounts.find((s) => s.id === id)
            if (account) {
                account.uid = uid
            }
        },

        update_account_desc(id: string, desc: string) {
            let account = this.accounts.find((s) => s.id === id)
            if (account) {
                account.desc = desc
            }
        },

        async import_accounts_from_cliboard() {
            const text = await clipboard.readText()
            const added = this.add_accounts(...text.split("\n"))
            return added
        },

        async launch_game() {
            if (this.selected) {
                const account = this.accounts.find((s) => s.id === this.selected)
                await set_regsk(account?.regsk || "")
            }

            if (this.beforeGame && this.beforeGameEnable) {
                console.log("beforeGame")
                await shell.open(this.beforeGame)
            }
            if (this.path && this.pathEnable) {
                console.log("game start")
                // await invoke("exec_arg", { path: game.path, args: game.pathParams.split(" ") })
                await shell.Command.create("cmd", ["/c", this.path, ...this.pathParams.split(" ")]).execute()
                // await shell.open(game.path)
                console.log("game exited")
            }
            if (this.afterGame && this.afterGameEnable) {
                console.log("afterGame")
                await shell.open(this.afterGame)
            }
        },

        async kill_game() {
            return (await invoke("plugin:game|kill_game")) as boolean
        },

        async switch_account(id: string) {
            if (this.running) await this.kill_game()
            this.selected = id
            await this.launch_game()
        },

        export_accounts() {
            return JSON.stringify(this.accounts)
        },

        import_accounts(data: any) {
            this.accounts = merge(this.accounts, data)
        },
    },
})
