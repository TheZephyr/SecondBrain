type E2eDialogKind = "save" | "open";

type E2eDialogResults = {
  save?: Array<string | null>;
  open?: Array<string | null>;
};

type E2eDialogResult =
  | {
      handled: true;
      filePath: string | null;
    }
  | {
      handled: false;
      filePath?: never;
    };

let dialogResults: E2eDialogResults | null = null;

export function isE2eMode(): boolean {
  return process.env.SECOND_BRAIN_E2E === "1";
}

export function getE2eUserDataPath(): string | null {
  if (!isE2eMode()) {
    return null;
  }

  const value = process.env.SECOND_BRAIN_E2E_USER_DATA?.trim();
  return value ? value : null;
}

function readDialogResults(): E2eDialogResults {
  if (dialogResults) {
    return dialogResults;
  }

  const raw = process.env.SECOND_BRAIN_E2E_DIALOG_RESULTS;
  if (!raw) {
    dialogResults = {};
    return dialogResults;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      dialogResults = {};
      return dialogResults;
    }

    const source = parsed as Record<string, unknown>;
    dialogResults = {
      save: normalizeDialogQueue(source.save),
      open: normalizeDialogQueue(source.open),
    };
    return dialogResults;
  } catch {
    dialogResults = {};
    return dialogResults;
  }
}

function normalizeDialogQueue(value: unknown): Array<string | null> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.map((entry) => (typeof entry === "string" ? entry : null));
}

export function consumeE2eDialogResult(kind: E2eDialogKind): E2eDialogResult {
  if (!isE2eMode()) {
    return { handled: false };
  }

  const queue = readDialogResults()[kind];
  return {
    handled: true,
    filePath: queue && queue.length > 0 ? (queue.shift() ?? null) : null,
  };
}
