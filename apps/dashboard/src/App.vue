<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <strong>Trademark Engine</strong>
      <nav>
        <RouterLink to="/">Database</RouterLink>
        <RouterLink to="/scan/new">New scan</RouterLink>
      </nav>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>
