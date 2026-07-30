<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { fetchScan, fetchScanProgress } from "../api/client";

const route = useRoute();
const router = useRouter();
const scanId = computed(() => String(route.params.id));

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

const percentComplete = computed(
  () => progressQuery.data.value?.percentComplete ?? 0,
);

const markTotal = computed(() => progressQuery.data.value?.markTotal ?? 1);
const isBatch = computed(() => markTotal.value > 1);

const etaText = computed(() => {
  const remainingMs = progressQuery.data.value?.estimatedRemainingMs;
  if (remainingMs == null) {
    return "Estimating…";
  }
  if (remainingMs <= 0) {
    return "Finishing…";
  }
  const seconds = Math.max(1, Math.round(remainingMs / 1000));
  return `~${seconds}s remaining`;
});

function formatCounts(counts?: Record<string, number>): string {
  if (!counts) {
    return "";
  }
  return Object.entries(counts)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}

watch(
  () => scanQuery.data.value?.status,
  (status) => {
    if (status === "completed") {
      void router.push({ name: "scan-results", params: { id: scanId.value } });
    }
  },
);
</script>

<template>
  <section>
    <h1>Scan progress</h1>
    <p class="muted">Scan ID: {{ scanId }}</p>

    <div v-if="scanQuery.isLoading.value || progressQuery.isLoading.value" class="card">
      Loading progress…
    </div>
    <div v-else-if="scanQuery.error.value" class="card error">
      {{ (scanQuery.error.value as Error).message }}
    </div>
    <div v-else class="card">
      <p>
        Status:
        <span class="badge">{{ scanQuery.data.value?.status }}</span>
      </p>
      <p v-if="scanQuery.data.value?.input.markText">
        {{ isBatch ? "Marks" : "Mark" }}:
        <strong>{{ scanQuery.data.value.input.markText }}</strong>
      </p>

      <div class="progress-summary">
        <div class="progress-bar" aria-label="Scan progress">
          <div class="progress-bar-fill" :style="{ width: `${percentComplete}%` }" />
        </div>
        <p class="muted">
          {{ percentComplete }}% complete · {{ etaText }}
          <span v-if="isBatch">
            · mark {{ (progressQuery.data.value?.currentMarkIndex ?? 0) + 1 }}/{{ markTotal }}
          </span>
        </p>
        <p v-if="progressQuery.data.value?.message" class="progress-message">
          {{ progressQuery.data.value.message }}
        </p>
      </div>

      <div v-if="isBatch" class="mark-progress">
        <h2>Per name</h2>
        <ul class="mark-list">
          <li
            v-for="(mark, index) in progressQuery.data.value?.marks ?? []"
            :key="`${mark.markText}-${index}`"
            class="mark-item"
          >
            <span class="mark-name">{{ mark.markText }}</span>
            <span class="badge">{{ mark.status }}</span>
            <span v-if="mark.status === 'completed'" class="muted">
              {{ mark.resultCount }} results
            </span>
            <span v-else-if="mark.error" class="error">{{ mark.error }}</span>
          </li>
        </ul>
      </div>

      <h2 v-if="isBatch" class="stage-heading">Current pipeline</h2>
      <ul class="stage-list">
        <li
          v-for="stage in progressQuery.data.value?.stages ?? []"
          :key="stage.id"
          class="stage-item"
        >
          <div class="stage-header">
            <span>{{ stage.label }}</span>
            <span class="badge">{{ stage.status }}</span>
          </div>
          <p v-if="stage.message" class="muted stage-message">{{ stage.message }}</p>
          <p v-if="formatCounts(stage.counts)" class="muted stage-counts">
            {{ formatCounts(stage.counts) }}
          </p>
        </li>
      </ul>

      <p v-if="scanQuery.data.value?.status === 'completed'" style="margin-top: 1rem">
        <RouterLink class="button" :to="{ name: 'scan-results', params: { id: scanId } }">
          View results
        </RouterLink>
      </p>
    </div>
  </section>
</template>

<style scoped>
.progress-summary {
  margin: 1rem 0;
}

.progress-bar {
  height: 0.75rem;
  background: rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #334155, #0f172a);
  transition: width 0.4s ease;
}

.progress-message {
  margin: 0.35rem 0 0;
  color: #334155;
}

.stage-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.stage-message,
.stage-counts {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
}

.stage-heading {
  margin-top: 1.25rem;
  font-size: 1rem;
}

.mark-progress {
  margin: 1rem 0;
}

.mark-list {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
}

.mark-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e2e8f0;
}

.mark-name {
  font-weight: 600;
  min-width: 8rem;
}
</style>
