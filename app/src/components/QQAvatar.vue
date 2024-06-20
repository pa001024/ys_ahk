<script lang="ts" setup>
import { useImage } from "@vueuse/core"

const props = defineProps<{
    qq: string | number
    name: string
}>()

const src = `http://q2.qlogo.cn/headimg_dl?dst_uin=${props.qq}&spec=100`

const { isReady } = useImage({ src })
</script>

<template>
    <div class="avatar" :class="{ placeholder: !isReady }" v-bind="$attrs">
        <div class="w-8 rounded-full" :class="{ 'bg-neutral text-neutral-content': !isReady }">
            <img v-if="isReady" :src="src" :alt="name" />
            <span v-else>{{ name.slice(0, 2) }}</span>
        </div>
    </div>
</template>
