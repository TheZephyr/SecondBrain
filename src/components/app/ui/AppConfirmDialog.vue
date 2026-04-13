<template>
  <AlertDialog :open="state.open" @update:open="setOpen">
    <AlertDialogContent class="sm:max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ state.options.title }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ state.options.description }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="cancel">
          {{ state.options.cancelLabel }}
        </AlertDialogCancel>
        <AlertDialogAction
          :class="state.options.destructive ? 'bg-destructive text-white hover:bg-destructive/90' : undefined"
          @click="confirm"
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
</script>
