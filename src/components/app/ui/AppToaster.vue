<template>
  <Toaster rich-colors position="bottom-right" />
</template>

<script setup lang="ts">
import { watch } from "vue";
import { toast } from "vue-sonner";
import { Toaster } from "@/components/ui/sonner";
import { useNotificationsStore, type ToastMessage } from "@/stores/notifications";

const notifications = useNotificationsStore();

function pushToast(message: ToastMessage) {
  const options = {
    description: message.detail,
    duration: message.life,
  };

  switch (message.severity) {
    case "success":
      toast.success(message.summary, options);
      return;
    case "warn":
      toast.warning(message.summary, options);
      return;
    case "error":
      toast.error(message.summary, options);
      return;
    case "info":
    default:
      toast.info(message.summary, options);
  }
}

watch(
  () => notifications.queue.length,
  () => {
    let next = notifications.shift();
    while (next) {
      pushToast(next);
      next = notifications.shift();
    }
  },
  { immediate: true },
);
</script>
