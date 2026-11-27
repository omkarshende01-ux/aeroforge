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

M5.1 advances `AircraftDesign` to schema version 2. `wing` is the sole authoritative wing geometry and contains a wing-model version, symmetry mode, vertical root position, ordered stations, and adjacent sections. A station stores signed span position, local chord, leading-edge `x`, geometric twist, and airfoil identifier. A section connects two named adjacent stations and stores local dihedral. Symmetric wings store only the `y >= 0` source half beginning at `y=0`; asymmetric wings store the complete ordered port-to-starboard chain and must include `y=0`. Render meshes, analytical properties, stability references, structures, aerodynamics, and metrics derive from this contract rather than maintaining parallel planforms.

The pure v1 migration converts the old scalar trapezoid to two symmetric stations without changing span, root/tip chord, leading-edge sweep, dihedral, tip twist, root placement, or airfoil. The existing simple inspector remains a compatibility view over schema v2 and applies validated whole-wing transforms to the same stations. It is not a second stored model. Persisted project envelopes and automatic load-time routing remain deferred because project persistence does not yet exist.

M5.1 geometry calculations are independent of the render tessellation. The geometry module expands symmetry, integrates piecewise-linear chord and leading-edge functions, and exposes physical stations and reference properties for future analysis discretization. The renderer consumes expanded stations only to produce the visual loft.

M5.2 adds an editing layer without adding a geometry representation. Pure station operations accept and return `WingGeometry`, rebuild adjacent sections where topology changes, and pass the result through the existing schema-v2 validator before the store may commit it. The store keeps bounded in-memory snapshots for wing-only undo, exposes station selection as transient UI state, increments the shared design revision on accepted geometry changes, and resets through the same validated commit path. Project persistence and durable command history remain deferred.

The dedicated wing workspace computes live feedback with the existing reference-property functions. Viewport station markers, dimensions, selection highlights, and the loft all consume expanded physical stations from the authoritative wing; these overlays are presentation state and do not become analysis inputs. Control surfaces, a separate VLM lattice, generalized tail stations, and persisted editor history remain future contracts.

M5.3 introduces a pure loft boundary between local airfoil geometry and rendering. The airfoil module produces normalized cosine-sampled NACA four-digit coordinates. The loft module validates and blends matching local coordinates, interpolates disposable render rings between physical schema-v2 stations, and transforms those points into aircraft coordinates about the station quarter-chord. The Three.js geometry module only triangulates the resulting rings and closes the two physical tips; it no longer owns the section transformation equations.

Engineering stations remain the only stored geometry. Render-only rings use a fixed visualization refinement and cannot affect projected span, area, aspect ratio, MAC, reference locations, sizing, or candidate generation. Cross-section curves, chord/leading-edge/quarter-chord guides, and twist labels call the same station transform as the mesh. They are transient visualization state, not a second geometry model or an aerodynamic lattice.

## Milestone 1 acceptance
- Local app opens; parameter edits visibly update mathematically generated geometry.
- Orbit/pan/zoom and standard orthographic views work.
- Wing, fuselage and tail dimensions editable; NACA 4-digit geometry generated and correctly scaled.
- Wing area, AR, MAC, tip chord, wing loading and conditional stall-speed estimate computed from shared inputs.
- Invalid inputs rejected or explicitly flagged; unfinished modules clearly labeled.
- Automated independent tests pass, production build passes, instructions reproduce local run.
