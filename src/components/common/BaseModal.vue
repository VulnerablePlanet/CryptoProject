<script setup>
/**
 * BaseModal — shared dialog shell.
 *
 * Provides what every modal in the app needs but previously re-implemented
 * (six copies): teleport, backdrop, header with close button, transition,
 * plus behaviour that was missing everywhere:
 *  - backdrop click closes (the old `@click.self` never fired because the
 *    backdrop element covered the container),
 *  - Escape closes,
 *  - role="dialog" + aria-modal + aria-labelledby,
 *  - focus moves into the dialog, Tab is kept inside, and focus returns to
 *    the triggering control on close,
 *  - page scroll is locked while open.
 */
import { ref, watch, nextTick, onBeforeUnmount, useId } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  /** Tailwind max-width class for the panel */
  maxWidth: { type: String, default: 'max-w-md' },
  /** Disable backdrop/Escape dismissal (e.g. while a request is in flight) */
  persistent: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const titleId = useId()
const panel = ref(null)
let previouslyFocused = null

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const requestClose = () => {
  if (!props.persistent) emit('close')
}

const onKeydown = (event) => {
  if (event.key === 'Escape') {
    event.stopPropagation()
    requestClose()
    return
  }
  if (event.key !== 'Tab' || !panel.value) return
  const focusable = [...panel.value.querySelectorAll(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null
  )
  if (focusable.length === 0) {
    event.preventDefault()
    return
  }
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

const lockScroll = (locked) => {
  document.documentElement.style.overflow = locked ? 'hidden' : ''
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      previouslyFocused = document.activeElement
      lockScroll(true)
      await nextTick()
      // Prefer the first form field; fall back to the panel itself
      const target =
        panel.value?.querySelector('[autofocus], input:not([type="hidden"]), select, textarea') ||
        panel.value
      target?.focus({ preventScroll: true })
    } else {
      lockScroll(false)
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus({ preventScroll: true })
      }
      previouslyFocused = null
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (props.open) lockScroll(false)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @keydown="onKeydown"
      >
        <!-- Backdrop (mouse affordance; keyboard users have Escape and the close button) -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          aria-hidden="true"
          @click="requestClose"
        ></div>

        <!-- Panel -->
        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
          class="modal-panel relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none dark:bg-card-dark"
          :class="maxWidth"
        >
          <!-- Header -->
          <div
            class="flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 p-6 dark:border-border-dark"
          >
            <h2 :id="titleId" class="text-xl font-bold text-slate-900 dark:text-white">
              {{ title }}
            </h2>
            <button
              type="button"
              class="-mr-2 flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-gray-100 hover:text-slate-900 dark:text-text-secondary dark:hover:bg-border-dark dark:hover:text-white"
              aria-label="Close dialog"
              @click="emit('close')"
            >
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>

          <!-- Body (scrolls when content exceeds the viewport) -->
          <div class="min-h-0 flex-1 overflow-y-auto">
            <slot />
          </div>

          <!-- Optional footer (stays visible while the body scrolls) -->
          <div v-if="$slots.footer" class="shrink-0">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
