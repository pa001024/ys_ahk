<script setup lang="ts">
import { ref } from "vue"
import { arrow, flip, offset, shift, useFloating } from "@floating-ui/vue"
import motion from "vue-pose"

const props = defineProps({
    content: String,
    interact: {
        type: String,
        default: "click",
        validator: (value: string) => ["hover", "click", "context"].includes(value),
    },
    placement: String,
    targetOffset: { type: Number, default: 8 },
})

const isOpen = ref(false)
const reference = ref(null)
const floating = ref(null)
const arrowRef = ref(null)
const { floatingStyles, middlewareData } = useFloating(reference, floating, {
    middleware: [shift({ padding: 8 }), offset(props.targetOffset), flip(), arrow({ element: arrowRef, padding: 20 })],
})

const handleClose = () => {
    isOpen.value = false
}

const handleContext = (event: MouseEvent) => {
    if (props.interact === "context") {
        event.preventDefault()
        isOpen.value = true
    }
}

const Inspector = motion.span({
    initial: { scale: 0.95, opacity: 0 },
    exit: { scale: 0.97, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { ease: "anticipate", duration: 0.15 },
})
</script>
<template>
    <span @contextmenu="handleContext" v-bind="props" ref="reference" @blur="handleClose">
        <slot></slot>
    </span>
    <teleport to="body">
        <Inspector class="z-50 shadow-lg rounded-box" :style="floatingStyles">
            <div :key="'dropdown-content'" class="dropdown" ref="floating">
                <div class="dropdown-arrow" ref="arrowRef" :style="{ left: middlewareData.arrow?.x || -5, top: middlewareData.arrow?.y }"></div>
                <slot name="content"></slot>
            </div>
        </Inspector>
    </teleport>
</template>

<style lang="postcss" scoped></style>
