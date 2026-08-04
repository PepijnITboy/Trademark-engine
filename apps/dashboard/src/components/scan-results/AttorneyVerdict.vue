<script setup lang="ts">
import type { AttorneyAnalysisPayload } from "../../api/client";
import { formatAanbeveling } from "./formatters";

defineProps<{
  markText: string;
  analysis: AttorneyAnalysisPayload;
}>();
</script>

<template>
  <header class="verdict">
    <p class="eyebrow">Risico-advies</p>
    <h1 class="mark">{{ markText }}</h1>

    <div v-if="analysis.status === 'completed'" class="verdict-body">
      <p
        v-if="analysis.aanbeveling"
        class="badge-aanbeveling"
        :data-value="analysis.aanbeveling"
      >
        {{ formatAanbeveling(analysis.aanbeveling) }}
      </p>
      <p v-if="analysis.overallAdvice" class="advice">
        {{ analysis.overallAdvice }}
      </p>
      <p class="meta">
        {{ analysis.candidatesConsidered }} kandidaten beoordeeld
        <template v-if="analysis.model"> · {{ analysis.model }}</template>
      </p>
    </div>

    <div v-else-if="analysis.status === 'skipped'" class="state state--muted">
      <p class="state-title">Geen attorney-analyse</p>
      <p class="state-copy">
        Zet <code>ATTORNEY_ANALYSIS_ENABLED=1</code> om de top risico’s te zien.
      </p>
      <p v-if="analysis.error" class="state-detail">{{ analysis.error }}</p>
    </div>

    <div v-else-if="analysis.status === 'failed'" class="state state--error">
      <p class="state-title">Attorney-analyse mislukt</p>
      <p class="state-copy">{{ analysis.error || "Onbekende fout." }}</p>
    </div>
  </header>
</template>

<style scoped>
.verdict {
  text-align: center;
  margin-bottom: 2.5rem;
}

.eyebrow {
  margin: 0 0 0.65rem;
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #94a3b8;
  font-weight: 500;
}

.mark {
  margin: 0 0 1.25rem;
  font-family: var(--font-display);
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  color: #0f172a;
  line-height: 1.1;
  word-break: break-word;
}

.verdict-body {
  max-width: 36rem;
  margin: 0 auto;
}

.badge-aanbeveling {
  display: inline-block;
  margin: 0 0 1rem;
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  background: #0f172a;
  color: #f8fafc;
}

.badge-aanbeveling[data-value="laag_risico"] {
  background: #14532d;
}

.badge-aanbeveling[data-value="nader_onderzoek"] {
  background: #92400e;
}

.badge-aanbeveling[data-value="indienen_met_aanpassing"] {
  background: #9a3412;
}

.badge-aanbeveling[data-value="indienen_risicovol"] {
  background: #7f1d1d;
}

.advice {
  margin: 0 0 0.85rem;
  font-size: 1.05rem;
  line-height: 1.55;
  color: #334155;
}

.meta {
  margin: 0;
  font-size: 0.85rem;
  color: #94a3b8;
}

.state {
  max-width: 28rem;
  margin: 0 auto;
  padding: 1.25rem 1.5rem;
  border-radius: 0.75rem;
  background: #fff;
  border: 1px solid #e2e8f0;
}

.state--error {
  border-color: #fecaca;
  background: #fff7f7;
}

.state-title {
  margin: 0 0 0.35rem;
  font-weight: 650;
  color: #0f172a;
}

.state-copy,
.state-detail {
  margin: 0;
  color: #64748b;
  font-size: 0.95rem;
}

.state-detail {
  margin-top: 0.5rem;
  font-size: 0.85rem;
}

.state code {
  font-size: 0.85em;
  background: #f1f5f9;
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
}
</style>
