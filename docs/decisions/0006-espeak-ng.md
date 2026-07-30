# ADR 0006 — eSpeak NG phonetic sidecar

## Status

Accepted

## Context

Tier A languages need deterministic phoneme/IPA generation. eSpeak NG is GPL-3.

## Decision

Run eSpeak NG in Docker as a local process/HTTP sidecar. Pin image digest and flags. Never link GPL code into the Node app. Sanitize input; no shell interpolation; timeouts required.

## Consequences

- Phonetics for Tier A depend on Docker in full environments
- Tests may stub the sidecar; contract tests against the real service in CI when Docker is available
