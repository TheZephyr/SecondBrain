<template>
  <div class="h-screen w-full">
    <div class="flex h-full overflow-hidden">
      <AppNavigation />
      <AppContent />
    </div>
    <Toast position="bottom-right" />
  </div>
</template>

<script setup lang="ts">
import { watch } from "vue";
import Toast from "primevue/toast";
import { useToast } from "primevue/usetoast";
import AppNavigation from "./components/layout/AppNavigation.vue";
import AppContent from "./components/layout/AppContent.vue";
import { useNotificationsStore } from "./stores/notifications";

const toast = useToast();
const notifications = useNotificationsStore();

watch(
  () => notifications.queue.length,
  () => {
    let next = notifications.shift();
    while (next) {
      toast.add(next);
      next = notifications.shift();
    }
  },
);
</script>
