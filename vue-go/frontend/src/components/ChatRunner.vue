<script setup>
import { ref, watch, onMounted } from "vue";
import { SpanStatusCode } from "@opentelemetry/api";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { api } from "../api.js";
import {
  tracer,
  logger,
  chatRunAttempts,
  chatRunErrors,
  chatRunDuration,
} from "../instrumentation.js";

const props = defineProps({
  workspaceId: { type: [String, Number], required: true },
  templates: { type: Array, default: () => [] },
  selectedTemplate: { type: Object, default: null },
});

const models = ref([]);
const modelsLoaded = ref(false);
const modelsError = ref(null);

const selectedTemplateId = ref(null);
const selectedModel = ref("");
const prompt = ref("");
const temperature = ref(0.7);

const response = ref(null);
const error = ref(null);
const loading = ref(false);

onMounted(async () => {
  try {
    const data = await api.get("/api/models");
    const list = Array.isArray(data) ? data : data?.models || [];
    models.value = list;
    modelsLoaded.value = true;
    if (list.length > 0) {
      selectedModel.value = list[0].id || list[0].name || list[0];
    }
  } catch (e) {
    modelsError.value = e.message || "Failed to load models";
    logger.emit({
      severityNumber: SeverityNumber.WARN,
      body: "failed to load models",
      attributes: { "error.message": modelsError.value },
    });
  }
});

watch(
  () => props.selectedTemplate,
  (tpl) => {
    if (tpl) {
      selectedTemplateId.value = tpl.id;
      prompt.value = tpl.body || tpl.prompt || "";
    }
  },
  { immediate: true },
);

function modelLabel(m) {
  if (typeof m === "string") return m;
  return m.name || m.id || "unknown";
}

function modelValue(m) {
  if (typeof m === "string") return m;
  return m.id || m.name;
}

async function runChat() {
  error.value = null;
  response.value = null;

  if (!selectedModel.value) {
    error.value = { message: "Pick a model first." };
    return;
  }
  if (!prompt.value.trim()) {
    error.value = { message: "Prompt cannot be empty." };
    return;
  }

  await tracer.startActiveSpan("chat.run.ui", async (span) => {
    span.setAttributes({
      "workspace.id": String(props.workspaceId),
      "gen_ai.system": "openrouter",
      "gen_ai.request.model": selectedModel.value,
      "gen_ai.prompt.length": prompt.value.length,
    });
    if (selectedTemplateId.value != null) {
      span.setAttribute("template.id", String(selectedTemplateId.value));
    }

    chatRunAttempts.add(1, {
      "gen_ai.request.model": selectedModel.value,
      "workspace.id": String(props.workspaceId),
    });

    const startedAt = performance.now();
    loading.value = true;
    try {
      const body = {
        workspace_id: Number(props.workspaceId),
        template_id: selectedTemplateId.value ? Number(selectedTemplateId.value) : null,
        model: selectedModel.value,
        prompt: prompt.value,
        temperature: Number(temperature.value),
      };
      const data = await api.post("/api/chat/run", body);

      const durationMs = Math.round(performance.now() - startedAt);
      response.value = {
        response: data.response ?? data.output ?? data.text ?? "",
        tokens_in: data.tokens_in ?? data.usage?.prompt_tokens ?? null,
        tokens_out: data.tokens_out ?? data.usage?.completion_tokens ?? null,
        latency_ms: data.latency_ms ?? durationMs,
        model: data.model ?? selectedModel.value,
      };
      span.setAttributes({
        "gen_ai.usage.input_tokens": response.value.tokens_in ?? -1,
        "gen_ai.usage.output_tokens": response.value.tokens_out ?? -1,
        "chat_run.duration_ms": response.value.latency_ms ?? -1,
      });
      chatRunDuration.record(durationMs, {
        "gen_ai.request.model": selectedModel.value,
        "workspace.id": String(props.workspaceId),
      });
      logger.emit({
        severityNumber: SeverityNumber.INFO,
        body: "chat run success",
        attributes: {
          "workspace.id": String(props.workspaceId),
          "gen_ai.request.model": selectedModel.value,
          "chat_run.duration_ms": durationMs,
        },
      });
    } catch (e) {
      error.value = { message: e.message, status: e.status };
      const errorKind = e.status ? `http_${e.status}` : "network";
      chatRunErrors.add(1, {
        "gen_ai.request.model": selectedModel.value,
        "workspace.id": String(props.workspaceId),
        "error.kind": errorKind,
      });
      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        body: "chat run failure",
        attributes: {
          "workspace.id": String(props.workspaceId),
          "gen_ai.request.model": selectedModel.value,
          "error.kind": errorKind,
          "error.message": e.message,
        },
      });
      span.setAttributes({
        "exception.slug": "err-chat-run-ui",
        error: true,
      });
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
    } finally {
      loading.value = false;
      span.end();
    }
  });
}
</script>

<template>
  <div class="card">
    <h2>Run a prompt</h2>

    <div v-if="modelsLoaded && models.length === 0" class="warning">
      No models available &mdash; set <code>OPENROUTER_API_KEY</code> on the
      backend.
    </div>
    <div v-else-if="modelsError" class="warning">
      Could not load models: {{ modelsError }}
    </div>

    <div class="row">
      <div class="form-row">
        <label for="model">Model</label>
        <select id="model" v-model="selectedModel" :disabled="models.length === 0">
          <option v-for="m in models" :key="modelValue(m)" :value="modelValue(m)">
            {{ modelLabel(m) }}
          </option>
        </select>
        <div class="model-hint" v-if="modelsLoaded">
          loaded {{ models.length }} models
        </div>
      </div>
      <div class="form-row">
        <label for="temp">Temperature</label>
        <input
          id="temp"
          type="number"
          min="0"
          max="2"
          step="0.1"
          v-model.number="temperature"
        />
      </div>
    </div>

    <div class="form-row">
      <label for="prompt">Prompt</label>
      <textarea
        id="prompt"
        v-model="prompt"
        placeholder="Write your prompt..."
      ></textarea>
    </div>

    <button class="btn" @click="runChat" :disabled="loading">
      {{ loading ? "Running..." : "Run" }}
    </button>

    <div v-if="response" class="section">
      <div class="response-meta">
        <span>model: {{ response.model }}</span>
        <span v-if="response.tokens_in != null">in: {{ response.tokens_in }}</span>
        <span v-if="response.tokens_out != null">out: {{ response.tokens_out }}</span>
        <span v-if="response.latency_ms != null">{{ response.latency_ms }} ms</span>
      </div>
      <pre class="response-pre">{{ response.response }}</pre>
    </div>

    <div v-if="error" class="error">
      <strong v-if="error.status">{{ error.status }}:</strong>
      {{ error.message }}
    </div>
  </div>
</template>
