# ADR 0001 — Nuxt 4 monolith (frontend + API in one app)

- Status: accepted · 2026-11-20

## Context
Single developer with little and irregular time. The app is a PWA with a small REST API (CRUD, uploads, importer).

## Decision
One Nuxt 4 application: Vue 3 frontend and Nitro server routes (`server/api`) in the same codebase, built into a single Docker image.

## Consequences
- One language (TypeScript), one build, one deploy, shared zod schemas between client and server.
- No separate backend to scale independently — irrelevant at this size.
