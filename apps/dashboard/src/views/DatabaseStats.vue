<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { fetchDatabaseStats } from "../api/client";

const { data, isLoading, error } = useQuery({
  queryKey: ["database-stats"],
  queryFn: fetchDatabaseStats,
});
</script>

<template>
  <section>
    <h1>Database overview</h1>
    <p class="muted">Engine corpus stats (searchable + normalized). Source table is read-only.</p>

    <div v-if="isLoading" class="card">Loading stats…</div>
    <div v-else-if="error" class="card error">{{ (error as Error).message }}</div>
    <div v-else-if="data" class="card">
      <p>
        Mode: <span class="badge">{{ data.mode }}</span>
        Ready:
        <span class="badge" :class="{ ready: data.ready, notReady: !data.ready }">
          {{ data.ready ? "yes" : "no — bridge + preprocess required" }}
        </span>
      </p>
      <div class="stats-grid">
        <div class="stat">
          <div class="stat-label">Trademarks</div>
          <div class="stat-value">{{ data.trademarkCount }}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Corpus sources</div>
          <div class="stat-value">{{ data.corpusSourceCount }}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Searchable</div>
          <div class="stat-value">{{ data.searchableCount }}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Normalized</div>
          <div class="stat-value">{{ data.normalizedCount }}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Snapshots</div>
          <div class="stat-value">{{ data.snapshotCount }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.badge.ready {
  background: color-mix(in srgb, var(--accent, #2a6) 20%, transparent);
}
.badge.notReady {
  background: color-mix(in srgb, var(--danger, #c44) 20%, transparent);
}
</style>
