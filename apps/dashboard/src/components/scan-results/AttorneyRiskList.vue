<script setup lang="ts">
import { computed } from "vue";
import type { AttorneyRiskItem } from "../../api/client";
import { sortRisksByRank } from "./formatters";
import AttorneyRiskRow from "./AttorneyRiskRow.vue";

const props = defineProps<{
  risks: readonly AttorneyRiskItem[];
  niceByCandidateId: Record<string, number[]>;
}>();

const sorted = computed(() => sortRisksByRank(props.risks));
</script>

<template>
  <section class="risk-list" aria-label="Top risico’s">
    <div class="list-head">
      <h2>Top risico’s</h2>
      <p>{{ sorted.length }} geselecteerd uit de engine-kandidaten</p>
    </div>

    <p v-if="sorted.length === 0" class="empty">
      Geen materiële risico’s geselecteerd.
    </p>

    <AttorneyRiskRow
      v-for="risk in sorted"
      :key="`${risk.candidateId}-${risk.rank}`"
      :risk="risk"
      :nice-classes="niceByCandidateId[risk.candidateId] ?? []"
    />
  </section>
</template>

<style scoped>
.risk-list {
  max-width: 44rem;
  margin: 0 auto;
}

.list-head {
  margin-bottom: 1rem;
  text-align: left;
}

.list-head h2 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #64748b;
  font-weight: 650;
}

.list-head p {
  margin: 0;
  font-size: 0.9rem;
  color: #94a3b8;
}

.empty {
  margin: 0;
  padding: 1.25rem;
  border-radius: 0.85rem;
  border: 1px dashed #cbd5e1;
  color: #64748b;
  text-align: center;
  background: #fff;
}
</style>
