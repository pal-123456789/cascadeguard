import type { ServiceTopology } from '../core/types'

/**
 * Seed production topology — "Shopline" e-commerce cluster.
 * 9 services, 13 dependency edges. Layout coordinates are for the
 * SVG topology view on an 860x540 canvas.
 */
export const SEED_TOPOLOGY: ServiceTopology = {
  nodes: [
    { id: 'edge-gateway', name: 'Edge Gateway', kind: 'gateway', capacity: 5200, criticality: 1.0, replicas: 4, layout: { x: 430, y: 70 } },
    { id: 'auth-service', name: 'Auth Service', kind: 'api', capacity: 2400, criticality: 0.85, replicas: 3, layout: { x: 130, y: 200 } },
    { id: 'orders-api', name: 'Orders API', kind: 'api', capacity: 2000, criticality: 0.9, replicas: 3, layout: { x: 320, y: 200 } },
    { id: 'payments-api', name: 'Payments API', kind: 'api', capacity: 1600, criticality: 0.95, replicas: 2, layout: { x: 540, y: 200 } },
    { id: 'inventory-api', name: 'Inventory API', kind: 'api', capacity: 1800, criticality: 0.7, replicas: 2, layout: { x: 740, y: 200 } },
    { id: 'orders-db', name: 'Orders DB', kind: 'database', capacity: 900, criticality: 0.95, replicas: 1, layout: { x: 150, y: 380 } },
    { id: 'redis-cache', name: 'Redis Cache', kind: 'cache', capacity: 9000, criticality: 0.6, replicas: 1, layout: { x: 360, y: 380 } },
    { id: 'payments-db', name: 'Payments DB', kind: 'database', capacity: 700, criticality: 0.9, replicas: 1, layout: { x: 580, y: 380 } },
    { id: 'kafka-events', name: 'Kafka Events', kind: 'queue', capacity: 6000, criticality: 0.75, replicas: 3, layout: { x: 760, y: 380 } },
  ],
  edges: [
    { from: 'edge-gateway', to: 'auth-service', weight: 0.15, critical: true },
    { from: 'edge-gateway', to: 'orders-api', weight: 0.3, critical: true },
    { from: 'edge-gateway', to: 'payments-api', weight: 0.3, critical: true },
    { from: 'edge-gateway', to: 'inventory-api', weight: 0.25, critical: true },
    { from: 'orders-api', to: 'orders-db', weight: 1.0, critical: true },
    { from: 'orders-api', to: 'redis-cache', weight: 0.5, critical: false },
    { from: 'orders-api', to: 'kafka-events', weight: 0.4, critical: true },
    { from: 'payments-api', to: 'payments-db', weight: 1.0, critical: true },
    { from: 'payments-api', to: 'kafka-events', weight: 0.5, critical: true },
    { from: 'payments-api', to: 'redis-cache', weight: 0.3, critical: false },
    { from: 'inventory-api', to: 'orders-db', weight: 0.8, critical: true },
    { from: 'inventory-api', to: 'redis-cache', weight: 0.4, critical: false },
    { from: 'auth-service', to: 'redis-cache', weight: 1.0, critical: true },
  ],
}
