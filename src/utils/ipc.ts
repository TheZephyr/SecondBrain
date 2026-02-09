import type { IpcResult } from "../types/ipc";
import { useNotificationsStore } from "../stores/notifications";

export function handleIpc<T>(
  result: IpcResult<T>,
  context: string,
  fallback: T,
): T {
  if (result.ok) {
    return result.data;
  }

  const notifications = useNotificationsStore();
  const detail = result.error.context
    ? `${result.error.message} (${result.error.context})`
    : result.error.message;

  console.error(`[IPC:${context}]`, result.error);
  notifications.push({
    severity: "error",
    summary: "Operation failed",
    detail,
    life: 5000,
  });

  return fallback;
}
