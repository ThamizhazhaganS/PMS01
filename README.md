# PulsePlatform

Client engagement and governance workspace for **Morphoverse** engagements with **Nova Industries**: one provable record of what was shared, what was agreed, what needs attention, and what changed.

> Stage 1 — interactive frontend on an in-memory server store. No database yet (PostgreSQL + Prisma is Stage 2).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Use the **Dev bar** at the top to switch between test users, open the simulated email **Outbox**, toggle light/dark, or reset the demo data.

Tier A approvals ask for a one-time code — in this dev build it is `123456`.

## Test users

| Role | Name | Lands on |
| --- | --- | --- |
| Administrator | John Carter | `/admin` — accounts only, no project content |
| Director (Owner) | Sarah Mitchell | `/w` — Morphoverse workspace |
| Team Member (publish right) | David Chen | `/w` |
| Executive Director | Alex Mercer | `/exec` — portfolio + Needs attention |
| Client Lead | Jordan Lee | `/portal` |
| Client Stakeholder (HR) | Priya Patel | `/portal` |
| *More:* Team Member, no publish right | Maya Rao | `/w` |
| *More:* Second Director | Rajiv Menon | `/w` (owns P3 and the Helix project) |
| *More:* Stakeholder (IT) | Arjun Nair | `/portal` |
| *More:* Other client org | Emma Brooks (Helix Retail) | `/portal` |

Seed projects: **P1** HR & IT Operating Model Redesign (Active), **P2** Procurement Cost Optimisation (Proposal), **P3** Plant Safety Digital Audit (Paused), **P4** Helix Store Network Expansion (other organisation).

## How access is enforced

All data lives on the server (`lib/store.ts`). Pages and server actions read only through `lib/data.ts`, which filters every collection with the pure rules in `lib/access/audience.ts` (5-tier audience: Draft, Team, Workstream, Named, Client-wide). Unauthorised and non-existent items both return 404. File downloads (`/api/files/[docId]`) re-check access on every request. The UI never acts as the control.

## Layout

```
app/(staff)/w/…         Morphoverse workspace (7 project tabs, meeting wizard, View As)
app/(client)/portal/…   Nova client portal (Home, Needs you, Overview, Journey, Documents, Decisions)
app/(exec)/exec/…       Executive Director portfolio + Needs attention
app/(admin)/admin/…     Administrator console + security log
lib/domain/             Types, derived values, formatting (IST / INR)
lib/access/             Audience + capability rules
lib/actions.ts          Server actions (validate → mutate → audit → notify)
lib/mock/seed.ts        Demo data (dates relative to today)
components/             shadcn/ui primitives + shared, staff, client, admin components
```
