"use strict";
// ============================================================
// CascadeGuard — Shared Contracts (v1 — FROZEN for parallel build)
// Every module codes strictly against these types.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.SIM = void 0;
// ---------------- Tuning constants (shared truth) ----------------
exports.SIM = {
    /** real ms per engine tick */
    TICK_REAL_MS: 600,
    /** sim ms advanced per step */
    SIM_MS_PER_STEP: 3000,
    /** prediction horizon, sim ms */
    RISK_HORIZON_MS: 120_000,
    /** risk above this counts as an active prediction */
    RISK_THRESHOLD: 0.62,
    /** max log events kept */
    LOG_WINDOW: 500,
    /** metrics samples per service kept */
    HISTORY_WINDOW: 120,
};
