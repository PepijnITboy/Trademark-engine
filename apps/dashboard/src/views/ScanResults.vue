<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  fetchScanResults,
  type AttorneyAnalysisPayload,
  type ScanMarkResults,
} from "../api/client";
import AttorneyVerdict from "../components/scan-results/AttorneyVerdict.vue";
import AttorneyRiskList from "../components/scan-results/AttorneyRiskList.vue";
import { buildAttorneyCopyText } from "../components/scan-results/copy";

const route = useRoute();
const scanId = computed(() => String(route.params.id));
const copyState = ref<"idle" | "copied" | "failed">("idle");

const { data, isLoading, error } = useQuery({
  queryKey: computed(() => ["scan-results", scanId.value]),
  queryFn: () => fetchScanResults(scanId.value),
});

const markSections = computed((): ScanMarkResults[] => {
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
      ...(payload.attorneyAnalysis
        ? { attorneyAnalysis: payload.attorneyAnalysis }
        : {}),
    },
  ];
});

const isBatch = computed(() => (data.value?.marks?.length ?? 0) > 1);

function attorneyFor(section: ScanMarkResults): AttorneyAnalysisPayload | undefined {
  return section.attorneyAnalysis ?? data.value?.attorneyAnalysis;
}

function niceByCandidateId(section: ScanMarkResults): Record<string, number[]> {
  const map: Record<string, number[]> = {};
  for (const item of section.results) {
    map[item.candidateId] = item.niceClasses;
  }
  return map;
}

function placeholderAttorney(): AttorneyAnalysisPayload {
  return {
    status: "skipped",
    candidatesConsidered: 0,
    topRisks: [],
    error: "Geen attorney-analyse in deze scan.",
  };
}

const hasCopyableAttorney = computed(() =>
  markSections.value.some((section) => {
    const analysis = attorneyFor(section);
    return analysis?.status === "completed" && analysis.topRisks.length > 0;
  }),
);

function buildCopyText(): string {
  return buildAttorneyCopyText({
    scanId: scanId.value,
    sections: markSections.value.map((section) => ({
      markText: section.markText,
      attorney: attorneyFor(section),
      niceByCandidateId: niceByCandidateId(section),
    })),
  });
}

async function copyAllResults() {
  const text = buildCopyText();
  try {
    await navigator.clipboard.writeText(text);
    copyState.value = "copied";
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    copyState.value = ok ? "copied" : "failed";
  }

  window.setTimeout(() => {
    copyState.value = "idle";
  }, 2000);
}
</script>

<template>
  <section class="results-page">
    <div class="toolbar">
      <p class="scan-id">Scan {{ scanId }}</p>
      <button
        v-if="data && hasCopyableAttorney"
        type="button"
        class="copy-all"
        @click="copyAllResults"
      >
        {{
          copyState === "copied"
            ? "Gekopieerd"
            : copyState === "failed"
              ? "Kopiëren mislukt"
              : "Kopieer advies"
        }}
      </button>
    </div>

    <div v-if="isLoading" class="boot">Resultaten laden…</div>
    <div v-else-if="error" class="boot boot--error">{{ (error as Error).message }}</div>

    <template v-else-if="data">
      <p v-if="isBatch" class="batch-meta">
        {{ data.marks.length }} merknamen
      </p>

      <div
        v-for="(section, index) in markSections"
        :key="`${section.markText}-${index}`"
        class="mark-block"
      >
        <p v-if="section.error" class="boot boot--error">{{ section.error }}</p>

        <AttorneyVerdict
          :mark-text="section.markText"
          :analysis="attorneyFor(section) ?? placeholderAttorney()"
        />

        <AttorneyRiskList
          v-if="attorneyFor(section)?.status === 'completed'"
          :risks="attorneyFor(section)!.topRisks"
          :nice-by-candidate-id="niceByCandidateId(section)"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.results-page {
  min-height: calc(100vh - 4rem);
  padding: 2rem 1.5rem 3.5rem;
  background:
    radial-gradient(circle at top, rgba(15, 23, 42, 0.04), transparent 42%),
    #f8fafc;
}

.toolbar {
  max-width: 44rem;
  margin: 0 auto 1.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.scan-id,
.batch-meta {
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #94a3b8;
  font-weight: 500;
}

.batch-meta {
  max-width: 44rem;
  margin: 0 auto 1.25rem;
  text-align: center;
}

.copy-all {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #0f172a;
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.copy-all:hover {
  border-color: #94a3b8;
}

.boot {
  max-width: 28rem;
  margin: 4rem auto;
  text-align: center;
  color: #64748b;
}

.boot--error {
  color: #b91c1c;
}

.mark-block + .mark-block {
  margin-top: 3.5rem;
  padding-top: 2.5rem;
  border-top: 1px solid #e2e8f0;
}
</style>
