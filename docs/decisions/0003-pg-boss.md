# ADR 0003 — pg-boss for jobs

## Status

Accepted

## Context

Preprocessing and scan execution need durable background jobs. Redis adds operational complexity for v1.

## Decision

Use pg-boss backed by the same PostgreSQL instance for preprocessing, reprocessing, scan execution, bridge runs, benchmarks, and cleanup.

## Consequences

- Additional PG load under job pressure
- No Redis in the prototype
