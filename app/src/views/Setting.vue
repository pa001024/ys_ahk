<script lang="ts" setup>
import { useQuery, gql, useMutation } from "@urql/vue"
import Select, { SelectGroup, SelectLabel, SelectSeparator, SelectItem } from "../components/select"
import { useSettingStore } from "../mod/state/setting"
import { computed, reactive } from "vue"

const setting = useSettingStore()
const lightThemes = [
    "light",
    "lofi",
    "cupcake",
    "retro",
    "valentine",
    "garden",
    "aqua",
    "pastel",
    "wireframe",
    "winter",
    "cyberpunk",
    "corporate",
    "bumblebee",
    "emerald",
    "fantasy",
    "cmyk",
    "autumn",
    "acid",
    "lemonade",
]
const darkThemes = [
    "dark",
    "black",
    "curses",
    "matrix",
    "staffy",
    "synthwave",
    "halloween",
    "forest",
    "dracula",
    "business",
    "night",
    "coffee",
    //
]

const { data, executeQuery: reloadMe } = useQuery({
    query: /* GraphQL */ gql`
        {
            me {
                id
                name
                qq
                email
            }
        }
    `,
})

const { executeMutation: loginMutation } = useMutation(gql`
    mutation ($email: String!, $password: String!) {
        login(password: $password, email: $email) {
            success
            message
            token
            user {
                id
                name
                qq
                email
            }
        }
    }
`)
async function login() {
    const result = await loginMutation({ email: loginForm.email, password: loginForm.password })
    const body = result.data.login
    if (body.success) {
        loginForm.open = false
        setting.token = body.token
        setting.name = body.user.name
        setting.email = body.user.email
        setting.qq = body.user.qq
    } else {
        loginForm.error = body.message
    }
}

const loginForm = reactive({
    open: false,
    error: "",
    email: "",
    password: "",
})

const { executeMutation: registerMutation } = useMutation(gql`
    mutation ($name: String!, $qq: String!, $email: String!, $password: String!) {
        register(name: $name, qq: $qq, email: $email, password: $password) {
            success
            message
            token
            user {
                id
                name
                qq
                email
            }
        }
    }
`)
const registerForm = reactive({
    open: false,
    error: "",
    name: "",
    qq: "",
    email: "",
    password: "",
})
async function register() {
    const result = await registerMutation({
        email: registerForm.email,
        name: registerForm.name,
        qq: registerForm.qq,
        password: registerForm.password,
    })
    const body = result.data.register
    if (body.success) {
        registerForm.open = false
        setting.token = body.token
        setting.name = body.user.name
        setting.email = body.user.email
        setting.qq = body.user.qq
    } else {
        registerForm.error = body.message
    }
}

const { executeMutation: updatePasswordMutation } = useMutation(gql`
    mutation ($old_password: String!, $new_password: String!) {
        updatePassword(old_password: $old_password, new_password: $new_password) {
            success
        }
    }
`)
const updatePasswordForm = reactive({
    open: false,
    error: "",
    old_password: "",
    new_password: "",
})

async function updatePassword() {
    const result = await updatePasswordMutation({
        old_password: updatePasswordForm.old_password,
        new_password: updatePasswordForm.new_password,
    })
    const body = result.data.updatePassword
    if (body.success) {
        updatePasswordForm.open = false
    } else {
        updatePasswordForm.error = body.message
    }
}

const needUpdate = computed(() => {
    if (data.value?.me) {
        return data.value.me.name !== setting.name || data.value.me.qq !== setting.qq
    }
    return false
})

function reset(obj: any) {
    for (let key in obj) {
        if (Array.isArray(obj[key])) {
            obj[key] = []
        } else if (typeof obj[key] === "object") {
            reset(obj[key])
        } else if (typeof obj[key] === "string") {
            obj[key] = ""
        } else if (typeof obj[key] === "number") {
            obj[key] = 0
        } else if (typeof obj[key] === "boolean") {
            obj[key] = false
        }
    }
}

// 首字母大写
function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}
</script>

