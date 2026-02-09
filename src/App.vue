<template>
  <div class="h-screen w-full">
    <div class="flex h-full overflow-hidden">
      <AppNavigation />
      <AppContent />
    </div>
  </div>
</template>

<script setup lang="ts">
import AppNavigation from "./components/layout/AppNavigation.vue";
import AppContent from "./components/layout/AppContent.vue";
</script>
