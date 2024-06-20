<script setup lang="ts">
import { watch } from "vue"

defineProps<{
    title?: string
    description?: string
    error?: string
}>()

const emit = defineEmits(["close", "submit"])
const model = defineModel<boolean>()
watch(model, (value) => {
    if (!value) {
        emit("close")
    }
})
</script>

<template>
    <DialogRoot v-model:open="model">
        <DialogTrigger v-bind="$attrs">
            <slot></slot>
        </DialogTrigger>
        <DialogPortal>
            <DialogOverlay class="bg-blackA5 data-[state=open]:animate-overlayShow fixed inset-0 z-30" />
            <DialogContent
                class="data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] max-w-[450px] translate-x-[-50%] translate-y-[-50%] rounded-lg bg-base-100 shadow-lg z-[100]"
            >
                <DialogTitle class="ml-6 mt-6 text-lg text-base-content font-semibold">{{ title }}</DialogTitle>
                <DialogDescription class="text-base-content/60 mt-2.5 mb-5 text-sm">{{ description }}</DialogDescription>

                <div class="space-y-4">
                    <div class="text-error text-sm px-6 animate-shake" v-if="error">{{ error }}</div>

                    <div class="px-6">
                        <slot name="content"></slot>
                    </div>

                    <hr class="border-t-base-content/30" />

                    <div class="flex justify-end px-6 pb-6">
                        <slot name="actions">
                            <button class="btn btn-primary w-full" @click="$emit('submit')">
                                {{ $t("common.confirm") }}
                            </button>
                        </slot>
                    </div>
                </div>
                <DialogClose class="btn btn-square btn-sm text-lg btn-ghost absolute top-[10px] right-[10px]">
                    <Icon icon="radix-icons:cross2" />
                </DialogClose>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>
