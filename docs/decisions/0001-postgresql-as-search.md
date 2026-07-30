# ADR 0001 — PostgreSQL as search engine

## Status

Accepted

## Context

We need full-corpus indexed retrieval over hundreds of thousands to millions of word marks without introducing Elasticsearch in v1.

## Decision

Use PostgreSQL with `pg_trgm`, B-tree, and GIN indexes for all retrieval channels. Add an external search engine only if measured PG limits block recall or latency targets.

## Consequences

- Retrieval SQL is first-class and tested with Testcontainers
- Index size and EXPLAIN ANALYZE must be documented
- No Elasticsearch/OpenSearch dependency in the prototype
