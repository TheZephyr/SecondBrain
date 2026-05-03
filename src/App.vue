<template>
  <TooltipProvider>
    <div class="h-screen w-full bg-background text-foreground">
      <div class="flex h-full overflow-hidden">
        <AppSidebar />
        <AppContent />
      </div>
      <AppToaster />
      <AppConfirmDialog />
    </div>
  </TooltipProvider>
</template>

<script setup lang="ts">
import AppContent from "./components/layout/content/AppContent.vue";
import AppSidebar from "./components/layout/sidebar/AppSidebar.vue";
import AppConfirmDialog from "./components/app/ui/AppConfirmDialog.vue";
import AppToaster from "./components/app/ui/AppToaster.vue";
import { TooltipProvider } from "@/components/ui/tooltip";
</script>
