<script setup>
import { RouterLink, RouterView } from "vue-router";

const otlpEndpoint =
  import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT || "local Kopai";
</script>

<template>
  <div class="app-shell">
    <header class="topnav">
      <div class="topnav-inner">
        <div class="brand">
          <span class="brand-mark">P</span>
          <span class="brand-name">Promptyard</span>
        </div>
        <nav class="nav-links">
          <RouterLink to="/" exact-active-class="active">Dashboard</RouterLink>
          <RouterLink to="/workspaces" active-class="active"
            >Workspaces</RouterLink
          >
        </nav>
        <div class="otlp-hint">OTLP &rarr; {{ otlpEndpoint }}</div>
      </div>
    </header>
    <main class="page">
      <RouterView />
    </main>
  </div>
</template>
