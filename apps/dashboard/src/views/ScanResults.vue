<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { fetchScanResults } from "../api/client";

const route = useRoute();
const scanId = computed(() => String(route.params.id));

const { data, isLoading, error } = useQuery({
  queryKey: computed(() => ["scan-results", scanId.value]),
  queryFn: () => fetchScanResults(scanId.value),
});

const markSections = computed(() => {
  const payload = data.value;
  if (!payload) {
    return [];
  }
  if (payload.marks?.length) {
    return payload.marks;
  }
  return [
    {
      markText: "Proposed mark",
      status: "completed",
      resultCount: payload.resultCount,
      results: payload.results,
    },
  ];
});

const isBatch = computed(() => (data.value?.marks?.length ?? 0) > 1);
</script>

<template>
  <section>
    <h1>Scan results</h1>
    <p class="muted">
      <template v-if="isBatch">
        Conflict lists per proposed name for scan {{ scanId }}.
      </template>
      <template v-else>
        Top conflicts for scan {{ scanId }} (engine database).
      </template>
    </p>

    <div v-if="isLoading" class="card">Loading results…</div>
    <div v-else-if="error" class="card error">{{ (error as Error).message }}</div>
    <template v-else-if="data">
      <p v-if="isBatch" class="muted summary">
        {{ data.marks.length }} names · {{ data.resultCount }} candidates total
      </p>

      <div
        v-for="(section, index) in markSections"
        :key="`${section.markText}-${index}`"
        class="card mark-section"
      >
        <div class="section-header">
          <h2>{{ section.markText }}</h2>
          <span class="badge">{{ section.status }}</span>
        </div>
        <p v-if="section.error" class="error">{{ section.error }}</p>
        <p v-else class="muted">{{ section.resultCount }} candidates</p>

        <table v-if="section.results.length > 0" class="results-table">
          <thead>
            <tr>
              <th>Mark</th>
              <th>Score</th>
              <th>Risk</th>
              <th>Explanation</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in section.results"
              :key="`${section.markText}-${item.candidateId}`"
            >
              <td>{{ item.markText }}</td>
              <td>{{ item.score.experimentalConflictScore.toFixed(1) }}</td>
              <td><span class="badge">{{ item.score.riskBand }}</span></td>
              <td>{{ item.explanations[0] ?? "—" }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else-if="!section.error" class="muted">No candidates kept for this name.</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.summary {
  margin-bottom: 0.75rem;
}

.mark-section + .mark-section {
  margin-top: 1rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.35rem;
}

.section-header h2 {
  margin: 0;
  font-size: 1.15rem;
}
</style>
