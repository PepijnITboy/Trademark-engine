<script setup lang="ts">
import { computed, watch, ref } from "vue";
import {
  PROGRESS_CHECKPOINTS,
  checkpointState,
  type CheckpointState,
} from "./checkpoints";

const props = defineProps<{
  percent: number;
  scanCompleted: boolean;
  reducedMotion: boolean;
}>();

const celebrated = ref<Record<string, boolean>>({});

const items = computed(() =>
  PROGRESS_CHECKPOINTS.map((checkpoint) => {
    const state = checkpointState(
      checkpoint,
      props.percent,
      props.scanCompleted,
    );
    return {
      ...checkpoint,
      state,
      celebrate:
        state === "complete" &&
        !props.reducedMotion &&
        celebrated.value[checkpoint.id] !== true,
    };
  }),
);

watch(
  () => items.value.map((item) => `${item.id}:${item.state}`).join("|"),
  () => {
    for (const item of items.value) {
      if (item.state === "complete" && celebrated.value[item.id] !== true) {
        // Mark celebrated after animation window so class can play once.
        window.setTimeout(() => {
          celebrated.value = { ...celebrated.value, [item.id]: true };
        }, props.reducedMotion ? 0 : 520);
      }
    }
  },
  { immediate: true },
);

function stateClass(state: CheckpointState): string {
  return `cp--${state}`;
}
</script>

<template>
  <ol class="checkpoints" aria-label="Scan checkpoints">
    <li
      v-for="item in items"
      :key="item.id"
      class="cp"
      :class="[
        stateClass(item.state),
        {
          'cp--celebrate': item.state === 'complete' && !celebrated[item.id] && !reducedMotion,
          'cp--reduced': reducedMotion,
        },
      ]"
      :style="{ left: `${item.threshold}%` }"
    >
      <span class="cp-burst" aria-hidden="true">
        <i v-for="n in 6" :key="n" :style="{ '--i': n }" />
      </span>
      <span class="cp-dot">
        <span class="cp-swell" aria-hidden="true" />
        <svg class="cp-check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            class="cp-check-path"
            d="M3.2 8.3L6.5 11.4L12.8 4.6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class="cp-label">{{ item.label }}</span>
    </li>
  </ol>
</template>

<style scoped>
.checkpoints {
  /* Sit exactly on the 6px bar track (not the padded bar-wrap). */
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  pointer-events: none;
}

.cp {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 2;
}

.cp-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #cbd5e1;
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  color: transparent;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.cp-swell {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle, #4ade80 0%, #16a34a 70%);
  transform: scale(0);
  opacity: 0;
}

.cp-check {
  width: 10px;
  height: 10px;
  position: relative;
  z-index: 1;
}

.cp-check-path {
  stroke-dasharray: 18;
  stroke-dashoffset: 18;
}

.cp-label {
  position: absolute;
  top: calc(100% + 0.55rem);
  white-space: nowrap;
  font-size: 0.65rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #94a3b8;
  font-weight: 500;
}

.cp--active .cp-dot {
  border-color: #0f172a;
  box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
  animation: cp-pulse 1.4s ease-in-out infinite;
}

.cp--active .cp-label {
  color: #475569;
}

.cp--complete .cp-dot {
  border-color: #16a34a;
  background: #16a34a;
  color: #fff;
}

.cp--complete .cp-check-path {
  stroke-dashoffset: 0;
}

.cp--complete .cp-label {
  color: #15803d;
}

.cp--complete .cp-swell {
  transform: scale(1);
  opacity: 1;
}

/* Celebrate once */
.cp--celebrate .cp-dot {
  animation: cp-hit 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}

.cp--celebrate .cp-swell {
  animation: cp-swell 0.42s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

.cp--celebrate .cp-check-path {
  animation: cp-draw 0.22s ease-out 0.08s forwards;
  stroke-dashoffset: 18;
}

.cp--celebrate .cp-burst i {
  animation: cp-poof 0.28s ease-out forwards;
}

.cp-burst {
  position: absolute;
  top: 9px;
  left: 50%;
  width: 0;
  height: 0;
  z-index: 0;
}

.cp-burst i {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(74, 222, 128, 0.85);
  opacity: 0;
  --angle: calc(var(--i) * 60deg);
  transform: rotate(var(--angle)) translateY(0) scale(0.4);
}

.cp--reduced.cp--complete .cp-check-path {
  stroke-dashoffset: 0;
  animation: none;
}

.cp--reduced.cp--complete .cp-swell,
.cp--reduced .cp-burst i {
  animation: none;
}

.cp--reduced.cp--active .cp-dot {
  animation: none;
}

@keyframes cp-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(15, 23, 42, 0.04);
  }
}

@keyframes cp-hit {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.28);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes cp-swell {
  0% {
    transform: scale(0);
    opacity: 0.9;
  }
  55% {
    transform: scale(1.05);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes cp-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes cp-poof {
  0% {
    opacity: 0.9;
    transform: rotate(var(--angle)) translateY(0) scale(0.5);
  }
  100% {
    opacity: 0;
    transform: rotate(var(--angle)) translateY(-16px) scale(0.15);
  }
}

@media (max-width: 520px) {
  .cp-label {
    display: none;
  }
}
</style>
