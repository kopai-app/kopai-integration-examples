<script setup>
defineProps({
  items: { type: Array, required: true },
});

function formatTs(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString();
}
</script>

<template>
  <div class="card" style="padding: 0; overflow: hidden">
    <table>
      <thead>
        <tr>
          <th>When</th>
          <th>Workspace</th>
          <th>Model</th>
          <th>Tokens in</th>
          <th>Tokens out</th>
          <th>Latency</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!items || items.length === 0">
          <td colspan="6" class="empty" style="text-align: center">
            No recent activity yet.
          </td>
        </tr>
        <tr v-for="(item, idx) in items" :key="item.id || idx">
          <td class="mono">{{ formatTs(item.created_at || item.timestamp) }}</td>
          <td>{{ item.workspace_name || item.workspace_id || "—" }}</td>
          <td class="mono">{{ item.model || "—" }}</td>
          <td class="mono">{{ item.tokens_in ?? "—" }}</td>
          <td class="mono">{{ item.tokens_out ?? "—" }}</td>
          <td class="mono">{{ item.latency_ms != null ? item.latency_ms + " ms" : "—" }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
