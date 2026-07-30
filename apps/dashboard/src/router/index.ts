import { createRouter, createWebHistory } from "vue-router";
import DatabaseStats from "../views/DatabaseStats.vue";
import NewScan from "../views/NewScan.vue";
import ScanProgress from "../views/ScanProgress.vue";
import ScanResults from "../views/ScanResults.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: DatabaseStats },
    { path: "/scan/new", name: "new-scan", component: NewScan },
    { path: "/scan/:id/progress", name: "scan-progress", component: ScanProgress },
    { path: "/scan/:id/results", name: "scan-results", component: ScanResults },
  ],
});

export default router;
