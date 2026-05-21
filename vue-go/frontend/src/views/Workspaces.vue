<script setup>
import { ref, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { SpanStatusCode } from "@opentelemetry/api";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { api } from "../api.js";
import { tracer, logger } from "../instrumentation.js";

const workspaces = ref([]);
const error = ref(null);
const loading = ref(true);

onMounted(async () => {
  await tracer.startActiveSpan("workspaces.load", async (span) => {
    try {
      const data = await api.get("/api/workspaces");
      workspaces.value = Array.isArray(data) ? data : data?.items || [];
      span.setAttributes({ "workspaces.count": workspaces.value.length });
    } catch (e) {
      error.value = e.message;
      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        body: "workspaces load failed",
        attributes: { "error.message": e.message },
      });
      span.setAttributes({
        "exception.slug": "err-workspaces-load",
        error: true,
      });
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
    } finally {
      loading.value = false;
      span.end();
    }
  });
});
</script>

<template>
  <div>
    <h1>Workspaces</h1>
    <div class="subtle">Pick a workspace to run prompts and inspect usage.</div>

    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="loading" class="subtle section">Loading...</div>

    <div class="section workspace-grid" v-if="!loading">
      <RouterLink
        v-for="w in workspaces"
        :key="w.id"
        :to="`/workspaces/${w.id}`"
        class="card workspace-card"
      >
        <div class="name">{{ w.name }}</div>
        <div class="desc">{{ w.description || "No description" }}</div>
        <div class="badges">
          <span class="badge">{{ w.calls ?? 0 }} calls</span>
          <span class="badge muted"
            >{{ (w.tokens_in ?? 0) + (w.tokens_out ?? 0) }}
            tokens</span
          >
        </div>
      </RouterLink>
      <div v-if="workspaces.length === 0" class="subtle empty">
        No workspaces found.
      </div>
    </div>
  </div>
</template>
