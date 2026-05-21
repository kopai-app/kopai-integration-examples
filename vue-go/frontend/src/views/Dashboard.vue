<script setup>
import { ref, onMounted } from "vue";
import { SpanStatusCode } from "@opentelemetry/api";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { api } from "../api.js";
import { tracer, logger } from "../instrumentation.js";
import UsageCard from "../components/UsageCard.vue";
import ActivityFeed from "../components/ActivityFeed.vue";

const summary = ref(null);
const activity = ref([]);
const error = ref(null);
const loading = ref(true);

onMounted(async () => {
  await tracer.startActiveSpan("dashboard.load", async (span) => {
    try {
      const [s, a] = await Promise.all([
        api.get("/api/usage/summary"),
        api.get("/api/activity"),
      ]);
      summary.value = s;
      activity.value = Array.isArray(a) ? a : a?.items || [];
      span.setAttributes({
        "activity.count": activity.value.length,
        "summary.total_calls": s?.total_calls ?? -1,
      });
    } catch (e) {
      error.value = e.message;
      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        body: "dashboard load failed",
        attributes: { "error.message": e.message },
      });
      span.setAttribute("exception.slug", "err-dashboard-load");
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
    <h1>Dashboard</h1>
    <div class="subtle">Aggregate usage across all workspaces.</div>

    <div v-if="error" class="error">{{ error }}</div>

    <div class="section">
      <div class="grid-cards">
        <UsageCard
          title="Total chats"
          :value="summary?.total_calls ?? '—'"
          sub="all-time"
        />
        <UsageCard
          title="Tokens in"
          :value="summary?.total_tokens_in ?? '—'"
          sub="prompt tokens"
        />
        <UsageCard
          title="Tokens out"
          :value="summary?.total_tokens_out ?? '—'"
          sub="completion tokens"
        />
      </div>
    </div>

    <div class="section" v-if="summary?.by_model?.length">
      <h2>By model</h2>
      <div class="card" style="padding: 0; overflow: hidden">
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Calls</th>
              <th>Tokens</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in summary.by_model" :key="row.model">
              <td class="mono">{{ row.model }}</td>
              <td class="mono">{{ row.calls }}</td>
              <td class="mono">{{ row.tokens }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <h2>Recent activity</h2>
      <ActivityFeed :items="activity.slice(0, 10)" />
    </div>
  </div>
</template>
