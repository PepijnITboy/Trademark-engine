<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { createScan, parseMarkTexts } from "../api/client";

const router = useRouter();
const markText = ref("ZENZO, SENZO, XENZO");
const niceClassesInput = ref("32,33");
const submitting = ref(false);
const error = ref<string | null>(null);

const parsedMarks = computed(() => parseMarkTexts(markText.value));
const overflowHint = computed(() => {
  const rawCount = markText.value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean).length;
  return rawCount > 10 ? `Only the first 10 unique names will be scanned (${rawCount} entered).` : null;
});

function parseNiceClasses(value: string): number[] | undefined {
  const parsed = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number.parseInt(part, 10))
    .filter((num) => Number.isFinite(num));

  return parsed.length > 0 ? parsed : undefined;
}

async function submitScan() {
  submitting.value = true;
  error.value = null;

  try {
    const markTexts = parseMarkTexts(markText.value);
    if (markTexts.length === 0) {
      throw new Error("Enter at least one mark name");
    }

    const selectedNiceClasses = parseNiceClasses(niceClassesInput.value);
    const payload: {
      markTexts: string[];
      selectedNiceClasses?: number[];
    } = { markTexts };
    if (selectedNiceClasses !== undefined) {
      payload.selectedNiceClasses = selectedNiceClasses;
    }

    const scan = await createScan(payload);
    await router.push({ name: "scan-progress", params: { id: scan.id } });
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : "Failed to create scan";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section>
    <h1>New trademark scan</h1>
    <p class="muted">
      Submit one proposed mark, or up to 10 names separated by commas. Each name gets its own
      conflict list from the same database.
    </p>

    <form class="card" @submit.prevent="submitScan">
      <div class="form-field">
        <label for="markText">Mark text (comma-separated, max 10)</label>
        <textarea
          id="markText"
          v-model="markText"
          rows="3"
          required
          placeholder="ZENZO, SENZO, XENZO"
        />
        <p class="muted mark-count">
          {{ parsedMarks.length }} name{{ parsedMarks.length === 1 ? "" : "s" }} ready
          <span v-if="parsedMarks.length > 1"> · sequential scan, typically under ~20s</span>
        </p>
        <p v-if="overflowHint" class="muted">{{ overflowHint }}</p>
      </div>

      <div class="form-field">
        <label for="niceClasses">Nice classes (comma-separated, shared across all names)</label>
        <input id="niceClasses" v-model="niceClassesInput" placeholder="32,33" />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit" :disabled="submitting || parsedMarks.length === 0">
        {{
          submitting
            ? "Creating…"
            : parsedMarks.length > 1
              ? `Start ${parsedMarks.length} scans`
              : "Start scan"
        }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.mark-count {
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
}

textarea {
  resize: vertical;
  min-height: 4.5rem;
}
</style>
