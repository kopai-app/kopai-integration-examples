<script setup>
defineProps({
  title: { type: String, required: true },
  value: { type: [String, Number], required: true },
  sub: { type: String, default: "" },
});
</script>

<template>
  <div class="card usage-card">
    <div class="label">{{ title }}</div>
    <div class="value">{{ value }}</div>
    <div v-if="sub" class="sub">{{ sub }}</div>
  </div>
</template>
