# Kitchen Designer MVP — Build Spec

## Goal

Build a web app where a user uploads a kitchen blueprint, answers a guided set of questions about their needs, and receives a 2D top-down kitchen layout rendered on Canvas that they can refine manually.

This is an MVP. Bias toward shipping the smallest thing that proves the loop works end-to-end. Avoid premature abstraction. No auth, no multi-tenant, no payments — single-user, local-first feel.

---

## In Scope (MVP)

1. Project creation with a name.
2. Upload a blueprint image (PNG/JPG/PDF first page) as a reference background.
3. Manual wall tracing on top of the uploaded image with Canvas (click-to-place wall segments).
4. Setting scale via one reference measurement (user clicks two points and types the real-world distance).
5. Marking fixed points: water inlet, drain, gas inlet, electrical outlets, doors (with swing direction), windows.
6. AI-driven Q&A flow that gathers preferences (style, cooking habits, storage, appliance choices, budget tier, accessibility).
7. Layout generation: LLM proposes a placement of standard kitchen modules; deterministic validator checks constraints; result is rendered.
8. Manual refinement: drag, rotate, swap, and delete components on the canvas.
9. Export: download a PNG of the final layout and a JSON snapshot of the project.

## Out of Scope (do not build)

- 3D rendering of any kind.
- Automatic blueprint parsing from PDF/DWG/DXF (computer vision wall detection).
- User accounts, login, multi-user collaboration.
- Cost estimation, bill of materials, supplier integration.
- Material/finish selection beyond a small palette of colors.
- Mobile-optimized layouts (desktop-first, responsive only as a nicety).
- Multiple competing layout suggestions per generation (one is enough for MVP).
- Undo/redo history beyond a simple in-session stack (optional).
- Internationalization (English only, metric units only).

