<script lang="ts" setup>
import * as dialog from "@tauri-apps/plugin-dialog"
import { useGameStore } from "../mod/state/game"
import { useTranslation } from "i18next-vue"
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from "radix-vue"
import gsap from "gsap"
import { ref, watchEffect } from "vue"

const game = useGameStore()
const { t } = useTranslation()

const keys = ["path", "beforeGame", "afterGame"] as const

async function select_cmd(key: (typeof keys)[number]) {
    const result = await dialog.open({
        defaultPath: game[key],
        filters:
            key === "path"
                ? [{ name: "YuanShen.exe", extensions: ["exe"] }]
                : [
                      { name: t("misc.exec_files"), extensions: ["exe", "bat", "cmd", "ahk", "ps1"] },
                      { name: t("misc.all_files"), extensions: ["*"] },
                  ],
    })
    if (result && result.path) {
        game[key] = result.path
    }
}

async function clear_accounts() {
    if (await dialog.confirm(t("game.clear_accounts_confirm"))) {
        game.clear_accounts()
    }
}

function spin_y_enter(el: any, done: () => void) {
    gsap.from(el, { duration: 0.3, rotateX: 180, onComplete: done })
}
function spin_y_leave(el: any, done: () => void) {
    gsap.set(el, { duration: 0.3, position: "absolute", onComplete: done })
}

const scrollRef = ref<HTMLDivElement | null>(null)

function scrollToCenter(id: string = game.selected) {
    const viewNode = scrollRef.value?.children[0]
    if (!viewNode) return
    viewNode.children[game.accounts.findIndex((acc) => acc.id === id)].scrollIntoView({ behavior: "smooth", block: "center" })
}

async function switch_account(id: string) {
    game.selected = id
    scrollToCenter()
    await game.switch_account(id)
}

function select_next() {
    if (game.select_next()) {
        scrollToCenter()
    }
}

watchEffect(() => {
    if (game.selected) {
        scrollToCenter(game.selected)
    }
})
</script>

