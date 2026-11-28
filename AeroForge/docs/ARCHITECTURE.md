# Proposed architecture

## M6.1 airfoil data boundary

The model-v1 airfoil library is versioned independently from aircraft schema v3. Aircraft lifting-surface stations continue to store stable airfoil identifiers. Pure resolvers map an identifier to either the deterministic NACA four-digit generator or a registered imported geometry, and the library is passed explicitly into render-loft, control-surface, and computational-mesh generation. This avoids global mutable registries and avoids a schema-v4 migration solely for source data.

Imported geometry stores normalized leading-edge-to-trailing-edge upper/lower surfaces plus raw source and provenance. Polar datasets reference an airfoil identifier but remain separate 2-D sectional records. Store operations enforce unique IDs, prevent removal of referenced profiles, and increment the aircraft design revision when a station selection changes, so retained computational meshes become stale through the existing revision contract.

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

M5.4 adds a separately versioned `ControlSurfaceModel` to `AircraftDesign` without changing the schema-v2 wing contract. Each definition stores identity, conventional type, parent lifting surface, root-measured span interval, trailing-edge chord fraction, hinge `x/c`, deflection bounds/current command, enabled state, operation mode, and physical side. Wing controls query the existing M5.3 section interpolation and transform functions. M5.5 replaces the temporary scalar-tail adapters while retaining the same control-surface contract.

Control-surface engineering remains pure and render-independent. Validation owns parent/type compatibility, bounds, side/operation combinations, overlaps, and the M5.4 restriction that a rigid wing control cannot cross a schema-v2 station break. Geometry samples the actual parent profile, forms a cosine-spaced trailing-edge skin, and rotates it with Rodrigues' formula around the straight three-dimensional endpoint hinge axis. The renderer triangulates only the returned vertices and displays the hinge/selection state. The undeflected aircraft stays authoritative, projected references remain unchanged, and no aerodynamic effectiveness or load is inferred. Zustand commits accepted control models atomically and rejects parent-geometry changes that would invalidate them.

M5.5 advances `AircraftDesign` to schema version 3 because fuselage and empennage field shapes change. The wing remains model version 2. The fuselage is component model version 1 with ordered longitudinal stations and no parallel scalar representation. Horizontal and vertical tails are component model version 1 and reuse `WingStation`/`WingSection` topology where applicable; conventional horizontal geometry is symmetric, while the vertical adapter maps the same local section model into height. Explicit schema-v1/v2 migrations build equivalent component station models.

Pure fuselage engineering owns validation, smooth interpolation, cross-section generation, closed mesh data, volume/centroid quadrature, and wetted-area discretization. Pure tail engineering owns validation, reference integration, placement transforms, loft rings, and tail volume coefficients. Three.js only triangulates returned geometry. Store history is component-local and bounded; accepted tail commits are checked against existing elevator/rudder definitions before mutation. M4.6 previews deep-copy every component station array and never become authoritative.

The M5.5 demonstrator refinement changes only `defaultDesign` station coordinates and renderer materials/lights. Wing/fuselage/tail attachment continuity is produced by overlapping the generated authoritative surfaces, not by adding fairing meshes. Smooth shading consumes computed vertex normals from the same loft topology; it does not introduce another geometry source.

M5.6 adds a separately versioned analysis-geometry contract without changing `AircraftDesign` schema version 3. A pure discretizer queries the authoritative wing and tail station samplers and produces thin NACA mean-camber panels; it never reads the closed render meshes or fuselage mesh. Each panel records semantic corners, area, normal, centroid, local chord/span axes, panel-local quarter-chord vortex endpoints, three-quarter-chord collocation point, trailing-edge state, and parent surface/section/control identifiers.

Engineering station boundaries and enabled control-surface span/hinge boundaries are inserted exactly into uniform or cosine grids. Results are deterministic in wing, horizontal-tail, vertical-tail order and are stored only as transient derived analysis state tied to the design revision. The workspace reports stale results after any authoritative design edit. Three.js consumes that result solely for wireframe, normal, collocation, and bound-vortex overlays; visualization cannot change the computational mesh. M5.6 deliberately supports neutral control geometry only and adds no wake, influence matrix, circulation, force, pressure, or aerodynamic result.

M5.7 independently verifies that schema-v3 station boundaries appear identically in the closed render loft and thin analysis lattice while retaining their intentionally separate surface definitions. The analysis contract is suitable input to a future neutral conventional horseshoe or vortex-ring solver: bound segments have a deterministic global increasing-span orientation, normals and frames are explicit, and trailing-edge panels are identified. Wake nodes/legs, neighbor and strip topology, circulation signs, solver frames, and force integration remain solver-owned contracts rather than geometry fields. Invalid selected parent geometry now short-circuits dependent control validation so mesh generation always returns structured diagnostics instead of throwing.

## Milestone 1 acceptance
- Local app opens; parameter edits visibly update mathematically generated geometry.
- Orbit/pan/zoom and standard orthographic views work.
- Wing, fuselage and tail dimensions editable; NACA 4-digit geometry generated and correctly scaled.
- Wing area, AR, MAC, tip chord, wing loading and conditional stall-speed estimate computed from shared inputs.
- Invalid inputs rejected or explicitly flagged; unfinished modules clearly labeled.
- Automated independent tests pass, production build passes, instructions reproduce local run.
