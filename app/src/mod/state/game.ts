import { useLocalStorage } from "@vueuse/core"
import { defineStore } from "pinia"
import * as shell from "@tauri-apps/plugin-shell"
import * as clipboard from "@tauri-apps/plugin-clipboard-manager"
import * as event from "@tauri-apps/api/event"
import { SHA1, enc } from "crypto-js"
import { env } from "../../env"
import { autoOpen, getGame, getRegsk, getUid, launchGame, setRegsk, setUsd } from "../api/game"
import { db, GameAccount } from "../db"
import { useObservable } from "@vueuse/rxjs"
import { liveQuery } from "dexie"
import { t } from "i18next"
import { addTaskAsyncMutation, sendMessageMutation } from "../api/mutation"

function hash(s: string) {
    return enc.Hex.stringify(SHA1(s))
}

export function createGameAccount(obj?: Partial<GameAccount>): Omit<GameAccount, "id"> {
    return {
        // id: obj?.id || 1,
        hash: obj?.hash || "",
        name: obj?.name || "",
        lock: obj?.lock || 0,
        uid: obj?.uid || "",
        usk: obj?.usk || "",
        usd: obj?.usd || "",
        login: obj?.login || "",
        pwd: obj?.pwd || "",
        token: obj?.token || "",
    }
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

if (env.isApp) {
    setTimeout(async () => {
        const game = useGameStore()
        while (true) {
            const running = await getGame(game.running)
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
}

export const useGameStore = defineStore("game", {
    state: () => {
        return {
            pathEnable: useLocalStorage("game_path_enable", true),
            beforeGameEnable: useLocalStorage("game_before_enable", false),
            afterGameEnable: useLocalStorage("game_after_enable", false),
            autoLoginEnable: useLocalStorage("game_auto_login_enable", false),
            autoLoginRoom: useLocalStorage("game_auto_login_room", "-"),
            path: useLocalStorage("game_path", ""),
            beforeGame: useLocalStorage("game_before", ""),
            afterGame: useLocalStorage("game_after", ""),
            pathParams: useLocalStorage("game_path_params", "-screen-width 1600 -screen-height 900"),
            beforeGameParams: useLocalStorage("game_before_params", ""),
            afterGameParams: useLocalStorage("game_after_params", ""),
            accounts: useObservable(liveQuery(() => db.gameAccounts.toArray())),
            liveDate: useLocalStorage("game_live_date", "1999/1/1"),
            liveTime: useLocalStorage("game_live_time", 0),
            liveDiff: useLocalStorage("game_live_diff", 0),
            selected: 0,
            running: false,
            expend: useLocalStorage("game_expend", false),
        }
    },
    actions: {
        /** 选择上一个 */
        selectPrev() {
            if (!this.accounts) return false
            if (!this.selected) {
                this.selected = this.accounts[0]?.id
                return true
            }
            const index = this.accounts.findIndex((s) => s.id === this.selected)
            const next = this.accounts[index - 1]?.id
            if (!next) return false
            this.selected = next
            return true
        },
        /** 选择下一个 */
        selectNext() {
            if (!this.accounts) return false
            if (!this.selected) {
                this.selected = this.accounts[0]?.id
                return true
            }
            const index = this.accounts.findIndex((s) => s.id === this.selected)
            const next = this.accounts[index + 1]?.id
            if (!next) {
                console.debug("no next account")
                return false
            }
            this.selected = next
            return true
        },

        /** 清除未锁定的账号 */
        async clearAccounts() {
            const deleted = await db.gameAccounts.where("lock").equals(0).delete()
            console.log("clearAccounts deleted", deleted)
        },

        /** 批量添加账号 */
        async addAccounts(...lines: string[]) {
            const added = [] as ReturnType<typeof createGameAccount>[]
            for (const line of lines) {
                console.log("addAccounts line", line)
                const m = line.match(/(?:(\d{9})----)?([A-Za-z0-9_@\-\.]+?)----([^\s-]+)/)

                if (m) {
                    const conflict = await db.gameAccounts.where("hash").equals(hash(m[2])).first()
                    if (
                        !conflict ||
                        (await confirm(
                            t("game.accountConflict", {
                                acc: conflict.login || (conflict.uid && `UID:${conflict.uid}`) || conflict.name || conflict.hash,
                            })
                        ))
                    ) {
                        added.push(
                            createGameAccount({
                                hash: hash(m[2]),
                                lock: 0,
                                login: m[2],
                                pwd: m[3],
                                uid: m[1],
                            })
                        )
                    }
                }
            }

            if (!added.length) return 0
            const res = await db.gameAccounts.bulkAdd(added)
            console.log("addAccounts added", res)
            return added.length
        },

        async lockAccount(id: number) {
            await db.gameAccounts.update(id, (t, ctx) => {
                ctx.value.lock = t.lock ? 0 : 1
            })
        },

        async deleteAccount(id: number) {
            const acc = await db.gameAccounts.get(id)
            if (acc && !acc?.lock) {
                await db.gameAccounts.delete(id)
                console.debug("delete account", id)
            } else {
                console.debug("delete fail: locked account", id)
            }
        },

        async deleteReg(id: number) {
            const acc = await db.gameAccounts.get(id)
            if (acc) {
                await db.gameAccounts.update(id, (t, ctx) => {
                    ctx.value.uid = ""
                    ctx.value.token = ""
                })
                console.debug("delete account token", id)
            }
        },

        async copyUID(id?: number) {
            if (!id) id = this.selected
            const account = await db.gameAccounts.get(id)
            if (account) {
                if (account.uid) {
                    clipboard.writeText(`${account.uid}`)
                    return account.uid
                }
            }
        },

        async copyAccount(id: number) {
            const account = await db.gameAccounts.get(id)
            if (account) {
                if (account.uid) {
                    clipboard.writeText(`${account.uid}----${account.login}----${account.pwd}`)
                } else {
                    clipboard.writeText(`${account.login}----${account.pwd}`)
                }
            }
        },

        async checkCurrentAccount() {
            const token = await getRegsk()
            const acc = await db.gameAccounts.where("hash").equals(hash(token)).first()
            if (acc) {
                this.selected = acc.id
            }
        },

        async addAccountReg(onlyUpdate = false) {
            const token = await getRegsk()
            if (!token) return
            const iid = { hash: hash(token), token }
            const old = await db.gameAccounts.get(this.selected)
            const acc = await this.createAccountReg({ ...old, ...iid })
            if (old) {
                console.log("update account", acc)
                await db.gameAccounts.update(old.id, acc)
            } else if (!onlyUpdate) {
                const newID = await db.gameAccounts.add(acc)
                if (newID) this.selected = newID
            }
        },

        async addNewAccountReg() {
            const token = await getRegsk()
            const iid = { hash: hash(token), token }
            const acc = await this.createAccountReg({ ...iid })
            await db.gameAccounts.add(acc)
        },

        async createAccountReg(old: Partial<GameAccount>) {
            const acc = createGameAccount(old)
            const rst = await getUid()
            if (rst && rst.uid) {
                acc.uid = rst.uid
                if (!acc.pwd) {
                    acc.usk = rst.usk
                    acc.usd = rst.usd
                }
            }
            return acc
        },

        async updateName(name: string) {
            if (this.selected) {
                await db.gameAccounts.update(this.selected, { name })
            }
        },

        async importAccountsFromCliboard() {
            const text = await clipboard.readText()
            const added = this.addAccounts(...text.split("\n"))
            return added
        },

        async launchGame() {
            // if (this.running) await killGame()
            const account = this.selected ? await db.gameAccounts.get(this.selected) : null
            if (account) {
                await setRegsk(account.token || "", account.uid || "")
                if (account.usk && account.usd) await setUsd(account.usk, account.usd)
            }

            if (this.beforeGame && this.beforeGameEnable) {
                console.log("beforeGame")
                await shell.open(this.beforeGame)
            }
            if (this.path && this.pathEnable) {
                console.log("game start")
                await launchGame(
                    this.path,
                    this.autoLoginEnable
                        ? "-screen-width 1600 -screen-height 900 -platform_type CLOUD_THIRD_PARTY_MOBILE"
                        : this.pathParams,
                    false,
                    this.autoLoginEnable,
                    this.autoLoginRoom !== "-",
                    account?.login,
                    account?.pwd
                )
                if (this.autoLoginEnable) {
                    await event.once("game_login", async (e) => {
                        const payload = e.payload as { success: boolean }
                        console.log("game_login", payload.success)
                        if (payload.success) {
                            await this.addAccountReg()
                            const uid = await this.copyUID()
                            if (this.autoLoginRoom !== "-" && uid) {
                                const taskEnded = await addTaskAsyncMutation({
                                    roomId: this.autoLoginRoom,
                                    name: uid,
                                    maxUser: 3,
                                    maxAge: 15,
                                    desc: "软饭",
                                })
                                await autoOpen()
                                await new Promise((resolve) => setTimeout(resolve, 500))
                                console.log("taskEnded", taskEnded)
                                if (this.selectNext()) {
                                    setTimeout(() => this.launchGame(), 1000)
                                } else {
                                    await sendMessageMutation({
                                        roomId: this.autoLoginRoom,
                                        content: "饭发完了",
                                    })
                                }
                            }
                        }
                    })
                }
                // await shell.Command.create("cmd", ["/c", this.path, ...this.pathParams.split(" ")]).execute()
                // await shell.open(this.path)
                console.log("game exited")
            }
            if (this.afterGame && this.afterGameEnable) {
                console.log("afterGame")
                await shell.open(this.afterGame)
            }
        },

        async switchAccount(id: number) {
            this.selected = id
            await this.launchGame()
        },

        export_accounts() {
            return JSON.stringify(this.accounts)
        },

        async import_accounts(data: unknown) {
            if (!Array.isArray(data)) return
            db.gameAccounts.clear()
            const accs = data.map((s) => {
                const acc = createGameAccount(s)
                acc.token = s.token || s.regsk
                acc.hash = hash(acc.token || s.login)
                acc.name = s.name || s.desc
                acc.lock = s.lock ? 1 : 0
                return acc
            })
            // console.log(accs)
            await db.gameAccounts.bulkAdd(accs)
            await this.checkCurrentAccount()
        },
    },
})