<template>
    <div class="flex flex-col w-full h-full overflow-hidden p-4 space-y-2">
        <CollapsibleRoot class="space-y-2" v-model:open="game.expend">
            <div class="join w-full">
                <div v-if="game.running" @click="game.launch_game" class="join-item btn btn-primary btn-disabled flex-1">{{ $t("game.launched") }}</div>
                <div v-else @click="game.launch_game" class="join-item btn btn-primary flex-1">{{ $t("game.launch") }}</div>
                <CollapsibleTrigger class="join-item btn btn-primary inline-flex items-center justify-center">
                    <Transition @enter="spin_y_enter" @leave="spin_y_leave" :css="false">
                        <Icon icon="radix-icons:chevron-up" v-if="game.expend" class="size-5" />
                        <Icon icon="radix-icons:chevron-down" v-else class="size-5" />
                    </Transition>
                </CollapsibleTrigger>
            </div>

            <CollapsibleContent class="data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp overflow-hidden">
                <div v-for="key in keys" :key="key">
                    <div class="form-control flex flex-row justify-between items-center flex-wrap">
                        <label class="label cursor-pointer space-x-2 min-w-32 justify-start">
                            <input type="checkbox" v-model="game[`${key}Enable`]" class="checkbox checkbox-primary" />
                            <span class="label-text">{{ $t("game." + key) }}</span>
                        </label>
                        <div class="flex flex-1 space-x-2" v-show="game[`${key}Enable`]">
                            <input type="text" disabled :value="game[key]" :placeholder="$t('misc.selectPath')" class="input input-bordered input-sm w-full min-w-32" />
                            <div class="btn btn-primary btn-sm" @click="select_cmd(key)">{{ $t("misc.select") }}</div>
                        </div>
                    </div>
                    <div class="form-control flex flex-row justify-between items-center flex-wrap" v-if="key === 'path' && game[`${key}Enable`]">
                        <label class="label cursor-pointer min-w-32 justify-start">
                            <span class="label-text ml-12">{{ $t("game.params") }}</span>
                        </label>
                        <div class="flex flex-1 space-x-2" v-show="game[`${key}Enable`]">
                            <input type="text" v-model="game[`${key}Params`]" class="input input-bordered input-sm w-full min-w-32" />
                        </div>
                    </div>
                </div>
            </CollapsibleContent>
        </CollapsibleRoot>

        <div class="mb-4 space-x-2">
            <Tooltip :tooltip="$t('game.add_account_reg')" side="top">
                <CheckAnimationButton icon="la:plus-solid" @click="game.add_account_reg" />
            </Tooltip>
            <Tooltip :tooltip="$t('game.importAccountsTooltip')" side="top">
                <CheckAnimationButton icon="la:paste-solid" @click="game.import_accounts_from_cliboard" :aria-label="$t('game.importAccounts')" />
            </Tooltip>
            <Tooltip :tooltip="$t('game.selectNext')" side="top">
                <CheckAnimationButton icon="la:step-forward-solid" @click="select_next" />
            </Tooltip>
            <Tooltip :tooltip="$t('game.clearAccounts')" side="top">
                <CheckAnimationButton icon="la:broom-solid" @click="clear_accounts" />
            </Tooltip>
        </div>
        <div class="bg-base-100 p-4 w-full justify-items-center rounded-lg flex-1 flex flex-col overflow-hidden">
            <label class="label cursor-pointer space-x-2 group p-1 h-9">
                <input type="radio" name="radio-10" class="radio radio-secondary radio-sm" value="" v-model="game.selected" />
                <span class="label-text flex-1 text-ellipsis overflow-hidden">{{ $t("game.justStart") }}</span>
            </label>
            <ScrollArea class="overflow-hidden flex-1" @loadref="(r) => (scrollRef = r)">
                <div class="label cursor-pointer space-x-2 group h-9" v-for="acc in game.accounts" :key="acc.id">
                    <label class="label space-x-2 p-0">
                        <input type="radio" name="radio-10" class="radio radio-secondary radio-sm" :value="acc.id" v-model="game.selected" />
                        <Tooltip v-if="acc.regsk" :tooltip="$t('game.accountTypeU')" side="top">
                            <div class="rounded text-sm border p-0.5 px-1.5 size-6 text-center whitespace-nowrap border-secondary text-secondary">R</div>
                        </Tooltip>
                        <Tooltip v-if="acc.login && acc.pwd" :tooltip="$t('game.accountTypeP')" side="top">
                            <div class="rounded text-sm border p-0.5 px-1.5 size-6 text-center whitespace-nowrap">P</div>
                        </Tooltip>
                        <span class="label-text flex-1 text-ellipsis overflow-hidden">
                            {{ (acc.uid && `UID:${acc.uid}${acc.login ? ` (${acc.login})` : ""}`) || acc.login || acc.id.slice(0, 12) }}
                        </span>
                    </label>
                    <div class="join group-hover:opacity-100 opacity-0 transition-all duration-300 pr-4">
                        <Tooltip v-if="acc.login && acc.pwd" :tooltip="$t('game.copyTooltip')" side="top">
                            <div class="btn btn-sm join-item" @click.stop="game.copy_account(acc.id)">
                                <Icon icon="la:copy-solid" />
                            </div>
                        </Tooltip>
                        <Tooltip :tooltip="$t('game.deleteTooltip')" side="top">
                            <div class="btn btn-sm join-item" @click.stop="game.delete_account(acc.id)">
                                <Icon icon="la:trash-alt" />
                            </div>
                        </Tooltip>
                        <Tooltip :tooltip="$t('game.lockTooltip')" side="top">
                            <div class="btn btn-sm join-item" @click.stop="game.lock_account(acc.id)">
                                <Icon v-if="acc.lock" icon="la:lock-solid" />
                                <Icon v-else icon="la:lock-open-solid" />
                            </div>
                        </Tooltip>
                        <Tooltip :tooltip="$t('game.switchTooltip')" side="top">
                            <div class="btn btn-sm join-item" @click.stop="switch_account(acc.id)">
                                <Icon icon="la:exchange-alt-solid" />
                            </div>
                        </Tooltip>
                    </div>
                </div>
            </ScrollArea>
        </div>
    </div>
</template>
