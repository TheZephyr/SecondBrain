import { defineStore } from "pinia";
import { ref } from "vue";

export type ToastMessage = {
  severity?: "success" | "info" | "warn" | "error";
  summary: string;
  detail?: string;
  life?: number;
};

export const useNotificationsStore = defineStore("notifications", () => {
  const queue = ref<ToastMessage[]>([]);

  function push(message: ToastMessage) {
    queue.value.push(message);
  }

  function shift() {
    return queue.value.shift();
  }

  return {
    queue,
    push,
    shift,
  };
});
