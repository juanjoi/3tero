# ADR 0003 — No authentication in the first versions

- Status: accepted · 2026-11-20

## Context
Family use at home; remote access only through VPN; publishing handled by an existing reverse proxy.

## Decision
No login, no users. Access control is delegated to the network (LAN/VPN) and the proxy.

## Consequences
- Simpler app and UX. Soft delete + backups protect against accidental deletions.
- Code keeps request handling in a way that a session/user can be added later (e.g. `nuxt-auth-utils`) without restructuring: a single server middleware where auth would plug in.
