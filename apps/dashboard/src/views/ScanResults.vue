<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { fetchScanResults, type ScanMarkResults, type ScanResultItem } from "../api/client";

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
    },
  ];
});

const isBatch = computed(() => (data.value?.marks?.length ?? 0) > 1);
const totalCandidates = computed(() =>
  markSections.value.reduce((sum, section) => sum + section.results.length, 0),
);

function formatResultLine(item: ScanResultItem): string {
  const score = item.score.experimentalConflictScore.toFixed(1);
  const explanation = item.explanations[0] ?? "—";
  const nice =
    item.niceClasses.length > 0 ? ` | Nice ${item.niceClasses.join(",")}` : "";
  return `- ${item.markText} | score ${score} | ${item.score.riskBand} | ${item.score.confidence}${nice} | ${explanation}`;
}

function buildCopyText(): string {
  const lines: string[] = [];
  lines.push(`Trademark scan results (${scanId.value})`);
  lines.push(`Names: ${markSections.value.length} · Candidates: ${totalCandidates.value}`);
  lines.push("");

  for (const section of markSections.value) {
    lines.push(`=== ${section.markText} ===`);
    lines.push(`Status: ${section.status} · ${section.resultCount} candidates`);
    if (section.error) {
      lines.push(`Error: ${section.error}`);
    } else if (section.results.length === 0) {
      lines.push("No candidates kept for this name.");
    } else {
      for (const item of section.results) {
        lines.push(formatResultLine(item));
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

async function copyAllResults() {
  const text = buildCopyText();
  try {
    await navigator.clipboard.writeText(text);
    copyState.value = "copied";
  } catch {
    // Fallback for older/blocked clipboard APIs
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
  <section>
    <div class="title-row">
      <div>
        <h1>Scan results</h1>
        <p class="muted">
          <template v-if="isBatch">
            Conflict lists per proposed name for scan {{ scanId }}.
          </template>
          <template v-else>
            Top conflicts for scan {{ scanId }} (engine database).
          </template>
        </p>
      </div>
      <button
        v-if="data && totalCandidates > 0"
        type="button"
        class="copy-all"
        @click="copyAllResults"
      >
        {{
          copyState === "copied"
            ? "Copied!"
            : copyState === "failed"
              ? "Copy failed"
              : `Copy all results (${totalCandidates})`
        }}
      </button>
    </div>

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
.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.title-row h1 {
  margin-bottom: 0.35rem;
}

.copy-all {
  flex-shrink: 0;
  white-space: nowrap;
}

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
