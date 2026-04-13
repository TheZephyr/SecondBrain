<template>
  <AlertDialog :open="state.open" @update:open="onOpenChange">
    <AlertDialogContent class="sm:max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ state.options.title }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ state.options.description }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel
          @pointerdown="queueDecision('cancel')"
          @click="onCancelClick"
        >
          {{ state.options.cancelLabel }}
        </AlertDialogCancel>
        <AlertDialogAction
          :class="
            state.options.destructive
              ? 'bg-destructive text-white hover:bg-destructive/90'
              : undefined
          "
          @pointerdown="queueDecision('confirm')"
          @click="onConfirmClick"
        >
          {{ state.options.confirmLabel }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppConfirmState } from "./confirm-service";

const { state, cancel, confirm, setOpen } = useAppConfirmState();

let pendingDecision: "confirm" | "cancel" | null = null;

function queueDecision(decision: "confirm" | "cancel") {
  pendingDecision = decision;
}

function onConfirmClick() {
  pendingDecision = null;
  confirm();
}

function onCancelClick() {
  pendingDecision = null;
  cancel();
}

function onOpenChange(nextOpen: boolean) {
  if (nextOpen) {
    setOpen(true);
    return;
  }

  const decision = pendingDecision;
  pendingDecision = null;

  if (decision === "confirm") {
    confirm();
    return;
  }

  cancel();
}
</script>