---

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite.
- **Canvas:** [Konva.js](https://konvajs.org/) via `react-konva`. Strong React integration, handles drag/snap/rotation cleanly.
- **State:** Zustand for global project state. Keep it boring.
- **Backend:** Node.js + TypeScript using [Hono](https://hono.dev/). Single process. SQLite via `better-sqlite3` for project persistence. Local filesystem for blueprint images.
- **LLM:** Vercel AI SDK (`ai`) wrapping a provider chosen at runtime via `LLM_PROVIDER`. Default is **Google Gemini 2.5 Flash** (`@ai-sdk/google`, free tier via Google AI Studio); fallback is **Claude Sonnet 4.5** (`@ai-sdk/anthropic`). Use tool/function calling for structured output. Never call the LLM from the browser — always proxy through the backend. See [ADR-006](./decisions/ADR-006-provider-agnostic-llm-via-ai-sdk.md).
- **Styling:** Tailwind CSS.
- **Package manager:** pnpm.
- **Monorepo layout:** A single repo with `apps/web` and `apps/api`, plus `packages/shared` for types and constants shared between them. Use pnpm workspaces.

---

## High-Level Architecture

```
apps/web (Vite + React)
  ├── Project list + create
  ├── Blueprint editor (Konva canvas + tools)
  ├── Q&A wizard (chat-like UI driven by backend)
  └── Layout view (Konva canvas with placed modules)

apps/api (Hono + Node)
  ├── /projects        CRUD on projects
  ├── /projects/:id/blueprint     image upload
  ├── /projects/:id/qa            stream Q&A turns
  └── /projects/:id/layout        trigger layout generation

packages/shared
  ├── types: Project, Wall, FixedPoint, Module, Preferences, Layout
  └── constants: STANDARD_MODULES, CLEARANCES, WORK_TRIANGLE_LIMITS
```

State of truth lives in the backend (SQLite + filesystem). Frontend keeps a synced copy in Zustand and persists to backend on meaningful transitions (not on every drag tick).

---

## Data Model

All units in millimeters. All coordinates in the room's local frame: origin at top-left of the bounding box of the traced walls, +x right, +y down. Match Konva's screen coordinates so there is no conversion confusion.

```ts
type Project = {
  id: string;
  name: string;
  createdAt: string;
  blueprint: { filename: string; widthPx: number; heightPx: number } | null;
  scale: { pxPerMm: number } | null;          // set after user gives a reference measurement
  walls: Wall[];
  fixedPoints: FixedPoint[];
  preferences: Preferences | null;             // populated by Q&A
  layout: Layout | null;                       // populated by generation
};

type Wall = {
  id: string;
  start: { x: number; y: number };             // mm
  end: { x: number; y: number };               // mm
  thickness: number;                            // mm, default 100
};

type FixedPoint = {
  id: string;
  kind: "water" | "drain" | "gas" | "electric" | "door" | "window";
  position: { x: number; y: number };           // mm
  // door/window only:
  width?: number;                               // mm
  swing?: "left" | "right" | "none";            // for doors
};

type Preferences = {
  style: "modern" | "classic" | "rustic" | "minimal" | "industrial";
  budgetTier: "low" | "mid" | "high";
  cookingFrequency: "rare" | "weekly" | "daily" | "intense";
  hobType: "induction" | "gas" | "ceramic";
  ovenType: "single" | "double" | "combi" | "none";
  fridgeSize: "compact" | "standard" | "american";
  dishwasher: boolean;
  islandPreferred: boolean;
  seatingAtIsland: number;                      // 0 if no island or no seating
  storagePriority: "low" | "medium" | "high";
  accessibility: string[];                       // free-form tags, e.g. "wheelchair", "low-shelves"
  notes: string;                                // free text from user
};

type ModuleKind =
  | "base_cabinet" | "wall_cabinet" | "tall_cabinet"
  | "sink_unit" | "hob_unit" | "oven_tower"
  | "fridge" | "dishwasher" | "island";

type Module = {
  id: string;
  kind: ModuleKind;
  position: { x: number; y: number };           // mm, top-left of footprint
  rotation: 0 | 90 | 180 | 270;                 // degrees
  width: number;                                // mm (along x before rotation)
  depth: number;                                // mm (along y before rotation)
  height: number;                               // mm (informational)
  label?: string;                               // e.g. "60cm base, 2 drawers"
};

type Layout = {
  modules: Module[];
  generatedAt: string;
  rationale: string;                            // LLM-provided summary of why this layout
};
```

Persist `Project` as a single JSON blob per project in SQLite (`projects` table: `id, name, created_at, data_json`). Premature normalization is not your friend here.

---

## Standard Module Library

Use European 60 cm modular system. Define as constants in `packages/shared`:

```ts
export const STANDARD_MODULES = {
  base_cabinet:   { widths: [400, 500, 600, 800, 1000, 1200], depth: 600, height: 850 },
  wall_cabinet:   { widths: [400, 500, 600, 800, 1000],       depth: 350, height: 720 },
  tall_cabinet:   { widths: [600],                            depth: 600, height: 2100 },
  sink_unit:      { widths: [600, 800, 1000],                 depth: 600, height: 850 },
  hob_unit:       { widths: [600, 800, 900],                  depth: 600, height: 850 },
  oven_tower:     { widths: [600],                            depth: 600, height: 2100 },
  fridge:         { widths: [600, 700, 900],                  depth: 650, height: 1850 },
  dishwasher:     { widths: [450, 600],                       depth: 600, height: 850 },
  island:         { widths: [1200, 1500, 1800, 2400],         depth: 900, height: 900 },
};

export const CLEARANCES = {
  walkway: 900,                  // mm minimum free space between opposing surfaces
  doorSwing: 800,                // mm clear arc in front of door
  applianceFront: 1100,          // mm in front of fridge/oven/dishwasher when open
};

export const WORK_TRIANGLE = {
  minLegMm: 1200,
  maxLegMm: 2700,
  maxPerimeterMm: 7900,
};
```

These numbers are the source of truth for both the validator and the LLM (pass them in the system prompt).

---

## User Flow

1. **Project list** → user creates a new project, types a name, lands on the editor.
2. **Blueprint editor**
   - Step A: upload image, it renders as a faded background layer in Konva.
   - Step B: trace walls — click to place vertices, double-click to close a polyline. Walls snap to 5° angles by default, hold Shift to free-rotate.
   - Step C: set scale — click two points on the image, enter the real-world distance in mm or m. App computes `pxPerMm`.
   - Step D: mark fixed points — toolbar with water/drain/gas/electric/door/window. Click to drop, drag to refine.
3. **Q&A wizard** — chat-style UI. Backend streams one question at a time. User answers via free text or quick-pick chips. Wizard ends when the schema is filled.
4. **Layout generation** — single button "Generate layout". Spinner. Result populates the canvas with placed modules and a short rationale summary above the canvas.
5. **Refinement** — user drags modules, rotates with R key, deletes with Del, swaps via right-click menu (swap to a different width within the same kind).
6. **Export** — download PNG (Konva `toDataURL`) and JSON (the full `Project`).

---

## LLM Integration

### Q&A turn endpoint

`POST /projects/:id/qa/next`

- Request body: current `Preferences` partial + last user message (if any).
- Backend constructs a system prompt that includes the partial preferences and the schema of what is still missing.
- LLM is instructed to respond with a tool call: either `ask_question(text, quickPicks?)` or `finalize(preferences)`.
- Backend persists the updated `Preferences` and returns the next question (or signals completion).

Prompt rules:
- One question at a time.
- Prefer concrete questions tied to the user's earlier answers (e.g. if they said "daily intense cooking", probe induction vs gas).
- Never ask about anything already in the partial preferences.
- Cap at ~10 questions; finalize early when confident.

### Layout generation endpoint

`POST /projects/:id/layout/generate`

Backend builds a prompt containing:
- The room geometry (walls as polylines, computed bounding box, computed wall segments available for cabinetry).
- All fixed points with their positions.
- The user's preferences.
- The standard module library and clearance constants.
- A worked example of the expected JSON output.

LLM is instructed to call a single tool `propose_layout(modules: Module[], rationale: string)`.

Backend then runs the **validator** (see below). If validation fails, backend sends the violations back to the LLM with a tool result and asks it to repair. Cap at 3 repair iterations. If still invalid after that, return the best-effort layout with a warning surfaced in the UI.

---

## Layout Validator (deterministic)

A pure TS module in `packages/shared`. Inputs: walls, fixed points, modules. Outputs: `{ ok: boolean; violations: Violation[] }`.

Checks, in order:

1. **Containment** — every module footprint lies inside the wall polygon.
2. **No overlap** — module footprints don't overlap each other.
3. **Wall adjacency** — every base/wall/tall cabinet has its back against a wall (within 50 mm) — except the island.
4. **Fixed-point alignment** — sink unit is within 600 mm of water+drain. Hob unit is within 600 mm of gas (if hob is gas) or an electric point (if induction/ceramic). Fridge and dishwasher each within 600 mm of an electric point.
5. **Door swing clear** — no module footprint inside any door's swing arc.
6. **Walkway clearance** — every parallel run of cabinetry has ≥ `CLEARANCES.walkway` mm of clear floor space in front of it.
7. **Work triangle** — distances between sink, hob, fridge centers satisfy `WORK_TRIANGLE`.
8. **Appliance front clearance** — `CLEARANCES.applianceFront` mm in front of fridge, oven, dishwasher.

Each violation includes a human-readable message and references to module ids, so the LLM repair step has actionable feedback.

---

## Canvas Implementation Notes

- One Konva `Stage` with three layers: background (blueprint image), structure (walls, fixed points), modules.
- Wall segments are `Line` shapes with hit-stroke width of 20 px for easy selection.
- Modules are `Group`s containing a colored `Rect` and a `Text` label. Color by `kind` (consistent palette).
- Drag-snap: snap module edges to wall edges (within 30 mm) and to other modules (within 10 mm).
- Rotation: only 90° increments via `R` key. No free rotation in MVP.
- Coordinate system: store everything in mm; compute pixel coordinates via `pxPerMm` at render time. Don't store px coordinates anywhere.

---

## Acceptance Criteria

The MVP is done when, in a single session, a user can:

1. Create a project, upload an image of a real kitchen blueprint, and see it as a background.
2. Trace at least 4 wall segments forming a closed polygon.
3. Set scale and have all subsequent measurements display in mm/m correctly.
4. Place at least one of each fixed-point type.
5. Complete a Q&A flow in ≤ 10 questions and see the resulting `Preferences` JSON.
6. Click "Generate" and receive a layout that passes all validator checks for a simple rectangular room.
7. Drag a module and have it snap to wall edges.
8. Rotate, swap, and delete modules.
9. Export a PNG and a JSON snapshot.
10. Reload the page and see the project restored from the backend.

---

## Implementation Phases

Suggested order. Each phase ends with something demoable.

**Phase 1 — Skeleton (1–2 days)**
- Monorepo, both apps booting, SQLite up, types in shared, project create/list/delete working end-to-end.

**Phase 2 — Blueprint editor (3–5 days)**
- Image upload, Konva canvas, wall tracing, scale setting, fixed-point placement, persistence.

**Phase 3 — Q&A (1–2 days)**
- Backend endpoint via the Vercel AI SDK (provider-agnostic, default Gemini) with tool calling, frontend chat UI, preferences persisted.

**Phase 4 — Layout generation v1 (3–5 days)**
- Validator first (pure TS, well-tested). Then generation endpoint, repair loop, render result on canvas.

**Phase 5 — Refinement & export (1–2 days)**
- Drag/rotate/swap/delete, snap helpers, PNG and JSON export.

**Phase 6 — Polish (open-ended)**
- Loading states, error toasts, empty states, keyboard shortcuts panel, validator warnings surfaced in UI.

Total realistic estimate: ~3 focused weeks for a working MVP.

---

## Notes for the Implementing Agent

- Do not over-engineer. No DDD, no clean architecture layers, no event sourcing. Plain modules and functions.
- Prefer small files, named exports, no default exports.
- Tests where they pay off: the validator (unit tests with hand-crafted layouts) and the scale/coordinate math. Skip tests for UI glue.
- Use Zod to validate every LLM tool call response before trusting it.
- Stream LLM responses where the UX benefits (Q&A questions). The layout generation can be a single non-streamed call.
- Log every LLM request/response to a local file in dev mode. You will want this when prompts misbehave.
- When in doubt, hardcode a reasonable default and add a TODO. Do not add a settings screen.
