<template>
  <Card :class="class">
    <CardHeader v-if="$slots.title || title">
      <CardTitle>
        <slot name="title">
          {{ title }}
        </slot>
      </CardTitle>
    </CardHeader>
    <CardContent v-if="$slots.default || $slots.content">
      <slot name="content">
        <slot />
      </slot>
    </CardContent>
    <CardFooter v-if="$slots.footer">
      <slot name="footer" />
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

defineProps<{
  title?: string;
  class?: HTMLAttributes["class"];
}>();
</script>
