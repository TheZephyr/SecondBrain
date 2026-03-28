import { ZodType } from "zod";
import { AppError } from "../db/worker-manager";
import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import type { IpcResult, IpcError } from "../../src/types/ipc";

export function parseOrThrow<T>(
  schema: ZodType<T>,
  data: unknown,
  context: string,
): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Invalid input.",
      JSON.stringify({ context, issues: parsed.error.issues }),
    );
  }
  return parsed.data;
}

export function handleIpc<T, A extends unknown[]>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: A) => T | Promise<T>,
) {
  ipcMain.handle(channel, async (event, ...args: A) => {
    try {
      const data = await handler(event, ...args);
      return { ok: true, data } satisfies IpcResult<T>;
    } catch (error) {
      const ipcError: IpcError =
        error instanceof AppError
          ? { code: error.code, message: error.message, details: error.details }
          : { code: "UNKNOWN", message: "Unknown error." };
      console.error(`[IPC:${channel}]`, error);
      return { ok: false, error: ipcError } satisfies IpcResult<T>;
    }
  });
}
