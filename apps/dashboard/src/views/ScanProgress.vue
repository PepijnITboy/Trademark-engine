<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { fetchScan, fetchScanProgress } from "../api/client";
import { useSmoothScanProgress } from "../composables/useSmoothScanProgress";
import { resolveActiveCheckpoint } from "../components/scan-progress/checkpoints";
import ProgressCheckpoints from "../components/scan-progress/ProgressCheckpoints.vue";

const route = useRoute();
const router = useRouter();
const scanId = computed(() => String(route.params.id));

const reducedMotion = ref(false);
let motionQuery: MediaQueryList | null = null;

function syncMotionPreference() {
  reducedMotion.value = Boolean(motionQuery?.matches);
}

onMounted(() => {
  motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  syncMotionPreference();
  motionQuery.addEventListener("change", syncMotionPreference);
});

onUnmounted(() => {
  motionQuery?.removeEventListener("change", syncMotionPreference);
});

const scanQuery = useQuery({
  queryKey: computed(() => ["scan", scanId.value]),
  queryFn: () => fetchScan(scanId.value),
  refetchInterval: 1000,
});

const progressQuery = useQuery({
  queryKey: computed(() => ["scan-progress", scanId.value]),
  queryFn: () => fetchScanProgress(scanId.value),
  refetchInterval: 1000,
});

const scanStatus = computed(() => scanQuery.data.value?.status);
const progress = computed(() => progressQuery.data.value);

const { displayPercent, finishing, readyToNavigate } = useSmoothScanProgress(
  progress,
  scanStatus,
);

const markText = computed(() => {
  const data = progress.value;
  if (data && data.markTotal > 1) {
    return (
      data.marks[data.currentMarkIndex]?.markText
      ?? scanQuery.data.value?.input.markText
      ?? ""
    );
  }
  return scanQuery.data.value?.input.markText ?? "";
});

const markTotal = computed(() => progress.value?.markTotal ?? 1);
const markIndex = computed(() => progress.value?.currentMarkIndex ?? 0);
const isBatch = computed(() => markTotal.value > 1);
const scanCompleted = computed(
  () => scanStatus.value === "completed" || finishing.value,
);

const activeCheckpoint = computed(() =>
  resolveActiveCheckpoint(displayPercent.value, scanCompleted.value),
);

const statusLabel = computed(() => {
  if (scanStatus.value === "failed") {
    return "Something went wrong";
  }
  return activeCheckpoint.value.statusLabel;
});

const statusKey = computed(() => {
  if (scanStatus.value === "failed") {
    return "failed";
  }
  return activeCheckpoint.value.id;
});

watch(readyToNavigate, (ready) => {
  if (ready) {
    void router.push({ name: "scan-results", params: { id: scanId.value } });
  }
});
</script>

<template>
  <section class="progress-page">
    <div v-if="scanQuery.isLoading.value || progressQuery.isLoading.value" class="boot">
      Preparing…
    </div>
    <div v-else-if="scanQuery.error.value" class="boot boot--error">
      {{ (scanQuery.error.value as Error).message }}
    </div>
    <div v-else class="progress-quiet">
      <p v-if="isBatch" class="batch-meta">
        Mark {{ markIndex + 1 }} of {{ markTotal }}
      </p>
      <p class="kicker">Scanning</p>

      <h1 class="mark-title">{{ markText || "Untitled mark" }}</h1>

      <div class="bar-wrap">
        <div
          class="bar"
          role="progressbar"
          :aria-valuenow="Math.round(displayPercent)"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="statusLabel"
        >
          <div class="bar-fill" :style="{ width: `${displayPercent}%` }">
            <span class="bar-shimmer" />
          </div>
        </div>
        <ProgressCheckpoints
          :percent="displayPercent"
          :scan-completed="scanCompleted"
          :reduced-motion="reducedMotion"
        />
      </div>

      <div class="status-slot">
        <Transition name="status-fade" mode="out-in">
          <p :key="statusKey" class="status" :class="{ 'status--error': scanStatus === 'failed' }">
            {{ statusLabel }}
          </p>
        </Transition>
      </div>
    </div>
  </section>
</template>

<style scoped>
.progress-page {
  min-height: calc(100vh - 4rem);
  display: grid;
  place-items: center;
  padding: 2.5rem 1.5rem;
  background: #f8fafc;
}

.boot {
  color: #64748b;
  font-size: 0.95rem;
}

.boot--error {
  color: #b91c1c;
}

.progress-quiet {
  width: min(480px, 100%);
  text-align: center;
}

.batch-meta,
.kicker {
  margin: 0 0 0.75rem;
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #94a3b8;
  font-weight: 500;
}

.batch-meta {
  margin-bottom: 0.35rem;
}

.mark-title {
  margin: 0 0 1.75rem;
  font-size: clamp(1.75rem, 4vw, 2.35rem);
  font-weight: 650;
  letter-spacing: -0.03em;
  color: #0f172a;
  line-height: 1.15;
  word-break: break-word;
}

.bar-wrap {
  position: relative;
  width: 100%;
  padding-bottom: 1.75rem;
}

.bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: inherit;
  background: #0f172a;
  position: relative;
  overflow: hidden;
  transition: width 0.05s linear;
}

.bar-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    110deg,
    transparent 30%,
    rgba(255, 255, 255, 0.35) 50%,
    transparent 70%
  );
  animation: shimmer 2s ease-in-out infinite;
}

.status-slot {
  margin-top: 0.85rem;
  min-height: 1.4rem;
}

.status {
  margin: 0;
  font-size: 0.9rem;
  color: #64748b;
}

.status--error {
  color: #b91c1c;
}

.status-fade-enter-active,
.status-fade-leave-active {
  transition: opacity 0.45s ease;
}

.status-fade-enter-from,
.status-fade-leave-to {
  opacity: 0;
}

@keyframes shimmer {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(120%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bar-shimmer {
    animation: none;
  }

  .status-fade-enter-active,
  .status-fade-leave-active {
    transition: opacity 0.15s ease;
  }
}
</style>
