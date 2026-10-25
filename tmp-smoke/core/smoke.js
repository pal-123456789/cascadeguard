"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sim_1 = require("./engine/sim");
const predictor_1 = require("./ai/predictor");
const rootcause_1 = require("./ai/rootcause");
const recovery_1 = require("./ai/recovery");
const accuracy_1 = require("./ai/accuracy");
const topology_1 = require("../data/topology");
const scenarios_1 = require("./engine/scenarios");
const SIM_MINUTES = 10;
const TARGET_SIM_MS = SIM_MINUTES * 60_000;
const engine = (0, sim_1.createEngine)(topology_1.SEED_TOPOLOGY, {
    predict: predictor_1.predictRisks,
    rootCause: rootcause_1.analyzeRootCauses,
    recovery: recovery_1.projectStrategies,
    accuracy: accuracy_1.trackAccuracy,
});
const results = [];
const ok = (cond, label) => {
    results.push(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
    return cond;
};
engine.loadScenario(scenarios_1.SCENARIOS[0].id, 42);
engine.setSpeed(20);
let maxRiskSeen = 0;
let predictedBeforeFailure = false;
let firstFailureTs = null;
let firstPredictionTs = null;
let sawRootCauses = false;
let sawRecommended = false;
let sawLogs = false;
let accuracy = null;
const unsub = engine.subscribe((snap) => {
    if (snap.logs.length > 0)
        sawLogs = true;
    for (const r of Object.values(snap.risks)) {
        if (r.risk > maxRiskSeen)
            maxRiskSeen = r.risk;
        if (r.predicted && firstPredictionTs === null)
            firstPredictionTs = snap.simTime;
    }
    for (const s of Object.values(snap.services)) {
        if (s.metrics.failed && firstFailureTs === null)
            firstFailureTs = snap.simTime;
    }
    if (snap.rootCauses.length > 0)
        sawRootCauses = true;
    if (snap.projections.some((p) => p.verdict === 'recommended'))
        sawRecommended = true;
    if (snap.simTime > TARGET_SIM_MS) {
        accuracy = snap.accuracy;
        unsub();
        report(snap);
    }
});
function report(snap) {
    engine.pause();
    const incidents = snap.incidents.length;
    const lead = firstFailureTs !== null && firstPredictionTs !== null ? firstFailureTs - firstPredictionTs : null;
    ok(sawLogs, `logs streaming (${snap.logs.length} in window)`);
    ok(incidents >= 1, `incident detected (count=${incidents})`);
    ok(maxRiskSeen > 0.5, `predictor produced meaningful risk (max=${maxRiskSeen.toFixed(2)})`);
    ok(predictedBeforeFailure && lead !== null && lead > 0, `prediction preceded failure by ${lead !== null ? Math.round(lead / 1000) : '?'}s`);
    ok(sawRootCauses, 'root-cause hypotheses produced during incident');
    ok(sawRecommended, 'recovery optimizer produced a recommended strategy');
    ok(accuracy !== null && accuracy.hits + accuracy.falseAlarms > 0, `accuracy tracker resolved predictions (${JSON.stringify(accuracy)})`);
    console.log('--- SMOKE RESULTS ---');
    results.forEach((r) => console.log(r));
    console.log(`scenario=${snap.scenarioId} simTime=${(snap.simTime / 60000).toFixed(1)}min`);
    console.log('accuracy=', JSON.stringify(snap.accuracy));
    console.log('incidents=', JSON.stringify(snap.incidents.map((i) => ({ sev: i.severity, origin: i.origin, title: i.title }))));
    const failedNow = Object.values(snap.services).filter((s) => s.metrics.failed).map((s) => s.id);
    console.log('failedNow=', failedNow.join(',') || '(none)');
    const fails = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(fails === 0 ? 'ALL PASS' : `${fails} FAILURES`);
    process.exit(fails === 0 ? 0 : 1);
}
// safety timeout
setTimeout(() => {
    console.log('TIMEOUT — engine did not reach target sim time');
    process.exit(2);
}, 180_000);
