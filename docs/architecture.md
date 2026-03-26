# Codebase Architecture

## Process Separation

- Never run heavy computations or blocking I/O in main process (except initial setup).
- The Renderer _never_ accesses the database directly. Node integration is disabled.

## IPC Payload Safety

- IPC payloads MUST be structured-clone-safe (plain objects, arrays, strings, numbers, booleans, `null`).
- Never pass Vue reactive proxies (`ref`, `reactive`, `computed`, store proxy values) directly to `window.electronAPI`.
- Before IPC calls from Renderer/Pinia, normalize payloads into plain values (e.g., map arrays into new plain objects).
- If you see `An object could not be cloned`, inspect the Renderer callsite payload first.

## Error Recovery & Resilience

- The UI must handle IPC failures by showing error toasts (via the `handleIpc` helper) and disabling affected features. Never crash the Renderer process.
- Do NOT implement automatic retries for mutations. The user must re-trigger failed operations explicitly to prevent IPC flooding.
- If the Database Worker is unready or busy, pending requests should fail fast rather than hanging the UI indefinitely.
