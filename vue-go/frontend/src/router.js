import { createRouter, createWebHistory } from "vue-router";
import { tracer, navCounter } from "./instrumentation.js";

import Dashboard from "./views/Dashboard.vue";
import Workspaces from "./views/Workspaces.vue";
import WorkspaceDetail from "./views/WorkspaceDetail.vue";

const routes = [
  { path: "/", name: "dashboard", component: Dashboard },
  { path: "/workspaces", name: "workspaces", component: Workspaces },
  {
    path: "/workspaces/:id",
    name: "workspace-detail",
    component: WorkspaceDetail,
    props: true,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Open the span in beforeEach and end it in afterEach so the duration covers
// the actual route resolution + component setup, not just a zero-width marker.
let pendingNav = null;
router.beforeEach((to, from, next) => {
  const span = tracer.startSpan("route.change", {
    attributes: {
      "route.from": from.fullPath,
      "route.to": to.fullPath,
    },
  });
  pendingNav = span;
  navCounter.add(1, { route: to.name || to.path });
  next();
});
router.afterEach(() => {
  if (pendingNav) {
    pendingNav.end();
    pendingNav = null;
  }
});
