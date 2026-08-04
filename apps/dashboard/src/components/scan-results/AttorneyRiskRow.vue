<script setup lang="ts">
import { computed, ref } from "vue";
import type { AttorneyRiskItem } from "../../api/client";
import {
  formatDimensionLabel,
  formatDimensionScore,
  formatNiceClasses,
  formatRiskLevel,
} from "./formatters";

const props = defineProps<{
  risk: AttorneyRiskItem;
  niceClasses: number[];
}>();

const open = ref(props.risk.rank === 1);

const dimensionEntries = computed(() =>
  (
    [
      "visueel",
      "auditief",
      "conceptueel",
      "warenDiensten",
    ] as const
  ).map((key) => ({
    key,
    label: formatDimensionLabel(key),
    score: props.risk.dimensions[key].score,
    toelichting: props.risk.dimensions[key].toelichting,
  })),
);

function toggle() {
  open.value = !open.value;
}
</script>

<template>
  <article class="risk" :class="{ 'risk--open': open }" :data-level="risk.riskLevel">
    <button type="button" class="risk-summary" :aria-expanded="open" @click="toggle">
      <span class="rank">{{ risk.rank }}</span>
      <span class="risk-main">
        <span class="mark-row">
          <strong class="risk-mark">{{ risk.markText }}</strong>
          <span class="pill" :data-level="risk.riskLevel">
            {{ formatRiskLevel(risk.riskLevel) }}
          </span>
        </span>
        <span class="summary">{{ risk.summary }}</span>
        <span class="nice">Nice {{ formatNiceClasses(niceClasses) }}</span>
      </span>
      <span class="chevron" aria-hidden="true">{{ open ? "−" : "+" }}</span>
    </button>

    <div v-if="open" class="risk-detail">
      <p class="confusion">{{ risk.confusionRisk }}</p>
      <ul class="dims">
        <li v-for="dim in dimensionEntries" :key="dim.key">
          <div class="dim-head">
            <span>{{ dim.label }}</span>
            <span class="dim-score">{{ formatDimensionScore(dim.score) }}</span>
          </div>
          <p>{{ dim.toelichting }}</p>
        </li>
      </ul>
      <p class="why">{{ risk.whySelected }}</p>
    </div>
  </article>
</template>

<style scoped>
.risk {
  border: 1px solid #e2e8f0;
  border-radius: 0.85rem;
  background: #fff;
  overflow: hidden;
}

.risk + .risk {
  margin-top: 0.75rem;
}

.risk-summary {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.9rem;
  align-items: start;
  padding: 1rem 1.1rem;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: inherit;
  font: inherit;
}

.rank {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #0f172a;
  color: #f8fafc;
  font-size: 0.8rem;
  font-weight: 650;
  margin-top: 0.1rem;
}

.risk-main {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.mark-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.risk-mark {
  font-size: 1.05rem;
  letter-spacing: -0.02em;
  color: #0f172a;
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: #f1f5f9;
  color: #475569;
}

.pill[data-level="hoog"] {
  background: #fee2e2;
  color: #991b1b;
}

.pill[data-level="middel"] {
  background: #ffedd5;
  color: #9a3412;
}

.pill[data-level="laag"] {
  background: #dcfce7;
  color: #166534;
}

.summary {
  color: #334155;
  line-height: 1.45;
}

.nice {
  font-size: 0.8rem;
  color: #94a3b8;
}

.chevron {
  color: #94a3b8;
  font-size: 1.2rem;
  line-height: 1;
  margin-top: 0.15rem;
}

.risk-detail {
  padding: 0 1.1rem 1.15rem 3.65rem;
  border-top: 1px solid #f1f5f9;
}

.confusion {
  margin: 0.9rem 0 0.85rem;
  color: #475569;
  line-height: 1.5;
}

.dims {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.65rem;
}

.dims li {
  padding: 0.65rem 0.75rem;
  border-radius: 0.55rem;
  background: #f8fafc;
}

.dim-head {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
  font-size: 0.8rem;
  font-weight: 650;
  color: #0f172a;
  letter-spacing: 0.02em;
}

.dim-score {
  color: #64748b;
  font-weight: 600;
}

.dims p {
  margin: 0;
  font-size: 0.9rem;
  color: #475569;
  line-height: 1.45;
}

.why {
  margin: 0.85rem 0 0;
  font-size: 0.85rem;
  color: #94a3b8;
}

@media (max-width: 640px) {
  .risk-detail {
    padding-left: 1.1rem;
  }
}
</style>
