# Finance Architecture Decision Records (ADRs)

This folder holds every Architecture Decision Record for the Finance domain, per the Architecture Freeze declared in `docs/finance-design/06_FINANCE_EVENT_CONTRACT.md`.

## When to write one

Write an ADR **before** making the change, not after, when the change:

- Alters a frozen Service Contract's public method signature, inputs, outputs, or error behavior (`docs/finance-design/04_SERVICE_CONTRACTS.md`).
- Alters a frozen Finance Event's payload shape, trigger condition, or removes/renames an event (`docs/finance-design/06_FINANCE_EVENT_CONTRACT.md`).
- Changes Firestore collection ownership, security-rule predicates, or the tenant-isolation approach for any Finance collection (`docs/finance-design/02_DOMAIN_ARCHITECTURE.md` Parts 6–7).
- Introduces new infrastructure (a message broker, a new background-job mechanism, a new external integration) rather than extending what already exists.
- Reverses or materially revises a decision already recorded in an earlier ADR.

You do **not** need an ADR for: adding a new method to an existing service (additive), adding a new event (additive), adding a new Firestore collection that doesn't change how existing ones are owned/secured, or ordinary bug fixes that don't change a documented contract.

## Numbering and format

Sequential, zero-padded, four digits: `0001-short-kebab-title.md`, `0002-...`, etc. Never reuse or renumber — a superseded ADR stays in the folder with its status updated to `Superseded by ADR-00NN`, it is never deleted or renumbered.

Use `TEMPLATE.md` as the starting point for every new ADR.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-freeze-finance-foundation-architecture.md) | Freeze Finance Foundation Architecture | Accepted |
