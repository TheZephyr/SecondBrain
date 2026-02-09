export type IpcErrorCode =
  | "DB_NOT_READY"
  | "DB_QUERY_FAILED"
  | "VALIDATION_FAILED"
  | "FS_READ_FAILED"
  | "FS_WRITE_FAILED"
  | "DATA_CORRUPT"
  | "IPC_FAILED"
  | "UNKNOWN";

export type IpcError = {
  code: IpcErrorCode;
  message: string;
  details?: string;
  context?: string;
};

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError };
