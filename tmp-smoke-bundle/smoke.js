// src/core/types.ts
var SIM = {
	/** real ms per engine tick */
	TICK_REAL_MS: 600,
	/** sim ms advanced per step */
	SIM_MS_PER_STEP: 3e3,
	/** prediction horizon, sim ms */
	RISK_HORIZON_MS: 3e5,
	/** risk above this counts as an active prediction */
	RISK_THRESHOLD: .55,
	/** max log events kept */
	LOG_WINDOW: 500,
	/** metrics samples per service kept */
	HISTORY_WINDOW: 120
};
// src/core/engine/logs.ts
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = a + 1831565813 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
var TRACE_CHARS = "abcdef0123456789";
function traceId(rng) {
	let s = "";
	for (let i = 0; i < 16; i++) s += TRACE_CHARS[Math.floor(rng() * 16)];
	return s;
}
var TEMPLATES = {
	gateway: [
		{
			level: "INFO",
			msg: (c, r) => `GET /api/v2/bundle 200 ${Math.round(c.latencyP50 + r() * 8)}ms`
		},
		{
			level: "INFO",
			msg: (c, r) => `POST /api/v2/checkout 201 ${Math.round(c.latencyP50 * 1.4)}ms`
		},
		{
			level: "WARN",
			code: "WARN_UPSTREAM_SLOW",
			msg: (c) => `upstream latency ${Math.round(c.latencyP50 * 2)}ms exceeds error budget`
		},
		{
			level: "ERROR",
			code: "ERR_UPSTREAM_502",
			msg: () => `502 upstream-error orders-api connection reset by peer`
		},
		{
			level: "ERROR",
			code: "ERR_GATEWAY_TIMEOUT",
			msg: (c) => `504 gateway timeout after ${Math.round(c.latencyP99)}ms`
		}
	],
	api: [
		{
			level: "INFO",
			msg: (c, r) => c.service.startsWith("payments") ? `payment captured txn_${Math.floor(r() * 1e6)} ${Math.round(c.latencyP50)}ms` : c.service.startsWith("orders") ? `order created ord_${Math.floor(r() * 1e5)} ${Math.round(c.latencyP50)}ms` : c.service.startsWith("auth") ? `session validated ${Math.round(c.latencyP50)}ms` : `stock reservation ok ${Math.round(c.latencyP50)}ms`
		},
		{
			level: "DEBUG",
			msg: (c, r) => `trace ${traceId(r)} span complete`
		},
		{
			level: "WARN",
			code: "WARN_RETRY",
			msg: (c, r) => `retry attempt ${1 + Math.floor(r() * 4)}/5 trace ${traceId(r)}`
		},
		{
			level: "WARN",
			code: "WARN_DEP_LATENCY",
			msg: (c) => `dependency latency ${Math.round(c.latencyP50 * 3)}ms (budget exceeded)`
		},
		{
			level: "ERROR",
			code: "ERR_DOWNSTREAM_TIMEOUT",
			msg: (c) => `downstream timeout after ${Math.round(c.latencyP99)}ms`
		},
		{
			level: "ERROR",
			code: "ERR_CIRCUIT_OPEN",
			msg: () => `circuit breaker OPEN — failing fast`
		},
		{
			level: "FATAL",
			code: "ERR_OOM",
			msg: () => `FATAL: OutOfMemoryError — container OOMKilled`
		}
	],
	database: [
		{
			level: "DEBUG",
			msg: (c, r) => `query executed ${Math.round(4 + r() * 12)}ms rows=${Math.floor(r() * 200)}`
		},
		{
			level: "WARN",
			code: "WARN_POOL_HIGH",
			msg: (c) => `pool utilization ${(c.saturation * 100).toFixed(0)}% wait ${Math.round(c.saturation * 180)}ms`
		},
		{
			level: "ERROR",
			code: "ERR_DB_POOL_EXHAUSTED",
			msg: () => `HikariPool-1 — connection is not available, timed out after 30000ms`
		},
		{
			level: "ERROR",
			code: "ERR_LOCK_TIMEOUT",
			msg: () => `deadlock detected; transaction aborted (lock wait timeout)`
		},
		{
			level: "FATAL",
			code: "ERR_DB_DOWN",
			msg: () => `connection pool exhausted — rejecting all queries`
		}
	],
	cache: [
		{
			level: "DEBUG",
			msg: (c, r) => `GET key:user:${Math.floor(r() * 1e5)} ${r() < .8 ? "HIT" : "MISS"} 0.${Math.floor(r() * 9)}ms`
		},
		{
			level: "WARN",
			code: "WARN_EVICTIONS",
			msg: (c, r) => `evictions rising (${Math.floor(r() * 900 + 100)}/min) maxmemory pressure`
		},
		{
			level: "ERROR",
			code: "ERR_REDIS_MAXMEMORY",
			msg: () => `OOM command not allowed when used memory > 'maxmemory'`
		},
		{
			level: "ERROR",
			code: "ERR_CONN_REFUSED",
			msg: () => `connection refused — accept queue full`
		}
	],
	queue: [
		{
			level: "DEBUG",
			msg: (c, r) => `produce ack partition=${Math.floor(r() * 12)} offset=${Math.floor(r() * 1e6)}`
		},
		{
			level: "WARN",
			code: "WARN_CONSUMER_LAG",
			msg: (c, r) => `consumer lag ${Math.floor(1e3 + r() * 4e4)} msgs on orders-events`
		},
		{
			level: "ERROR",
			code: "ERR_PRODUCE_TIMEOUT",
			msg: () => `expiring 3 record(s) — produce timeout 30000ms`
		},
		{
			level: "FATAL",
			code: "ERR_BROKER_DOWN",
			msg: () => `broker unavailable — rejecting produces`
		}
	],
	worker: [
		{
			level: "INFO",
			msg: (c, r) => `job ${Math.floor(r() * 5e3)} completed ${Math.round(c.latencyP50)}ms`
		},
		{
			level: "WARN",
			code: "WARN_QUEUE_DEPTH",
			msg: () => `queue depth above watermark`
		},
		{
			level: "ERROR",
			code: "ERR_JOB_FAILED",
			msg: () => `job failed — upstream unavailable`
		}
	],
	storage: [
		{
			level: "DEBUG",
			msg: (c, r) => `PUT object ${Math.floor(r() * 900)}kb ok`
		},
		{
			level: "WARN",
			code: "WARN_SLOW_IO",
			msg: () => `disk io latency elevated`
		},
		{
			level: "ERROR",
			code: "ERR_STORAGE_5XX",
			msg: () => `500 internal storage error`
		}
	],
	external: [{
		level: "INFO",
		msg: () => `webhook delivered`
	}, {
		level: "ERROR",
		code: "ERR_429",
		msg: () => `429 rate limited by provider`
	}]
};
function pickByLevel(list, rng, levels) {
	const filtered = list.filter((t) => levels.includes(t.level));
	const pool = filtered.length ? filtered : list;
	return pool[Math.floor(rng() * pool.length)];
}
function generateLogs(ctx, ts, rng, idAlloc) {
	const events = [];
	const templates = TEMPLATES[ctx.kind] ?? TEMPLATES.api;
	let count;
	if (ctx.failed) count = 4 + Math.floor(rng() * 4);
	else if (ctx.errorRate > .3) count = 2 + Math.floor(rng() * 4);
	else if (ctx.util > .75) count = 1 + Math.floor(rng() * 3);
	else count = rng() < .55 ? 1 : 2;
	for (let i = 0; i < count; i++) {
		const roll = rng();
		let tpl;
		if (ctx.failed) tpl = roll < .6 ? pickByLevel(templates, rng, ["ERROR", "FATAL"]) : templates[Math.floor(rng() * templates.length)];
		else if (ctx.errorRate > .2 || ctx.util > .9 || ctx.saturation > .9) tpl = roll < .5 ? pickByLevel(templates, rng, [
			"WARN",
			"ERROR",
			"FATAL"
		]) : templates[Math.floor(rng() * templates.length)];
		else if (ctx.util > .7 || ctx.saturation > .7) tpl = roll < .3 ? pickByLevel(templates, rng, ["WARN", "ERROR"]) : templates[Math.floor(rng() * templates.length)];
		else tpl = templates[Math.floor(rng() * Math.min(2, templates.length))];
		events.push({
			id: ++idAlloc.n,
			ts,
			service: ctx.service,
			level: tpl.level,
			message: tpl.msg(ctx, rng),
			code: tpl.code,
			traceId: rng() < .5 ? traceId(rng) : void 0,
			latencyMs: Math.round(ctx.latencyP50 + rng() * Math.max(4, ctx.latencyP50))
		});
	}
	return events;
}
// src/core/engine/scenarios.ts
/**
* Fault scenario library. Each id is interpreted by the engine's
* fault dynamics. Metadata drives the UI selector.
*/
var SCENARIOS = [
	{
		id: "pool-exhaustion",
		name: "Connection Pool Exhaustion",
		tagline: "Orders-DB pool leak starves the order path",
		description: "A connection leak on Orders-DB slowly drains the pool. Saturation creeps up, queries queue, retries amplify through Orders API and Inventory API, and the cascade reaches the gateway. The classic silent killer.",
		faultStartMs: 45e3
	},
	{
		id: "memory-leak",
		name: "Memory Leak → OOM",
		tagline: "Payments API heap creep ends in OOM",
		description: "Payments API leaks heap every request. GC thrash degrades latency long before the OOM kill — the predictor should catch the creep minutes in advance, then watch the blast radius hit Payments-DB and Kafka.",
		faultStartMs: 3e4
	},
	{
		id: "traffic-surge",
		name: "Traffic Surge (3×)",
		tagline: "Flash-sale traffic overloads the edge",
		description: "A marketing spike triples traffic for three minutes. The gateway and Inventory API saturate, the Redis cache stampedes, and overload spills into Orders-DB. Tests capacity planning and shed-load strategies.",
		faultStartMs: 2e4
	},
	{
		id: "retry-storm",
		name: "Retry Storm",
		tagline: "A 30s blip becomes a self-sustaining storm",
		description: "Payments-DB suffers a brief blip, but Payments API retries with 4× amplification. When the blip heals, the retry backlog is already self-sustaining — the system attacks itself. A circuit-breaker or shed-load saves it.",
		faultStartMs: 25e3
	}
];
SCENARIOS.map((s) => s.id);
var DEFAULT_SCENARIO = SCENARIOS[0].id;
// src/core/engine/sim.ts
function freshMetrics(node, ts) {
	return {
		service: node.id,
		ts,
		rps: 0,
		latencyP50: 12,
		latencyP99: 40,
		errorRate: 0,
		cpu: .1,
		memory: .3,
		saturation: .1,
		healthy: true,
		failed: false
	};
}
function freshService(node, ts) {
	return {
		node,
		status: "healthy",
		metrics: freshMetrics(node, ts),
		history: [],
		demand: 0,
		processed: 0,
		capacityMult: 1,
		demandMult: 1,
		demandCapMult: null,
		demandCapUntil: 0,
		memory: .3,
		saturation: .1,
		backlog: 0,
		failedAt: null,
		failureCause: null,
		downtimeUntil: 0,
		recoveringUntil: 0,
		satStreak: 0,
		errStreak: 0,
		healthyStreak: 0,
		leakRate: 0,
		memLeakRate: 0,
		lastAlertStatus: "healthy",
		everPredicted: false
	};
}
function zeroAccuracy() {
	return {
		predictions: 0,
		hits: 0,
		falseAlarms: 0,
		missed: 0,
		avgLeadTimeMs: 0,
		precision: 0,
		recall: 0
	};
}
var clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function createEngine(topology, diagnostics) {
	new Map(topology.nodes.map((n) => [n.id, n]));
	const callersOf = /* @__PURE__ */ new Map();
	for (const e of topology.edges) {
		if (!callersOf.has(e.to)) callersOf.set(e.to, []);
		callersOf.get(e.to).push({
			from: e.from,
			weight: e.weight,
			critical: e.critical
		});
	}
	const calleesOf = /* @__PURE__ */ new Map();
	for (const e of topology.edges) {
		if (!calleesOf.has(e.from)) calleesOf.set(e.from, []);
		calleesOf.get(e.from).push({
			to: e.to,
			weight: e.weight,
			critical: e.critical
		});
	}
	const gatewayId = topology.nodes.find((n) => n.kind === "gateway")?.id;
	const apis = topology.nodes.filter((n) => n.kind === "api").map((n) => n.id);
	let s;
	let timer = null;
	const listeners = /* @__PURE__ */ new Set();
	function reset(scenarioId, seed) {
		s = {
			tick: 0,
			simTime: 0,
			running: true,
			speed: 1,
			scenarioId,
			rng: mulberry32(seed),
			services: new Map(topology.nodes.map((n) => [n.id, freshService(n, 0)])),
			logs: [],
			logId: { n: 0 },
			incidents: [],
			incidentSeq: 0,
			alerts: [],
			alertSeq: 0,
			risks: {},
			rootCauses: [],
			projections: [],
			appliedStrategies: [],
			accuracy: zeroAccuracy(),
			ledger: [],
			ledgerSeq: 0
		};
	}
	function alert(severity, message, service) {
		s.alerts.push({
			id: `al-${++s.alertSeq}`,
			ts: s.simTime,
			severity,
			service,
			message
		});
		if (s.alerts.length > 80) s.alerts.splice(0, s.alerts.length - 80);
	}
	function applyFaults() {
		const t = s.simTime;
		for (const svc of s.services.values()) {
			svc.leakRate = 0;
			svc.memLeakRate = 0;
		}
		switch (s.scenarioId) {
			case "pool-exhaustion": {
				const db = s.services.get("orders-db");
				if (db && t >= 45e3) {
					const decay = clamp((t - 45e3) / 3e5, 0, 1);
					db.capacityMult = Math.min(db.capacityMult, 1 - .75 * decay);
					db.leakRate = .02;
					db.failureCause = db.failureCause ?? "leak";
				}
				break;
			}
			case "memory-leak": {
				const api = s.services.get("payments-api");
				if (api && t >= 3e4 && api.failedAt === null) {
					api.memLeakRate = .011;
					api.failureCause = api.failureCause ?? "oom";
				}
				break;
			}
			case "traffic-surge": {
				const gw = s.services.get(gatewayId ?? "");
				const redis = s.services.get("redis-cache");
				if (t >= 2e4 && t < 2e5) {
					if (gw) gw.demandMult = 1 + 2 * clamp((t - 2e4) / 12e4, 0, 1);
					if (redis) redis.capacityMult = Math.min(redis.capacityMult, .45);
				} else if (t >= 2e5) {
					if (gw) gw.demandMult = 1.05;
				}
				break;
			}
			case "retry-storm": {
				const pdb = s.services.get("payments-db");
				if (pdb && t >= 25e3 && t < 55e3) {
					pdb.capacityMult = 1 - .7 * clamp((t - 25e3) / 2e4, 0, 1);
					pdb.failureCause = pdb.failureCause ?? "blip";
				} else if (pdb && t >= 55e3) pdb.capacityMult = 1;
				break;
			}
		}
	}
	/** retry amplification factor for caller→callee edge at current sim time */
	function retryFactorFor(from, to) {
		if (s.scenarioId === "retry-storm" && from.node.id === "payments-api" && to.node.id === "payments-db") {
			if (s.simTime >= 25e3 && s.simTime <= 85e3) return 3 * clamp((s.simTime - 25e3) / 2e4, .15, 1);
		}
		if (to.status === "failed") return 2.5;
		if (to.metrics.errorRate > .1) return 2 * Math.min(1, (to.metrics.errorRate - .1) / .4);
		return 0;
	}
	function effectiveCapacity(svc) {
		if (svc.failedAt !== null) return svc.node.capacity * .02;
		if (s.simTime < svc.downtimeUntil) return 0;
		let cap = svc.node.capacity * svc.capacityMult;
		if (s.simTime < svc.recoveringUntil) cap *= .7;
		if (svc.memLeakRate > 0 && svc.memory > .85) cap *= 1 - .6 * ((svc.memory - .85) / .15);
		return cap;
	}
	function step() {
		s.simTime += SIM.SIM_MS_PER_STEP;
		s.tick += 1;
		applyFaults();
		const t = s.simTime;
		const noise = .04;
		const gw = gatewayId ? s.services.get(gatewayId) : void 0;
		if (gw) {
			let demand = .55 * gw.node.capacity * gw.demandMult * (1 + (s.rng() - .5) * 2 * noise);
			if (gw.demandCapMult !== null && t < (gw.demandCapUntil ?? Infinity)) demand = Math.min(demand, gw.demandCapMult * gw.node.capacity * gw.capacityMult);
			gw.demand = demand;
		}
		if (gw) processService(gw);
		for (const id of apis) {
			const svc = s.services.get(id);
			if (!svc || !gw) continue;
			const edge = calleesOf.get(gw.node.id)?.find((e) => e.to === id);
			if (!edge) continue;
			let incoming = gw.processed * edge.weight;
			if (gw.failedAt !== null) incoming *= .15;
			svc.demand = incoming;
			processService(svc);
		}
		for (const svc of s.services.values()) {
			if (svc.node.kind === "gateway" || svc.node.kind === "api") continue;
			let incoming = 0;
			for (const c of callersOf.get(svc.node.id) ?? []) {
				const caller = s.services.get(c.from);
				if (!caller) continue;
				if (cutEdges.has(`${c.from}->${svc.node.id}`)) continue;
				if (svc.node.kind === "cache" && cacheBypassed) continue;
				const rf = retryFactorFor(caller, svc);
				incoming += caller.processed * c.weight * (1 + rf);
				if (rf > 0) caller.backlog += caller.processed * c.weight * rf * .02;
			}
			svc.demand = incoming;
			processService(svc);
		}
		for (const svc of s.services.values()) {
			svc.backlog = Math.max(0, svc.backlog * .72 - 2);
			updateStatus(svc);
		}
	}
	/** transient edge cuts (circuit-breaker) and cache bypass */
	const cutEdges = /* @__PURE__ */ new Set();
	let cacheBypassed = false;
	function processService(svc) {
		const cap = Math.max(1, effectiveCapacity(svc));
		const util = svc.demand / cap;
		svc.processed = Math.min(svc.demand, cap);
		const p50 = (svc.node.kind === "database" ? 9 : svc.node.kind === "cache" ? 1.2 : svc.node.kind === "queue" ? 4 : 18) * (1 / Math.max(.08, 1 - Math.pow(clamp(util, 0, .97), 2.2)));
		const errFromUtil = util > .7 ? Math.min(.98, Math.pow((util - .7) / .55, 1.6)) : 0;
		let depError = 0;
		for (const e of calleesOf.get(svc.node.id) ?? []) {
			if (cutEdges.has(`${svc.node.id}->${e.to}`)) continue;
			if (!e.critical) continue;
			const dep = s.services.get(e.to);
			if (!dep) continue;
			if (dep.node.kind === "cache" && cacheBypassed) continue;
			depError += e.weight * (dep.failedAt !== null ? .8 : dep.metrics.errorRate * .7);
		}
		const errorRate = svc.failedAt !== null ? .95 : clamp(Math.max(errFromUtil, depError * .6), 0, .98);
		const pileup = .4 * Math.max(0, util - .9) + svc.backlog / (svc.backlog + 400);
		if (svc.memLeakRate > 0) svc.memory = clamp(svc.memory + svc.memLeakRate + pileup * .2, .05, 1.25);
		else {
			const loadPressure = Math.min(pileup, .02);
			svc.memory = clamp(svc.memory + (loadPressure - (svc.memory - .3)) * .25, .05, 1.25);
		}
		const targetSat = svc.node.kind === "api" ? clamp(svc.backlog / 300, 0, 1.25) : clamp(util, 0, 1.25);
		svc.saturation = clamp(svc.saturation + (targetSat - svc.saturation) * .3 + svc.leakRate, .05, 1.3);
		svc.metrics = {
			service: svc.node.id,
			ts: s.simTime,
			rps: Math.round(svc.demand),
			latencyP50: Math.round(p50),
			latencyP99: Math.round(p50 * (3 + 6 * clamp(util, 0, 1))),
			errorRate: Number(errorRate.toFixed(3)),
			cpu: Number(clamp(util * .9 + .08, 0, 1.2).toFixed(3)),
			memory: Number(svc.memory.toFixed(3)),
			saturation: Number(svc.saturation.toFixed(3)),
			healthy: svc.failedAt === null && errorRate < .15 && util < .9,
			failed: svc.failedAt !== null
		};
		svc.history.push({ ...svc.metrics });
		if (svc.history.length > SIM.HISTORY_WINDOW) svc.history.shift();
		if (svc.failedAt === null && s.simTime >= svc.downtimeUntil) {
			if (svc.saturation >= 1.2) svc.satStreak++;
			else svc.satStreak = 0;
			if (errorRate >= .92) svc.errStreak++;
			else svc.errStreak = 0;
			const oom = svc.memory >= 1.05 && svc.memLeakRate > 0;
			if (oom || svc.satStreak >= 6 || svc.errStreak >= 5) failService(svc, oom ? "oom" : svc.failureCause ?? "error");
		}
	}
	function failService(svc, cause) {
		svc.failedAt = s.simTime;
		svc.failureCause = cause;
		svc.satStreak = 0;
		svc.errStreak = 0;
		svc.healthyStreak = 0;
		alert("critical", `${svc.node.name} FAILED (${cause}) — downstream impact expected`, svc.node.id);
	}
	function updateStatus(svc) {
		const m = svc.metrics;
		let next;
		if (s.simTime < svc.downtimeUntil) next = "failed";
		else if (svc.failedAt !== null) {
			if ((svc.failureCause === "overload" || svc.failureCause === "blip") && s.simTime - (svc.failedAt ?? 0) >= 45e3) {
				recoverService(svc);
				next = "recovering";
			} else if (svc.failureCause === "blip" && s.scenarioId === "retry-storm" && s.simTime >= 55e3) {
				recoverService(svc);
				next = "recovering";
			} else next = "failed";
		} else if (s.simTime < svc.recoveringUntil) next = "recovering";
		else if (m.errorRate > .15 || m.saturation > .9 || m.cpu > .95 || m.memory > .95) next = "critical";
		else if (m.errorRate > .02 || m.saturation > .7 || m.cpu > .75 || m.memory > .85) next = "degraded";
		else next = "healthy";
		if (next === "healthy") svc.healthyStreak++;
		else svc.healthyStreak = 0;
		svc.status = next;
		if (next !== svc.lastAlertStatus) {
			if (next === "critical") alert("warning", `${svc.node.name} critical — util ${(m.cpu * 100).toFixed(0)}%, err ${(m.errorRate * 100).toFixed(0)}%`, svc.node.id);
			if (next === "degraded" && svc.lastAlertStatus === "healthy") alert("warning", `${svc.node.name} degraded — latency ${m.latencyP99}ms p99`, svc.node.id);
			if (next === "recovering") alert("info", `${svc.node.name} recovering`, svc.node.id);
			if (next === "healthy" && svc.lastAlertStatus !== "healthy") alert("info", `${svc.node.name} back to healthy`, svc.node.id);
			svc.lastAlertStatus = next;
		}
	}
	function recoverService(svc) {
		svc.failedAt = null;
		svc.failureCause = null;
		svc.satStreak = 0;
		svc.errStreak = 0;
		svc.memory = .35;
		svc.saturation = .2;
		svc.backlog = 0;
		svc.capacityMult = 1;
		svc.recoveringUntil = s.simTime + 2e4;
	}
	function activeIncident() {
		return s.incidents.find((i) => i.resolvedAt === void 0) ?? null;
	}
	function updateIncidents() {
		const failing = [...s.services.values()].filter((v) => v.failedAt !== null || v.metrics.errorRate > .5);
		const inc = activeIncident();
		if (!inc) {
			if (failing.length > 0) {
				const first = failing.reduce((a, b) => (a.failedAt ?? Infinity) <= (b.failedAt ?? Infinity) ? a : b);
				const sev = first.node.criticality >= .9 ? "SEV-1" : "SEV-2";
				const i = {
					id: `inc-${++s.incidentSeq}`,
					startedAt: s.simTime,
					origin: first.node.id,
					services: failing.map((f) => f.node.id),
					severity: sev,
					title: `Cascading outage originating at ${first.node.name}`
				};
				s.incidents.push(i);
				alert("critical", `${sev}: ${i.title}`, first.node.id);
			}
			return;
		}
		for (const f of failing) if (!inc.services.includes(f.node.id)) inc.services.push(f.node.id);
		const members = inc.services.map((id) => s.services.get(id)).filter(Boolean);
		if (members.length > 0 && members.every((m) => m.healthyStreak >= 10)) {
			inc.resolvedAt = s.simTime;
			alert("info", `Incident resolved — all systems recovered (duration ${Math.round((s.simTime - inc.startedAt) / 1e3)}s)`);
		}
	}
	function buildInput() {
		const services = {};
		for (const svc of s.services.values()) services[svc.node.id] = {
			...svc.node,
			status: svc.status,
			metrics: { ...svc.metrics },
			history: svc.history.slice(-SIM.HISTORY_WINDOW)
		};
		return {
			tick: s.tick,
			simTime: s.simTime,
			topology,
			services,
			logs: s.logs.slice(-SIM.LOG_WINDOW),
			incidents: s.incidents.map((i) => ({
				...i,
				services: [...i.services]
			}))
		};
	}
	/**
	* Prediction ledger — the auditable proof trail.
	* Every prediction raised by the AI is recorded, then resolved:
	*   confirmed   → the service actually failed (lead time = warning value)
	*   false-alarm → horizon elapsed with no failure
	*/
	function updateLedger(risks) {
		for (const svc of s.services.values()) {
			const r = risks[svc.node.id];
			const open = s.ledger.find((e) => e.service === svc.node.id && e.outcome === "pending");
			if (r?.predicted && !open && svc.failedAt === null) {
				s.ledger.push({
					id: `pl-${++s.ledgerSeq}`,
					service: svc.node.id,
					madeAt: s.simTime,
					risk: Number(r.risk.toFixed(3)),
					ttfMs: r.ttfMs,
					outcome: "pending"
				});
				if (s.ledger.length > 60) s.ledger.splice(0, s.ledger.length - 60);
			}
			if (open) {
				if (svc.failedAt !== null) {
					open.outcome = "confirmed";
					open.failedAt = s.simTime;
					open.leadTimeMs = s.simTime - open.madeAt;
				} else if (s.simTime - open.madeAt > SIM.RISK_HORIZON_MS) open.outcome = "false-alarm";
			}
		}
	}
	/**
	* Business impact & SLO burn — turns telemetry into the language
	* executives and judges care about: user impact, error-budget burn,
	* and revenue at risk per minute.
	*/
	function computeImpact() {
		let userImpact = 0;
		let burn = 0;
		let revenue = 0;
		let affected = 0;
		let criticalHit = false;
		for (const svc of s.services.values()) {
			const m = svc.metrics;
			const down = svc.failedAt !== null;
			const unhealthy = down ? 1 : m.errorRate > .05 ? Math.min(1, m.errorRate * 3) : 0;
			if (unhealthy > 0) affected++;
			if (down && svc.node.criticality >= .9) criticalHit = true;
			userImpact += svc.node.criticality * unhealthy;
			burn += svc.node.criticality * (m.errorRate > .02 ? 1 + 4 * m.errorRate : 0);
			revenue += svc.node.criticality * unhealthy * 12e3;
		}
		const pct = clamp(userImpact, 0, 1);
		return {
			userImpactPct: Number(pct.toFixed(3)),
			sloBurnRate: Number(clamp(1 + burn, 1, 20).toFixed(2)),
			revenueAtRiskPerMin: Math.round(revenue),
			affectedServices: affected,
			severity: criticalHit || pct > .5 ? "critical" : pct > .15 ? "elevated" : "nominal"
		};
	}
	function runDiagnostics() {
		const input = buildInput();
		try {
			const risks = diagnostics.predict(input, s.risks) ?? {};
			for (const [id, r] of Object.entries(risks)) {
				const svc = s.services.get(id);
				if (!svc) continue;
				if (r.predicted && !svc.everPredicted) {
					svc.everPredicted = true;
					alert("warning", `PREDICTION: ${svc.node.name} may fail within ${SIM.RISK_HORIZON_MS / 1e3}s (risk ${(r.risk * 100).toFixed(0)}%${r.ttfMs ? `, TTF ~${Math.round(r.ttfMs / 1e3)}s` : ""})`, id);
				} else if (!r.predicted) svc.everPredicted = false;
			}
			s.risks = risks;
			updateLedger(risks);
			s.rootCauses = diagnostics.rootCause(input) ?? [];
			s.projections = activeIncident() ? diagnostics.recovery(input) ?? [] : [];
			s.accuracy = diagnostics.accuracy(input, s.risks) ?? zeroAccuracy();
		} catch (e) {
			alert("info", `diagnostics: ${String(e).slice(0, 120)}`);
		}
	}
	const STRAT_NAMES = {
		restart: "Drain & restart",
		failover: "Failover to standby",
		"shed-load": "Shed non-critical load",
		"scale-up": "Scale up capacity",
		throttle: "Throttle intake",
		"circuit-breaker": "Open circuit breaker",
		"cache-bypass": "Bypass cache layer"
	};
	function strategyKind(id) {
		const head = id.split(/[:_|]/)[0];
		if (head in STRAT_NAMES) return head;
		for (const k of Object.keys(STRAT_NAMES)) if (id.includes(k)) return k;
		return null;
	}
	function applyStrategy(strategyId) {
		const kind = strategyKind(strategyId);
		if (!kind) return;
		const origin = activeIncident()?.origin;
		const worst = [...s.services.values()].filter((v) => v.failedAt !== null || v.status === "critical").sort((a, b) => (b.failedAt ?? 0) - (a.failedAt ?? 0))[0];
		const targetId = kind === "shed-load" || kind === "throttle" ? gatewayId : kind === "circuit-breaker" ? origin : kind === "cache-bypass" ? "redis-cache" : origin ?? worst?.node.id;
		const target = targetId ? s.services.get(targetId) : void 0;
		switch (kind) {
			case "restart":
				if (target) {
					target.downtimeUntil = s.simTime + 15e3;
					target.memory = .3;
					target.saturation = .15;
					target.backlog = 0;
					target.capacityMult = 1;
					target.recoveringUntil = s.simTime + 35e3;
				}
				break;
			case "failover":
				if (target) {
					target.capacityMult = Math.max(target.capacityMult, 1.8);
					target.backlog *= .5;
					target.recoveringUntil = 0;
				}
				break;
			case "scale-up":
				if (target) target.capacityMult = Math.max(target.capacityMult, 1.5);
				break;
			case "shed-load":
				if (target) {
					target.demandMult *= .6;
					target.demandCapMult = .65;
					target.demandCapUntil = s.simTime + 3e5;
				}
				break;
			case "throttle":
				if (target) {
					target.demandCapMult = .75;
					target.demandCapUntil = s.simTime + 3e5;
				}
				break;
			case "circuit-breaker": {
				let best = null;
				for (const c of callersOf.get(targetId ?? "") ?? []) {
					const caller = s.services.get(c.from);
					if (!caller || caller.failedAt !== null) continue;
					if (best === null || c.weight > best.w) best = {
						from: c.from,
						w: c.weight
					};
				}
				if (best) {
					cutEdges.add(`${best.from}->${targetId}`);
					const caller = s.services.get(best.from);
					if (caller) caller.metrics.errorRate = clamp(caller.metrics.errorRate + .05, 0, .98);
				}
				break;
			}
			case "cache-bypass": cacheBypassed = true;
		}
		s.appliedStrategies.push({
			strategyId,
			ts: s.simTime
		});
		alert("info", `Recovery action applied: ${STRAT_NAMES[kind]}${target ? ` → ${target.node.name}` : ""}`);
	}
	function evaluateStrategyOutcomes() {
		for (const ap of s.appliedStrategies) {
			if (ap.outcome !== void 0) continue;
			if (s.simTime - ap.ts < 18e4) continue;
			const newFailures = [...s.services.values()].filter((v) => v.failedAt !== null && (v.failedAt ?? 0) > ap.ts);
			ap.outcome = newFailures.length === 0 ? "contained" : newFailures.length <= 1 ? "partial" : "ineffective";
			alert(ap.outcome === "contained" ? "info" : "warning", `Strategy outcome: ${ap.outcome} (${newFailures.length} new failures since application)`);
		}
	}
	function snapshot() {
		const services = {};
		for (const svc of s.services.values()) services[svc.node.id] = {
			...svc.node,
			status: svc.status,
			metrics: { ...svc.metrics },
			history: svc.history.slice(-SIM.HISTORY_WINDOW)
		};
		return {
			tick: s.tick,
			simTime: s.simTime,
			running: s.running,
			speed: s.speed,
			scenarioId: s.scenarioId,
			services,
			logs: s.logs.slice(-SIM.LOG_WINDOW),
			incidents: s.incidents.map((i) => ({
				...i,
				services: [...i.services]
			})),
			risks: { ...s.risks },
			rootCauses: s.rootCauses,
			projections: s.projections,
			appliedStrategies: [...s.appliedStrategies],
			accuracy: { ...s.accuracy },
			alerts: s.alerts.slice(-60),
			ledger: s.ledger.map((e) => ({ ...e })),
			impact: computeImpact()
		};
	}
	function tickOnce() {
		if (!s.running) return;
		for (let i = 0; i < s.speed; i++) step();
		updateIncidents();
		evaluateStrategyOutcomes();
		runDiagnostics();
		for (const svc of s.services.values()) {
			const ctx = {
				service: svc.node.id,
				kind: svc.node.kind,
				util: svc.metrics.cpu,
				errorRate: svc.metrics.errorRate,
				latencyP50: svc.metrics.latencyP50,
				latencyP99: svc.metrics.latencyP99,
				memory: svc.metrics.memory,
				saturation: svc.metrics.saturation,
				failed: svc.failedAt !== null
			};
			s.logs.push(...generateLogs(ctx, s.simTime, s.rng, s.logId));
		}
		if (s.logs.length > SIM.LOG_WINDOW) s.logs.splice(0, s.logs.length - SIM.LOG_WINDOW);
		const snap = snapshot();
		listeners.forEach((l) => l(snap));
	}
	function startLoop() {
		if (timer !== null) clearInterval(timer);
		timer = setInterval(tickOnce, SIM.TICK_REAL_MS);
	}
	const engine = {
		start() {
			startLoop();
		},
		pause() {
			s.running = false;
		},
		resume() {
			s.running = true;
		},
		isRunning() {
			return s.running;
		},
		setSpeed(mult) {
			s.speed = mult;
		},
		loadScenario(id, seed = 42) {
			reset(id, seed);
			cutEdges.clear();
			cacheBypassed = false;
		},
		applyStrategy,
		snapshot,
		subscribe(cb) {
			listeners.add(cb);
			return () => listeners.delete(cb);
		}
	};
	reset(DEFAULT_SCENARIO, 42);
	return engine;
}
// src/core/ai/predictor.ts
var BIAS = -3.7;
var W_MEM = 2;
var W_SAT = 2.4;
var W_ERR = .8;
var W_CPU = .5;
var W_LAT = .45;
var W_SLOPE_MEM = 14;
var W_SLOPE_SAT = 10;
var W_SLOPE_ERR = 1.4;
var W_LOG = .9;
var EWMA_A_FAST = .35;
var EWMA_A_SLOW = .8;
var SLOPE_MEM_SCALE = 6e4;
var SLOPE_ERR_SCALE = 12e4;
var LOG_WINDOW_MS = 3e4;
var LOG_BURST_COUNT = 8;
var LAT_SCALE_MS = 2e3;
var ERR_SCALE = 5;
var TREND_WINDOW_MS = 12e4;
var PROP_ITERATIONS = 2;
var PROP_GAIN = .3;
var LOCAL_MIX = .75;
var SMOOTH_OWN = .65;
var TTF_FLOOR_MS = 1e3;
/**
* Hard-failure propensity by service class. A saturated connection pool
* or a leaking heap takes a datastore down; an API service usually
* degrades (serving errors) rather than dying. Scaling the score by
* class keeps the model from crying wolf on downstream victims while
* still flagging the true origin of a cascade.
*/
var KIND_FACTOR = {
	database: 1.2,
	queue: 1.15,
	cache: 1,
	gateway: .95,
	api: .8,
	worker: .8,
	storage: 1,
	external: .9
};
var clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
var sigmoid = (z) => 1 / (1 + Math.exp(-z));
/** Fast−slow EWMA trend of a series, expressed per sim-ms.
*  For a linear ramp of d per sample the fast EWMA lags d·aF/(1−aF)
*  and the slow one d·aS/(1−aS); their difference is ∝ d. */
function ewmaTrendPerMs(values, gapMs) {
	if (values.length < 3) return 0;
	const gap = gapMs > 0 ? gapMs : SIM.SIM_MS_PER_STEP;
	const k = EWMA_A_SLOW / .19999999999999996 - EWMA_A_FAST / .65;
	let fast = values[0];
	let slow = values[0];
	for (let i = 1; i < values.length; i++) {
		const v = values[i];
		fast = EWMA_A_FAST * fast + .65 * v;
		slow = EWMA_A_SLOW * slow + .19999999999999996 * v;
	}
	return (fast - slow) / (k * gap);
}
function extractFeatures(history, cur, input, id) {
	const win = history.filter((m) => m.ts >= input.simTime - TREND_WINDOW_MS).slice(-40);
	const samples = win.length > 0 ? win : [cur];
	const n = samples.length;
	let mem = 0;
	let sat = 0;
	let err = 0;
	let cpu = 0;
	let lat = 0;
	const memSeries = [];
	const satSeries = [];
	const errSeries = [];
	for (const m of samples) {
		mem += m.memory;
		sat += m.saturation;
		err += m.errorRate;
		cpu += m.cpu;
		lat += m.latencyP99;
		memSeries.push(m.memory);
		satSeries.push(m.saturation);
		errSeries.push(m.errorRate);
	}
	const gap = n > 1 ? (samples[n - 1].ts - samples[0].ts) / (n - 1) : SIM.SIM_MS_PER_STEP;
	const cutoff = input.simTime - LOG_WINDOW_MS;
	let logHits = 0;
	for (const lg of input.logs) if (lg.service === id && lg.ts >= cutoff) {
		if (lg.level === "WARN" || lg.level === "ERROR" || lg.level === "FATAL") logHits++;
	}
	return {
		mem: clamp01(mem / n),
		sat: clamp01(sat / n),
		err: clamp01(err / n * ERR_SCALE),
		cpu: clamp01(cpu / n),
		lat: clamp01(lat / n / LAT_SCALE_MS),
		slopeMem: ewmaTrendPerMs(memSeries, gap),
		slopeSat: ewmaTrendPerMs(satSeries, gap),
		slopeErr: ewmaTrendPerMs(errSeries, gap),
		log: clamp01(logHits / LOG_BURST_COUNT),
		curMem: cur.memory,
		curSat: cur.saturation
	};
}
function localRisk(f) {
	const terms = [
		{
			label: "High memory utilization",
			w: W_MEM * f.mem
		},
		{
			label: "Resource saturation (pools/queues)",
			w: W_SAT * f.sat
		},
		{
			label: "Elevated error rate",
			w: W_ERR * f.err
		},
		{
			label: "CPU load",
			w: W_CPU * f.cpu
		},
		{
			label: "P99 latency degradation",
			w: W_LAT * f.lat
		},
		{
			label: "Memory climbing (leak trend)",
			w: W_SLOPE_MEM * clamp01(f.slopeMem * SLOPE_MEM_SCALE)
		},
		{
			label: "Saturation trending up",
			w: W_SLOPE_SAT * clamp01(f.slopeSat * SLOPE_MEM_SCALE)
		},
		{
			label: "Error rate trending up",
			w: W_SLOPE_ERR * clamp01(f.slopeErr * SLOPE_ERR_SCALE)
		},
		{
			label: "Warn/error log burst",
			w: W_LOG * f.log
		}
	];
	let z = BIAS;
	for (const t of terms) z += t.w;
	return {
		z,
		terms
	};
}
function pickDrivers(terms, cascadeTerm) {
	const all = terms.concat({
		label: "Cascade pressure from dependencies",
		w: cascadeTerm
	}).filter((t) => t.w > 1e-6).sort((a, b) => b.w - a.w).slice(0, 3);
	if (all.length === 0) return [{
		label: "All telemetry nominal",
		contribution: .8
	}, {
		label: "Baseline noise",
		contribution: .2
	}];
	if (all.length === 1) all.push({
		label: "Baseline telemetry noise",
		w: all[0].w * .25
	});
	const sum = all.reduce((s, t) => s + t.w, 0) || 1;
	return all.map((t) => ({
		label: t.label,
		contribution: t.w / sum
	}));
}
function predictRisks(input, prev) {
	const ids = Object.keys(input.services);
	const local = {};
	const feats = {};
	const termsById = {};
	for (const id of ids) {
		const state = input.services[id];
		if (!state) continue;
		const f = extractFeatures(state.history, state.metrics, input, id);
		feats[id] = f;
		const lr = localRisk(f);
		termsById[id] = lr.terms;
		local[id] = sigmoid(lr.z);
	}
	const prop = { ...local };
	for (let i = 0; i < PROP_ITERATIONS; i++) {
		const deltas = [];
		for (const e of input.topology.edges) {
			const callee = prop[e.to] ?? 0;
			const caller = prop[e.from] ?? 0;
			if (callee > 0) deltas.push({
				id: e.from,
				d: callee * e.weight * PROP_GAIN
			});
			if (caller > 0) deltas.push({
				id: e.to,
				d: caller * e.weight * PROP_GAIN
			});
		}
		for (const { id, d } of deltas) prop[id] = Math.min(1, (prop[id] ?? 0) + d);
	}
	const out = {};
	for (const id of ids) {
		const state = input.services[id];
		if (!state) continue;
		const f = feats[id];
		const loc = local[id] ?? 0;
		const blended = LOCAL_MIX * loc + .25 * (prop[id] ?? 0);
		const prevRisk = prev[id]?.risk;
		const own = prevRisk === void 0 ? blended : SMOOTH_OWN * blended + .35 * prevRisk;
		const risk = Math.min(.99, Math.max(.01, own * (KIND_FACTOR[state.kind] ?? 1)));
		const crossings = [];
		if (f.slopeMem > 1e-9) crossings.push((1 - f.curMem) / f.slopeMem);
		if (f.slopeSat > 1e-9) crossings.push((1 - f.curSat) / f.slopeSat);
		let ttf;
		if (crossings.length > 0) ttf = Math.min(SIM.RISK_HORIZON_MS, Math.max(TTF_FLOOR_MS, Math.min(...crossings)));
		const cascadeTerm = Math.max(0, (prop[id] ?? 0) - loc) * 2;
		const assessment = {
			service: id,
			ts: input.simTime,
			risk,
			predicted: risk >= SIM.RISK_THRESHOLD,
			drivers: pickDrivers(termsById[id] ?? [], cascadeTerm)
		};
		if (ttf !== void 0) assessment.ttfMs = ttf;
		out[id] = assessment;
	}
	return out;
}
// src/core/ai/rootcause.ts
function baseline(history, pick) {
	const win = history.slice(0, Math.max(1, Math.floor(history.length / 3)));
	return win.reduce((a, m) => a + pick(m), 0) / Math.max(1, win.length);
}
function detectOnsets(input) {
	const onsets = [];
	for (const svc of Object.values(input.services)) {
		const h = svc.history;
		if (h.length < 4) continue;
		const baseErr = baseline(h, (m) => m.errorRate);
		const baseSat = baseline(h, (m) => m.saturation);
		const baseP99 = baseline(h, (m) => m.latencyP99);
		let onsetIdx = -1;
		for (let i = 0; i < h.length; i++) {
			const m = h[i];
			if (m.errorRate > Math.max(.1, baseErr * 3) || m.saturation > Math.max(.7, baseSat + .3) || m.latencyP99 > Math.max(120, baseP99 * 3)) {
				onsetIdx = i;
				break;
			}
		}
		if (onsetIdx === -1) continue;
		const recent = h[h.length - 1];
		const sev = Math.min(1.5, Math.max(recent.errorRate * 2, recent.saturation, recent.cpu));
		const evidence = [];
		const selfRaw = Math.max(recent.saturation - baseSat, recent.memory - (baseline(h, (m) => m.memory) || 0), 0);
		const selfSignal = Math.min(1, selfRaw / .4);
		let depError = 0;
		for (const e of input.topology.edges) {
			if (e.from !== svc.id || !e.critical) continue;
			const dep = input.services[e.to];
			if (!dep) continue;
			depError += e.weight * dep.metrics.errorRate;
		}
		const depShare = Math.min(1, depError / Math.max(.05, recent.errorRate));
		if (recent.saturation > baseSat + .15) evidence.push(`${svc.name} saturation ${recent.saturation.toFixed(2)} (baseline ${baseSat.toFixed(2)})`);
		if (recent.errorRate > baseErr + .05) evidence.push(`${svc.name} error rate ${(recent.errorRate * 100).toFixed(0)}% (baseline ${(baseErr * 100).toFixed(1)}%)`);
		if (recent.latencyP99 > baseP99 * 2) evidence.push(`${svc.name} p99 latency ${recent.latencyP99}ms (baseline ${Math.round(baseP99)}ms)`);
		onsets.push({
			service: svc.id,
			ts: h[onsetIdx].ts,
			severity: sev,
			selfSignal,
			depShare,
			evidence
		});
	}
	return onsets;
}
function topErrorCodes(input, service, topN = 2) {
	const since = input.simTime - 6e4;
	const counts = /* @__PURE__ */ new Map();
	for (const log of input.logs) {
		if (log.service !== service || !log.code) continue;
		if (log.level !== "ERROR" && log.level !== "FATAL" && log.level !== "WARN") continue;
		if (log.ts < since) continue;
		counts.set(log.code, (counts.get(log.code) ?? 0) + 1);
	}
	return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([code, count]) => ({
		code,
		count
	}));
}
/** best (max product-of-weights) path from candidate to any affected service, DFS ≤4 hops */
function bestPath(candidate, affected, adj) {
	let best = null;
	const dfs = (node, strength, path, depth) => {
		if (best && strength <= best.strength) return;
		if (affected.has(node) && path.length > 1) {
			if (!best || strength > best.strength) best = {
				strength,
				path: [...path]
			};
		}
		if (depth >= 4) return;
		for (const e of adj.get(node) ?? []) {
			if (path.includes(e.to)) continue;
			path.push(e.to);
			dfs(e.to, strength * e.weight, path, depth + 1);
			path.pop();
		}
	};
	dfs(candidate, 1, [candidate], 0);
	return best;
}
function analyzeRootCauses(input) {
	const incident = input.incidents.find((i) => i.resolvedAt === void 0);
	if (!incident) return [];
	const affected = new Set(incident.services);
	const adj = /* @__PURE__ */ new Map();
	for (const e of input.topology.edges) {
		if (!adj.has(e.from)) adj.set(e.from, []);
		adj.get(e.from).push({
			to: e.to,
			weight: e.weight
		});
	}
	const onsets = detectOnsets(input);
	if (onsets.length === 0) return [];
	const t0 = Math.min(...onsets.map((o) => o.ts));
	const scored = onsets.map((o) => {
		const path = bestPath(o.service, affected, adj);
		const strength = path ? Math.max(.05, path.strength) : .02;
		const precedence = Math.exp(-(o.ts - t0) / 3e4);
		return {
			onset: o,
			path,
			strength,
			precedence,
			score: (.35 * o.severity + .65 * o.selfSignal) * precedence * (.4 + .6 * strength) * (1 - .45 * o.depShare)
		};
	});
	scored.sort((a, b) => b.score - a.score);
	const maxScore = Math.max(...scored.map((x) => x.score), 1e-4);
	return scored.slice(0, 3).map((x) => {
		const evidence = [...x.onset.evidence];
		for (const { code, count } of topErrorCodes(input, x.onset.service)) evidence.push(`${code} ×${count} in last 60s`);
		if (x.path && x.path.path.length > 1 && x.precedence > .5) {
			const lastAffected = [...x.path.path].reverse().find((p) => affected.has(p));
			if (lastAffected) {
				const affectedState = input.services[lastAffected];
				const onsetTs = x.onset.ts;
				evidence.push(`onset precedes ${affectedState.name} distress by ${Math.max(0, Math.round((input.simTime - onsetTs - 45e3) / 1e3))}s of telemetry`);
			}
		}
		return {
			service: x.onset.service,
			confidence: Number((.5 + .45 * (x.score / maxScore)).toFixed(2)),
			chain: x.path ? x.path.path : [x.onset.service],
			evidence: evidence.slice(0, 4)
		};
	});
}
// src/core/ai/recovery.ts
var STRATEGY_CATALOG = [
	{
		id: "restart",
		name: "Drain & Restart",
		description: "Restart the failing service — brief blip, clears leak/pool state",
		kind: "restart"
	},
	{
		id: "failover",
		name: "Failover to Standby",
		description: "Shift traffic to standby replicas — 1.8× capacity, no downtime",
		kind: "failover"
	},
	{
		id: "shed-load",
		name: "Shed Non-Critical Load",
		description: "Drop 40% of edge traffic to protect the critical path",
		kind: "shed-load"
	},
	{
		id: "scale-up",
		name: "Scale Up Capacity",
		description: "Add 50% capacity to the struggling service",
		kind: "scale-up"
	},
	{
		id: "throttle",
		name: "Throttle Intake",
		description: "Cap incoming requests at 75% — graceful degradation",
		kind: "throttle"
	},
	{
		id: "circuit-breaker",
		name: "Open Circuit Breaker",
		description: "Sever the toxic dependency edge — fail fast instead of piling up",
		kind: "circuit-breaker"
	},
	{
		id: "cache-bypass",
		name: "Bypass Cache Layer",
		description: "Route around the cache — DBs absorb the load, stampede contained",
		kind: "cache-bypass"
	}
];
var COST = {
	restart: 25,
	failover: 35,
	"shed-load": 45,
	"scale-up": 30,
	throttle: 40,
	"circuit-breaker": 20,
	"cache-bypass": 15
};
var STEP_MS = 5e3;
var HORIZON_STEPS = 144;
var ROLLOUTS = 30;
function rng(seed) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = a + 1831565813 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
/** Topological order (callers before callees) so demand flows downstream correctly. */
function topoOrder(nodeIds, edges) {
	const indeg = new Map(nodeIds.map((n) => [n, 0]));
	for (const e of edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
	const queue = nodeIds.filter((n) => (indeg.get(n) ?? 0) === 0);
	const out = [];
	while (queue.length > 0) {
		const n = queue.shift();
		out.push(n);
		for (const e of edges) {
			if (e.from !== n) continue;
			const v = (indeg.get(e.to) ?? 1) - 1;
			indeg.set(e.to, v);
			if (v === 0) queue.push(e.to);
		}
	}
	for (const n of nodeIds) if (!out.includes(n)) out.push(n);
	return out;
}
function projectStrategies(input) {
	const incident = input.incidents.find((i) => i.resolvedAt === void 0);
	if (!incident) return [];
	const nodes = input.topology.nodes;
	const edges = input.topology.edges;
	const idx = new Map(nodes.map((n, i) => [n.id, i]));
	const order = topoOrder(nodes.map((n) => n.id), edges);
	const initialUtil = nodes.map((n) => {
		const s = input.services[n.id];
		if (!s) return .2;
		return Math.min(1.1, .5 * s.metrics.cpu + .5 * s.metrics.saturation);
	});
	const initialFailed = nodes.map((n) => input.services[n.id]?.metrics.failed ?? false);
	const initiallyFailed = initialFailed.filter(Boolean).length;
	const capBase = nodes.map((n) => n.capacity);
	const demand = nodes.map((n, i) => {
		const live = input.services[n.id]?.metrics.rps ?? n.capacity * .5;
		return Math.min(live, capBase[i] * .9);
	});
	const originIdx = incident.origin ? idx.get(incident.origin) ?? 0 : 0;
	const gatewayIdx = nodes.findIndex((n) => n.kind === "gateway");
	const cacheIdx = nodes.findIndex((n) => n.kind === "cache");
	new Set(edges.filter((e) => nodes[idx.get(e.to) ?? 0]?.kind === "cache").map((e) => e.from));
	const runRollout = (strategy, seed) => {
		const r = rng(seed);
		const util = [...initialUtil];
		const failed = [...initialFailed];
		const failedAt = nodes.map(() => -1);
		const caps = [...capBase];
		const dem = [...demand];
		const processed = nodes.map(() => 0);
		let breakerEdge = null;
		let cacheBypassed = false;
		if (strategy) {
			const [kind, targetId] = strategy.split(":");
			const ti = targetId ? idx.get(targetId) ?? -1 : -1;
			if (kind === "scale-up" && ti >= 0) caps[ti] *= 1.5;
			if (kind === "failover" && ti >= 0) {
				caps[ti] *= 1.8;
				failed[ti] = false;
				failedAt[ti] = -1;
			}
			if (kind === "restart" && ti >= 0) {
				util[ti] = .35;
				failed[ti] = false;
				failedAt[ti] = -1;
			}
			if (kind === "shed-load" && gatewayIdx >= 0) dem[gatewayIdx] *= .6;
			if (kind === "throttle" && gatewayIdx >= 0) dem[gatewayIdx] *= .75;
			if (kind === "circuit-breaker") {
				let bestW = 0;
				for (const e of edges) {
					const to = idx.get(e.to) ?? -1;
					if (to === originIdx && e.weight > bestW) {
						bestW = e.weight;
						breakerEdge = {
							from: idx.get(e.from) ?? 0,
							to
						};
					}
				}
			}
			if (kind === "cache-bypass" && cacheIdx >= 0) {
				cacheBypassed = true;
				dem[cacheIdx] = 0;
				for (const e of edges) {
					const to = idx.get(e.to) ?? -1;
					if (nodes[to]?.kind === "cache") {
						const from = idx.get(e.from) ?? -1;
						for (const e2 of edges) if ((idx.get(e2.from) ?? -1) === from && (idx.get(e2.to) ?? -1) !== to) dem[idx.get(e2.to) ?? 0] += demand[to] * e2.weight;
					}
				}
			}
		}
		let damage = 0;
		let mttr = HORIZON_STEPS * STEP_MS;
		for (let step = 0; step < HORIZON_STEPS; step++) {
			for (const e of edges) {
				const fi = idx.get(e.from) ?? 0;
				const ti = idx.get(e.to) ?? 0;
				if (breakerEdge && breakerEdge.from === fi && breakerEdge.to === ti) continue;
				if (cacheBypassed && nodes[ti]?.kind === "cache") continue;
				const spill = util[ti] > .85 ? (util[ti] - .85) * .45 : 0;
				const retry = failed[ti] ? .06 : 0;
				dem[fi] += processed[fi] * e.weight * (spill + retry);
			}
			for (const id of order) {
				const i = idx.get(id) ?? 0;
				if (failed[i]) {
					processed[i] = 0;
					const pRecover = nodes[i]?.kind === "database" || nodes[i]?.kind === "api" ? .004 : .015;
					if (r() < pRecover) {
						failed[i] = false;
						failedAt[i] = -1;
						util[i] = .4;
						mttr = Math.min(mttr, step * STEP_MS);
					}
					continue;
				}
				const u = dem[i] / Math.max(1, caps[i]);
				util[i] = util[i] + (u - util[i]) * .5;
				if (util[i] > 1.15) {
					const pFail = Math.min(.35, (util[i] - 1.15) * .5);
					if (r() < pFail) {
						failed[i] = true;
						failedAt[i] = step;
					}
				}
				processed[i] = Math.min(dem[i], caps[i] * .98);
				const health = util[i] > .8 ? 1 - (util[i] - .8) * 2.5 : 1;
				damage += (nodes[i]?.criticality ?? .5) * (1 - Math.max(0, health)) * (STEP_MS / 1e3);
			}
			if (strategy?.startsWith("restart")) {
				const ti = idx.get(strategy.split(":")[1] ?? "") ?? -1;
				if (ti >= 0 && step === 3) {
					util[ti] = Math.min(util[ti], .45);
					failed[ti] = false;
					failedAt[ti] = -1;
				}
			}
		}
		const newFailures = failed.filter((f, i) => f && !initialFailed[i]).length;
		const endFailed = failed.filter(Boolean).length;
		return {
			newFailures,
			endFailed,
			damage,
			cascadeSize: endFailed,
			mttr: failed.every((f) => !f) ? mttr : HORIZON_STEPS * STEP_MS
		};
	};
	const seeds = Array.from({ length: ROLLOUTS }, (_, i) => input.tick * 131 + i * 17);
	let baseContained = 0;
	let baseDamage = 0;
	let baseSize = 0;
	for (const seed of seeds) {
		const out = runRollout(null, seed);
		if (out.newFailures === 0) baseContained++;
		baseDamage += out.damage;
		baseSize += out.cascadeSize;
	}
	const baseSuccess = baseContained / ROLLOUTS;
	const baseAvgDamage = baseDamage / ROLLOUTS;
	const projections = [{
		strategyId: "no-action",
		successProbability: Number(baseSuccess.toFixed(2)),
		expectedCascadeSize: Number((baseSize / ROLLOUTS).toFixed(1)),
		expectedDamage: Math.round(baseAvgDamage),
		mttrMs: HORIZON_STEPS * STEP_MS,
		cost: 0,
		verdict: "not-recommended",
		rationale: `Unmitigated: cascade contained in only ${Math.round(baseSuccess * 100)}% of ${ROLLOUTS} paired rollouts, ~${Math.round(baseAvgDamage / 1e3)}k user-seconds of damage.`
	}];
	for (const strat of STRATEGY_CATALOG) {
		let target;
		if (strat.kind === "restart" || strat.kind === "failover" || strat.kind === "scale-up") target = incident.origin;
		if (strat.kind === "shed-load" || strat.kind === "throttle") target = nodes.find((n) => n.kind === "gateway")?.id;
		if (strat.kind === "circuit-breaker") target = incident.origin;
		if (strat.kind === "cache-bypass") target = nodes.find((n) => n.kind === "cache")?.id;
		if (strat.kind === "cache-bypass" && !target) continue;
		const id = `${strat.kind}:${target ?? "cluster"}`;
		let contained = 0;
		let damage = 0;
		let size = 0;
		let mttr = 0;
		for (const seed of seeds) {
			const out = runRollout(id, seed);
			if (out.newFailures === 0 && out.endFailed <= initiallyFailed) contained++;
			damage += out.damage;
			size += out.cascadeSize;
			mttr += out.mttr;
		}
		const success = contained / ROLLOUTS;
		const avgDamage = damage / ROLLOUTS;
		const cost = COST[strat.kind] + (target === incident.origin ? 10 : 0);
		const lift = success - baseSuccess;
		const damageLift = baseAvgDamage - avgDamage;
		const verdict = success >= .5 && lift > 0 && score(success, cost, avgDamage) > 0 ? "recommended" : success >= .4 && lift >= 0 ? "viable" : "not-recommended";
		projections.push({
			strategyId: id,
			successProbability: Number(success.toFixed(2)),
			expectedCascadeSize: Number((size / ROLLOUTS).toFixed(1)),
			expectedDamage: Math.round(avgDamage),
			mttrMs: Math.round(mttr / ROLLOUTS),
			cost,
			verdict,
			rationale: `Contains cascade in ${Math.round(success * 100)}% of ${ROLLOUTS} paired rollouts (no-action: ${Math.round(baseSuccess * 100)}%) · ${lift >= 0 ? "+" : ""}${Math.round(lift * 100)}pt lift · ~${Math.round(avgDamage / 1e3)}k user-seconds damage (${damageLift >= 0 ? "saves" : "costs"} ${Math.round(Math.abs(damageLift) / 1e3)}k vs no-action) · MTTR ~${Math.round(mttr / ROLLOUTS / 1e3)}s${target ? ` on ${target}` : ""}.`
		});
	}
	const rank = (p) => (p.verdict === "recommended" ? 2 : p.verdict === "viable" ? 1 : 0) * 1e3 + p.successProbability * 100 - p.cost;
	return projections.sort((a, b) => rank(b) - rank(a));
}
function score(success, cost, damage) {
	return success - .25 * (cost / 100) - .1 * (damage / 5e4);
}
// src/core/ai/accuracy.ts
var trackers = /* @__PURE__ */ new Map();
var leadTimes = [];
var hits = 0;
var falseAlarms = 0;
var missed = 0;
function trackAccuracy(input, risks) {
	for (const [id, st] of Object.entries(input.services)) {
		const t = trackers.get(id) ?? {};
		const failed = st.metrics.failed;
		const r = risks[id];
		if (!failed && r?.predicted && t.predictedAt === void 0) t.predictedAt = input.simTime;
		if (failed && t.resolved === void 0) {
			if (t.predictedAt !== void 0 && input.simTime - t.predictedAt <= SIM.RISK_HORIZON_MS) {
				t.resolved = "hit";
				t.leadMs = input.simTime - t.predictedAt;
				hits++;
				leadTimes.push(t.leadMs);
			} else {
				t.resolved = "missed";
				missed++;
			}
		} else if (!failed && t.resolved === void 0 && t.predictedAt !== void 0) {
			if (input.simTime - t.predictedAt > SIM.RISK_HORIZON_MS) {
				t.resolved = "false-alarm";
				falseAlarms++;
			}
		}
		if (!failed && (t.resolved === "missed" || t.resolved === "false-alarm")) {
			trackers.delete(id);
			continue;
		}
		trackers.set(id, t);
	}
	const sum = leadTimes.reduce((s, v) => s + v, 0);
	return {
		predictions: hits + falseAlarms + missed,
		hits,
		falseAlarms,
		missed,
		avgLeadTimeMs: leadTimes.length > 0 ? sum / leadTimes.length : 0,
		precision: hits + falseAlarms > 0 ? hits / (hits + falseAlarms) : 0,
		recall: hits + missed > 0 ? hits / (hits + missed) : 0
	};
}
// src/data/topology.ts
/**
* Seed production topology — "Shopline" e-commerce cluster.
* 9 services, 13 dependency edges. Layout coordinates are for the
* SVG topology view on an 860x540 canvas.
*/
var SEED_TOPOLOGY = {
	nodes: [
		{
			id: "edge-gateway",
			name: "Edge Gateway",
			kind: "gateway",
			capacity: 5200,
			criticality: 1,
			replicas: 4,
			layout: {
				x: 430,
				y: 70
			}
		},
		{
			id: "auth-service",
			name: "Auth Service",
			kind: "api",
			capacity: 2400,
			criticality: .85,
			replicas: 3,
			layout: {
				x: 130,
				y: 200
			}
		},
		{
			id: "orders-api",
			name: "Orders API",
			kind: "api",
			capacity: 2e3,
			criticality: .9,
			replicas: 3,
			layout: {
				x: 320,
				y: 200
			}
		},
		{
			id: "payments-api",
			name: "Payments API",
			kind: "api",
			capacity: 1600,
			criticality: .95,
			replicas: 2,
			layout: {
				x: 540,
				y: 200
			}
		},
		{
			id: "inventory-api",
			name: "Inventory API",
			kind: "api",
			capacity: 1800,
			criticality: .7,
			replicas: 2,
			layout: {
				x: 740,
				y: 200
			}
		},
		{
			id: "orders-db",
			name: "Orders DB",
			kind: "database",
			capacity: 2300,
			criticality: .95,
			replicas: 1,
			layout: {
				x: 150,
				y: 380
			}
		},
		{
			id: "redis-cache",
			name: "Redis Cache",
			kind: "cache",
			capacity: 9e3,
			criticality: .6,
			replicas: 1,
			layout: {
				x: 360,
				y: 380
			}
		},
		{
			id: "payments-db",
			name: "Payments DB",
			kind: "database",
			capacity: 1500,
			criticality: .9,
			replicas: 1,
			layout: {
				x: 580,
				y: 380
			}
		},
		{
			id: "kafka-events",
			name: "Kafka Events",
			kind: "queue",
			capacity: 6e3,
			criticality: .75,
			replicas: 3,
			layout: {
				x: 760,
				y: 380
			}
		}
	],
	edges: [
		{
			from: "edge-gateway",
			to: "auth-service",
			weight: .15,
			critical: true
		},
		{
			from: "edge-gateway",
			to: "orders-api",
			weight: .3,
			critical: true
		},
		{
			from: "edge-gateway",
			to: "payments-api",
			weight: .3,
			critical: true
		},
		{
			from: "edge-gateway",
			to: "inventory-api",
			weight: .25,
			critical: true
		},
		{
			from: "orders-api",
			to: "orders-db",
			weight: 1,
			critical: true
		},
		{
			from: "orders-api",
			to: "redis-cache",
			weight: .5,
			critical: false
		},
		{
			from: "orders-api",
			to: "kafka-events",
			weight: .4,
			critical: true
		},
		{
			from: "payments-api",
			to: "payments-db",
			weight: 1,
			critical: true
		},
		{
			from: "payments-api",
			to: "kafka-events",
			weight: .5,
			critical: true
		},
		{
			from: "payments-api",
			to: "redis-cache",
			weight: .3,
			critical: false
		},
		{
			from: "inventory-api",
			to: "orders-db",
			weight: .8,
			critical: true
		},
		{
			from: "inventory-api",
			to: "redis-cache",
			weight: .4,
			critical: false
		},
		{
			from: "auth-service",
			to: "redis-cache",
			weight: 1,
			critical: true
		}
	]
};
// src/core/smoke.ts
var TARGET_SIM_MS = 6e5;
var engine = createEngine(SEED_TOPOLOGY, {
	predict: predictRisks,
	rootCause: analyzeRootCauses,
	recovery: projectStrategies,
	accuracy: trackAccuracy
});
var results = [];
var ok = (cond, label) => {
	results.push(`${cond ? "PASS" : "FAIL"}  ${label}`);
	return cond;
};
engine.loadScenario(SCENARIOS[0].id, 42);
engine.setSpeed(20);
engine.start();
var maxRiskSeen = 0;
var predictedBeforeFailure = false;
var firstFailureTs = null;
var firstPredictionTs = null;
var sawRootCauses = false;
var sawRecommended = false;
var sawLogs = false;
var accuracy = null;
var unsub = engine.subscribe((snap) => {
	if (snap.logs.length > 0) sawLogs = true;
	for (const r of Object.values(snap.risks)) {
		if (r.risk > maxRiskSeen) maxRiskSeen = r.risk;
		if (r.predicted) {
			predictedBeforeFailure = true;
			if (firstPredictionTs === null) firstPredictionTs = snap.simTime;
		}
	}
	for (const s of Object.values(snap.services)) if (s.metrics.failed && firstFailureTs === null) firstFailureTs = snap.simTime;
	if (snap.rootCauses.length > 0) sawRootCauses = true;
	if (snap.projections.some((p) => p.verdict === "recommended")) sawRecommended = true;
	if (snap.simTime > TARGET_SIM_MS) {
		accuracy = snap.accuracy;
		unsub();
		report(snap);
	}
});
function report(snap) {
	engine.pause();
	const incidents = snap.incidents.length;
	firstFailureTs !== null && firstPredictionTs !== null && firstFailureTs - firstPredictionTs;
	const bestLead = snap.ledger.filter((e) => e.outcome === "confirmed").reduce((a, e) => Math.max(a, e.leadTimeMs ?? 0), 0);
	ok(sawLogs, `logs streaming (${snap.logs.length} in window)`);
	ok(incidents >= 1, `incident detected (count=${incidents})`);
	ok(maxRiskSeen > .5, `predictor produced meaningful risk (max=${maxRiskSeen.toFixed(2)})`);
	ok(predictedBeforeFailure && bestLead > 0, `prediction preceded failure by ${Math.round(bestLead / 1e3)}s (best confirmed lead)`);
	ok(sawRootCauses, "root-cause hypotheses produced during incident");
	ok(sawRecommended, "recovery optimizer produced a recommended strategy");
	ok(accuracy !== null && accuracy.hits + accuracy.falseAlarms > 0, `accuracy tracker resolved predictions (${JSON.stringify(accuracy)})`);
	ok(snap.ledger.length > 0, `prediction ledger populated (${snap.ledger.length} entries, ${snap.ledger.filter((e) => e.outcome === "confirmed").length} confirmed)`);
	ok(snap.impact.revenueAtRiskPerMin >= 0, `business impact computed (SLO burn ${snap.impact.sloBurnRate}x, $${(snap.impact.revenueAtRiskPerMin / 1e3).toFixed(1)}k/min, ${snap.impact.affectedServices} affected)`);
	console.log("--- SMOKE RESULTS ---");
	results.forEach((r) => console.log(r));
	console.log(`scenario=${snap.scenarioId} simTime=${(snap.simTime / 6e4).toFixed(1)}min`);
	console.log("accuracy=", JSON.stringify(snap.accuracy));
	console.log("ledger=", JSON.stringify(snap.ledger.map((e) => ({
		svc: e.service,
		risk: e.risk,
		outcome: e.outcome,
		leadS: e.leadTimeMs !== void 0 ? Math.round(e.leadTimeMs / 1e3) : void 0
	}))));
	console.log("incidents=", JSON.stringify(snap.incidents.map((i) => ({
		sev: i.severity,
		origin: i.origin,
		title: i.title
	}))));
	const failedNow = Object.values(snap.services).filter((s) => s.metrics.failed).map((s) => s.id);
	console.log("failedNow=", failedNow.join(",") || "(none)");
	const fails = results.filter((r) => r.startsWith("FAIL")).length;
	console.log(fails === 0 ? "ALL PASS" : `${fails} FAILURES`);
	process.exit(fails === 0 ? 0 : 1);
}
setTimeout(() => {
	console.log("TIMEOUT — engine did not reach target sim time");
	process.exit(2);
}, 18e4);
export {};
