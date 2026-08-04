<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";

const route = useRoute();
const isCinemaRoute = computed(
  () => route.name === "scan-progress" || route.name === "scan-results",
);
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--cinema': isCinemaRoute }">
    <header class="app-header">
      <strong>Trademark Engine</strong>
      <nav>
        <RouterLink to="/">Database</RouterLink>
        <RouterLink to="/scan/new">New scan</RouterLink>
      </nav>
    </header>
    <main class="app-main" :class="{ 'app-main--cinema': isCinemaRoute }">
      <RouterView />
    </main>
  </div>
</template>
