# Proposed architecture

## Stack
React + strict TypeScript + Vite, Three.js via React Three Fiber, Zustand for shared state, Tailwind CSS, Vitest; Plotly.js for plots when needed. Start browser-only. Later use Python with NumPy/SciPy/AeroSandbox and FastAPI for advanced computation, potentially hosted on Railway/Render, while Vercel serves the frontend. GitHub for version control. Verify current library compatibility before installation.

## Suggested source layout (not yet implemented)
```
src/
  app/
  components/
  state/
  domain/          # AircraftDesign, units, model/result types
  engineering/
    geometry/
    atmosphere/
    aerodynamics/
    structures/
    propulsion/
    stability/
    performance/
    optimization/
  rendering/
  tests/
```

## Contracts
Architect must define one typed AircraftDesign schema: mission, mass, wing, fuselage, horizontal tail, vertical tail, flight condition and optional future model inputs. Use explicit names/units, validation and sensible bounds. Keep geometry definition independent of rendered mesh. Engineering functions should be pure where practical and return typed results with assumptions, model identifier and validity warnings. Missing parameters should not silently become invented constants. Use a consistent coordinate convention (proposed x aft, y starboard, z up for geometry, with explicit transforms for any flight-dynamics convention); architect must document it before implementation. Store SI and radians internally or explicitly document any alternative. Do not mix mass and weight. Shared state is the single source of truth for 3D and metrics.

M4.3 establishes the first versioned contract: `AircraftDesign` schema version 1 and an incrementing in-memory revision. Constraint-analysis results include schema/model versions, design revision, validity, assumptions, warnings, and sources. This is sufficient for traceable in-session analysis; serialized project envelopes, migrations, and conversion of older analysis result types remain future work.

M4.4 reuses that contract for preliminary sizing results and adds convergence metadata through a complete iteration history. The selected W/S and installed shaft P/W point is shared as transient workflow state, while sizing assumptions and results remain separate from `AircraftDesign`; no sizing result mutates geometry or authoritative mass until a future explicit apply workflow is approved.

M4.6 adds a pure provisional-candidate boundary. It copies the current design and replaces only sizing-produced wing planform values, takeoff mass, installed shaft power, payload and storage mass for rendering. Candidate state lives locally in the sizing workspace; the renderer accepts the isolated design as an override and the Zustand store exposes no candidate-apply action. A deterministic fingerprint binds the candidate to the design revision, mission, sizing outputs, propulsion branch and planform inputs so changed sources are shown as stale.

## Milestone 1 acceptance
- Local app opens; parameter edits visibly update mathematically generated geometry.
- Orbit/pan/zoom and standard orthographic views work.
- Wing, fuselage and tail dimensions editable; NACA 4-digit geometry generated and correctly scaled.
- Wing area, AR, MAC, tip chord, wing loading and conditional stall-speed estimate computed from shared inputs.
- Invalid inputs rejected or explicitly flagged; unfinished modules clearly labeled.
- Automated independent tests pass, production build passes, instructions reproduce local run.
