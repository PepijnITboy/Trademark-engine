# ADR 0002 — Drizzle plus raw SQL

## Status

Accepted

## Context

ORM abstractions often hide or prevent efficient retrieval queries (`pg_trgm` operators, GIN array containment, custom ranking).

## Decision

Use Drizzle for schema types and migrations. Write critical retrieval queries as parameterized raw SQL with integration tests and EXPLAIN fixtures.

## Consequences

- Clear SQL files/modules for each strategy
- ORM not allowed to constrain retrieval design