<template>
    <div class="w-full h-full overflow-y-auto">
        <div class="p-4 flex flex-col gap-4 max-w-xl m-auto">
            <article>
                <h2 class="text-sm font-bold m-2">{{ $t("setting.appearance") }}</h2>
                <div class="bg-base-100 p-2 rounded-lg">
                    <div class="form-control">
                        <div class="label">
                            <span class="label-text">{{ $t("setting.theme") }}</span>
                            <Select v-model="setting.theme" :placeholder="$t('setting.theme')">
                                <SelectLabel class="p-2 text-sm font-semibold text-primary">
                                    {{ $t("setting.lightTheme") }}
                                </SelectLabel>
                                <SelectGroup>
                                    <SelectItem v-for="th in lightThemes" :key="th" :value="th">
                                        {{ capitalize(th) }}
                                    </SelectItem>
                                </SelectGroup>
                                <SelectSeparator />
                                <SelectLabel class="p-2 text-sm font-semibold text-primary">
                                    {{ $t("setting.darkTheme") }}
                                </SelectLabel>
                                <SelectGroup>
                                    <SelectItem v-for="th in darkThemes" :key="th" :value="th">
                                        {{ capitalize(th) }}
                                    </SelectItem>
                                </SelectGroup>
                            </Select>
                        </div>
                    </div>
                    <div class="form-control">
                        <div class="label">
                            <span class="label-text">
                                {{ $t("setting.windowTrasnparent") }}
                                <div class="text-xs text-base-content/50">{{ $t("setting.windowTrasnparentTip") }}</div>
                            </span>
                            <input v-model="setting.windowTrasnparent" type="checkbox" class="toggle toggle-secondary" checked />
                        </div>
                    </div>
                    <div class="form-control">
                        <div class="label">
                            <span class="label-text">{{ $t("setting.uiScale") }}</span>
                            <div class="min-w-56">
                                <input
                                    :value="setting.uiScale"
                                    @input="setting.uiScale = +($event.target as HTMLInputElement)!.value"
                                    type="range"
                                    class="range range-secondary"
                                    min="0.8"
                                    max="1.5"
                                    step="0.1"
                                />
                                <div class="w-full flex justify-between text-xs px-1">
                                    <span :class="{ 'text-secondary': setting.uiScale.toFixed(1) === (0.7 + i / 10).toFixed(1) }" v-for="i in 8" :key="i">{{
                                        (0.7 + i / 10).toFixed(1)
                                    }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </article>
            <article>
                <h2 class="text-sm font-bold m-2">{{ $t("setting.account") }}</h2>
                <div class="bg-base-100 p-2 rounded-lg">
                    <div class="form-control">
                        <div class="label">
                            <span class="label-text">
                                {{ $t("setting.login") }}
                                <div class="text-xs text-base-content/50">{{ $t("setting.loginTip") }}</div>
                            </span>
                            <div class="flex justify-between gap-2 min-w-56" v-if="data?.me">
                                <div class="label grow text-sm">{{ data.me.email }}</div>
                                <div class="btn btn-sm grow" @click=";(setting.token = ''), reloadMe({ requestPolicy: 'network-only' })">
                                    {{ $t("setting.logout") }}
                                </div>
                            </div>
                            <div class="flex justify-between gap-2 min-w-56" v-else>
                                <Dialog
                                    class="btn btn-sm grow"
                                    :title="$t('login.login')"
                                    @submit="login()"
                                    @close="reset(loginForm)"
                                    v-model="loginForm.open"
                                    :error="loginForm.error"
                                >
                                    {{ $t("login.login") }}
                                    <template #content>
                                        <div class="form-control space-y-4">
                                            <label class="input input-bordered flex items-center gap-2">
                                                <Icon icon="fa6:envelope" class="w-4 h-4 opacity-70" />
                                                <input v-model="loginForm.email" type="email" class="grow" :placeholder="$t('setting.email')" />
                                            </label>
                                            <label class="input input-bordered flex items-center gap-2">
                                                <Icon icon="fa6:key" class="w-4 h-4 opacity-70" />
                                                <input v-model="loginForm.password" type="password" class="grow" :placeholder="$t('setting.password')" />
                                            </label>
                                        </div>
                                    </template>
                                </Dialog>
                                <Dialog
                                    class="btn btn-sm grow"
                                    :title="$t('login.register')"
                                    @submit="register"
                                    @close="reset(registerForm)"
                                    v-model="registerForm.open"
                                    :error="registerForm.error"
                                >
                                    {{ $t("login.register") }}
                                    <template #content>
                                        <div class="form-control space-y-4">
                                            <label class="input input-bordered flex items-center gap-2">
                                                <Icon icon="fa6:envelope" class="w-4 h-4 opacity-70" />
                                                <input v-model="registerForm.email" type="email" class="grow" :placeholder="$t('setting.email')" />
                                            </label>
                                            <label class="input input-bordered flex items-center gap-2">
                                                <Icon icon="fa6:user" class="w-4 h-4 opacity-70" />
                                                <input v-model="registerForm.name" type="text" class="grow" :placeholder="$t('setting.nickname')" />
                                            </label>
                                            <label class="input input-bordered flex items-center gap-2">
                                                <Icon icon="fa6:qq" class="w-4 h-4 opacity-70" />
                                                <input v-model="registerForm.qq" type="text" class="grow" :placeholder="$t('setting.qq')" />
                                            </label>
                                            <label class="input input-bordered flex items-center gap-2">
                                                <Icon icon="fa6:key" class="w-4 h-4 opacity-70" />
                                                <input v-model="registerForm.password" type="password" class="grow" :placeholder="$t('setting.password')" />
                                            </label>
                                        </div>
                                    </template>
                                </Dialog>
                            </div>
                        </div>
                    </div>
                    <div class="form-control">
                        <label class="cursor-pointer label">
                            <span class="label-text">{{ $t("setting.nickname") }}</span>
                            <input v-model="setting.name" type="text" class="input input-bordered input-sm min-w-56" />
                        </label>
                    </div>
                    <div class="form-control">
                        <label class="cursor-pointer label">
                            <span class="label-text">
                                {{ $t("setting.qq") }}
                                <div class="text-xs text-base-content/50">{{ $t("setting.qqTip") }}</div>
                            </span>
                            <input v-model="setting.qq" type="text" class="input input-bordered input-sm min-w-56" />
                        </label>
                    </div>
                    <div class="form-control" v-if="data?.me">
                        <label class="cursor-pointer label">
                            <span class="label-text">
                                {{ $t("setting.password") }}
                            </span>
                            <div class="flex justify-between gap-2 min-w-56">
                                <Dialog
                                    class="btn btn-sm grow"
                                    :title="$t('login.updatePassword')"
                                    @submit="updatePassword()"
                                    @close="reset(updatePasswordForm)"
                                    v-model="updatePasswordForm.open"
                                    :error="updatePasswordForm.error"
                                >
                                    {{ $t("login.updatePassword") }}
                                    <template #content>
                                        <div class="form-control space-y-4">
                                            <label class="input input-bordered flex items-center gap-2">
                                                <Icon icon="fa6:envelope" class="w-4 h-4 opacity-70" />
                                                <input v-model="updatePasswordForm.old_password" type="password" class="grow" :placeholder="$t('setting.old_password')" />
                                            </label>
                                            <label class="input input-bordered flex items-center gap-2">
                                                <Icon icon="fa6:user" class="w-4 h-4 opacity-70" />
                                                <input v-model="updatePasswordForm.new_password" type="password" class="grow" :placeholder="$t('setting.new_password')" />
                                            </label>
                                        </div>
                                    </template>
                                </Dialog>
                            </div>
                        </label>
                    </div>
                    <div class="form-control" v-if="needUpdate">
                        <label class="cursor-pointer label">
                            <span class="label-text">
                                {{ $t("setting.change") }}
                                <div class="text-xs text-base-content/50">{{ $t("setting.syncConfig") }}</div>
                            </span>
                            <div class="flex justify-between gap-2 min-w-56">
                                <div class="btn btn-sm grow">
                                    {{ $t("setting.save") }}
                                </div>
                            </div>
                        </label>
                    </div>
                </div>
            </article>
            <article>
                <h2 class="text-sm font-bold m-2">{{ $t("setting.counter") }}</h2>
                <div class="bg-base-100 p-2 rounded-lg">
                    <div class="form-control">
                        <div class="label">
                            <span class="label-text">{{ $t("setting.autoCount") }}</span>
                            <input v-model="setting.autoCount" type="checkbox" class="toggle toggle-secondary" checked />
                        </div>
                    </div>
                    <div class="form-control">
                        <div class="label">
                            <span class="label-text"
                                >{{ $t("setting.minCountInterval") }}
                                <div class="text-xs text-base-content/50">{{ $t("setting.minCountIntervalTip") }}</div>
                            </span>
                            <div class="min-w-56">
                                <input
                                    :value="setting.minCountInterval"
                                    @input="setting.minCountInterval = Math.max(35, Math.min(60, +($event.target as HTMLInputElement)!.value))"
                                    type="range"
                                    class="range range-secondary"
                                    min="35"
                                    max="60"
                                    step="5"
                                />
                                <div class="w-full flex justify-between text-xs px-2">
                                    <span :class="{ 'text-secondary': setting.minCountInterval === 35 }">35</span>
                                    <span :class="{ 'text-secondary': setting.minCountInterval === 40 }">40</span>
                                    <span :class="{ 'text-secondary': setting.minCountInterval === 45 }">45</span>
                                    <span :class="{ 'text-secondary': setting.minCountInterval === 50 }">50</span>
                                    <span :class="{ 'text-secondary': setting.minCountInterval === 55 }">55</span>
                                    <span :class="{ 'text-secondary': setting.minCountInterval === 60 }">60</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </article>
            <!-- <article>
                <h2 class="text-sm font-bold m-2">{{ $t("setting.yunlian") }}</h2>
                <div class="bg-base-100 p-2 rounded-lg">
                    <div class="form-control">
                        <label class="cursor-pointer label">
                            <span class="label-text">API-KEY (<a class="link" href="https://www.links168.com/api_info.html" target="_blank" rel="noopener noreferrer">?</a>) </span>
                            <input v-model="setting.yunlianAPIKey" type="text" class="input input-bordered input-sm" />
                        </label>
                    </div>
                    <div class="form-control">
                        <label class="cursor-pointer label">
                            <span class="label-text">手机号</span>
                            <input v-model="setting.yunlianPhone" type="text" class="input input-bordered input-sm" />
                        </label>
                    </div>
                </div>
            </article> -->
        </div>
    </div>
</template>
