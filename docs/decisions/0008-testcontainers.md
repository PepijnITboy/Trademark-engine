# ADR 0008 — Testcontainers for PostgreSQL

## Status

Accepted

## Context

Retrieval and migrations require real `pg_trgm` and GIN behavior. SQLite is not an acceptable substitute.

## Decision

Use Testcontainers (PostgreSQL) for database integration, migration, and retrieval tests. CI must provide Docker.

## Consequences

- Slightly slower tests; higher confidence on index/query behavior
