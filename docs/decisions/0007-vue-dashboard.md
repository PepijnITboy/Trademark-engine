# ADR 0007 — Vue 3 dashboard

## Status

Accepted

## Context

The engine is the product; UI is secondary. We need a thin internal dashboard for corpus stats, scans, and technical evidence.

## Decision

Vue 3 + Vite + TypeScript + Vue Router + TanStack Query + Playwright. No heavy design system. Pinia only if truly needed.

## Consequences

- Fast to scaffold; E2E smoke covers scan happy path
