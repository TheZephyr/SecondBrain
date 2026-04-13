import { reactive, readonly } from "vue";

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmState = {
  open: boolean;
  options: ConfirmOptions;
};

const defaultOptions: ConfirmOptions = {
  title: "",
  description: "",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  destructive: false,
};

const state = reactive<ConfirmState>({
  open: false,
  options: defaultOptions,
});

let resolver: ((value: boolean) => void) | null = null;

function closeWith(value: boolean) {
  state.open = false;
  const nextResolver = resolver;
  resolver = null;
  nextResolver?.(value);
}

export function requestConfirm(options: ConfirmOptions): Promise<boolean> {
  if (resolver) {
    closeWith(false);
  }

  state.options = {
    ...defaultOptions,
    ...options,
  };
  state.open = true;

  return new Promise<boolean>((resolve) => {
    resolver = resolve;
  });
}

export function useAppConfirmState() {
  return {
    state: readonly(state),
    confirm: () => closeWith(true),
    cancel: () => closeWith(false),
    setOpen(nextOpen: boolean) {
      state.open = nextOpen;
      if (!nextOpen && resolver) {
        closeWith(false);
      }
    },
  };
}

export function useAppConfirm() {
  return {
    confirm: requestConfirm,
  };
}
