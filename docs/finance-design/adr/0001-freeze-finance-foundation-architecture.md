# ADR-0001: Freeze Finance Platform Architecture

**Status:** Accepted
**Date:** 2026-07-21
**Deciders:** Product/Engineering (user-approved via the Finance Platform Review milestone)

## Context

Over a single, continuous design-and-build effort, the Finance domain accumulated a full stack of architectural artifacts: a Product Vision (`KUE_BOXS_FINANCE_PRD.md`), Business Rules for Admission & Enrollment (`docs/finance-design/01_ADMISSION_ENROLLMENT_ENGINE.md`), a full Domain Architecture including API/Firestore/Security/Performance/Migration design (`docs/finance-design/02_DOMAIN_ARCHITECTURE.md`), a working Sprint 1 implementation (Student Ledger, Ledger Entry, Billing Plan, Family Account extension, Finance Settings — commit `4d3c6d7`), a Sprint 1 review pass adding domain events and an Admission Integration sprint (commit `0bc26f8`), five frozen Service Contracts (`docs/finance-design/04_SERVICE_CONTRACTS.md`, commit `7466229`), and now a complete Event Contract (`docs/finance-design/06_FINANCE_EVENT_CONTRACT.md`).

Without a formal checkpoint, continued fast iteration risks architectural drift: a future change could quietly reshape a service's contract or an event's payload without anyone recording *why*, making the five frozen contracts untrustworthy exactly when future modules (Billing Automation, Collections, Parent Portal, Reports, Notifications, AI Finance) most need to rely on them without re-reading source.

## Decision

We freeze the Finance Platform architecture as of this milestone. From this point forward:

1. No change to a frozen Service Contract's public method signature, inputs, outputs, or error behavior, and no change to a frozen Event's payload shape or trigger condition, may be made without an ADR recorded first, in this folder.
2. New Finance functionality must extend the existing contracts (a new method, a new event, a new collection) rather than modify what's already frozen — the same "extends vs. new" discipline already used throughout the Domain Architecture and Service Contracts.
3. Any genuinely breaking contract change must be versioned (per the Event Contract's Versioning Policy) and documented through its own ADR, superseding but never silently deleting the original decision.

This ADR is itself the first entry in the folder, both recording the freeze and demonstrating the format for every ADR after it.

## Consequences

- **Easier**: future Finance modules (Billing Automation, Collections, Parent Portal, Reports, AI Finance) can be built directly against the five Service Contracts and the Event Contract with confidence that the interface won't shift under them without a recorded, deliberate decision.
- **Harder**: a genuinely necessary contract change now has real process overhead (write the ADR first) — this is an intentional trade-off, accepted in exchange for architectural trustworthiness as the platform scales toward "thousands of preschools."
- **No migration or version bump required by this ADR itself** — it changes governance process, not any existing contract's shape.
- **Follow-up**: none outstanding: `06_FINANCE_EVENT_CONTRACT.md` already names this ADR and the governance rules it establishes; this ADR's own index entry is already reflected in `adr/README.md`.

## Alternatives Considered

- **No formal freeze, rely on documentation discipline alone.** Rejected — the whole point of the Service/Event Contracts is that future developers can trust them *without* re-reading source or trusting informal convention; an unenforced "please don't change this casually" norm has already proven insufficient elsewhere in this codebase (e.g. the platform's own `isFinance()`/`permissionsBackend.js` role-grant mismatch, which drifted apart silently over time with no ADR-equivalent catching it).
- **Freeze only the Event Contract, leave Service Contracts open.** Rejected — Ledger Entry's contract explicitly states the Student Ledger's balance invariant depends on it; treating one as frozen and the other as casually mutable would make the "frozen" label meaningless for either.
