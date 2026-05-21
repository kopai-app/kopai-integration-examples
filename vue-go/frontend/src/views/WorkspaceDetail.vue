<script setup>
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { SpanStatusCode } from "@opentelemetry/api";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { api } from "../api.js";
import { tracer, logger } from "../instrumentation.js";
import ChatRunner from "../components/ChatRunner.vue";
import ActivityFeed from "../components/ActivityFeed.vue";

const route = useRoute();
const workspaceId = route.params.id;

const workspace = ref(null);
const templates = ref([]);
const recentCalls = ref([]);
const selectedTemplate = ref(null);
const error = ref(null);
const loading = ref(true);

onMounted(async () => {
  await tracer.startActiveSpan("workspace.load", async (span) => {
    span.setAttribute("workspace.id", String(workspaceId));
    try {
      const data = await api.get(`/api/workspaces/${workspaceId}`);
      workspace.value = data;
      templates.value = data.templates || [];
      recentCalls.value = data.recent_calls || data.recent || [];
      span.setAttributes({
        "templates.count": templates.value.length,
        "recent_calls.count": recentCalls.value.length,
      });
    } catch (e) {
      error.value = e.message;
      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        body: "workspace load failed",
        attributes: {
          "workspace.id": String(workspaceId),
          "error.message": e.message,
        },
      });
      span.setAttributes({
        "exception.slug": "err-workspace-load",
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

function selectTemplate(t) {
  selectedTemplate.value = t;
}
</script>

<template>
  <div>
    <div v-if="error" class="error">{{ error }}</div>
    <div v-else-if="loading" class="subtle">Loading...</div>
    <div v-else-if="workspace">
      <h1>{{ workspace.name }}</h1>
      <div class="subtle">
        {{ workspace.description || "No description" }}
      </div>

      <div class="section detail-grid">
        <div>
          <h2>Templates</h2>
          <div class="template-list">
            <button
              v-for="t in templates"
              :key="t.id"
              class="template-item"
              :class="{ selected: selectedTemplate?.id === t.id }"
              @click="selectTemplate(t)"
            >
              <div class="t-name">{{ t.name }}</div>
              <div class="t-body">{{ t.body || t.prompt }}</div>
            </button>
            <div v-if="templates.length === 0" class="empty">
              No templates in this workspace.
            </div>
          </div>
        </div>

        <div>
          <ChatRunner
            :workspace-id="workspaceId"
            :templates="templates"
            :selected-template="selectedTemplate"
          />

          <div class="section">
            <h2>Recent calls</h2>
            <ActivityFeed :items="recentCalls" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
