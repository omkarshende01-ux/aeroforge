# AeroForge progress

## M6.1 checkpoint - 2026-11-27

M6.1, Airfoil Coordinate and Aerodynamic Polar Data Foundation, is complete on the `development` branch. AeroForge now has a separately versioned model-v1 airfoil library while retaining aircraft schema v3 and the existing NACA four-digit generator. Imported geometry and two-dimensional polar data remain source records; they do not alter aircraft-level aerodynamic coefficients automatically.

## M6.1 completed

- Added strongly typed v1 contracts for airfoil identity, normalized upper/lower coordinates, ordering, provenance, polar operating conditions, optional coefficients/transition/convergence metadata, moment reference/sign, generation method, applicability, and raw source retention. Unknown values remain explicitly unavailable.
- Added validated Selig DAT, Lednicer DAT, and documented CSV coordinate imports with chord normalization, leading/trailing-edge detection, surface separation, ordering and duplicate handling, and rejection of nonfinite, degenerate, crossing, or self-intersecting profiles. No smoothing or geometry repair is performed.
- Added documented CSV and XFOIL polar imports with exact Reynolds/Mach grouping, finite-value and condition checks, duplicate-point rejection, missing-coefficient preservation, negative-drag rejection, moment-reference validation, transition/convergence metadata, and explicit experimental/computational/user-supplied classification.
- Integrated imported profiles into the existing cosine-sampled wing, empennage, control-surface, render-loft, and thin analysis-mesh paths without replacing the NACA generator or changing projected reference calculations.
- Added an Airfoils workspace for coordinate/polar file import, validation messages, normalized profile preview, metadata and associated-dataset inspection, reference-safe removal, and imported-profile selection in wing and tail editors.
- Added 13 focused M6.1 tests with synthetic project-authored fixtures covering all supported formats, normalization, ordering, duplicate/invalid/degenerate inputs, missing values, multiple Reynolds datasets, identifier uniqueness, reference checks, imported loft/mesh compatibility, staleness, and NACA regression.
- No solver, interpolation, extrapolation, stall prediction, or automatic sectional-to-aircraft aerodynamic coupling was added. Format and convention details are in `docs/AIRFOIL_DATA.md`.
- Browser smoke passed Selig coordinate import, normalized profile preview, XFOIL polar import/metadata inspection, and imported wing-profile selection with live loft rendering and no validation alert.
- Verification passes: strict typecheck, 149 automated tests across 22 files, and production build. Vite's existing non-blocking main-chunk warning remains (`1,245.50 kB` minified / `341.60 kB` gzip).

## M5.7 checkpoint - 2026-11-27

The repository is on the `development` branch. M5.7, Independent Aircraft Geometry and Computational Mesh Verification, is complete. The complete schema-v3 conventional geometry path has now been independently benchmarked from parametric definitions through closed render lofts and thin computational panels. M5 is complete for its declared conventional, neutral-control geometry scope; no aerodynamic solver, wake, circulation, force, CFD, FEA, or new aircraft component was added.

## M5.7 completed

- Added a reproducible independent fixture and 12 focused tests covering rectangular, trapezoidal, multi-section, asymmetric, swept, dihedral, twisted, fuselage, empennage, control-surface, rendered-loft, migration, stale-mesh, and computational-panel cases. Expected values are constants or independently evaluated equations rather than calls to the production functions under test.
- Reproduced NASA NTRS 20220018375's documented rectangular OpenVSP wing dimensions. AeroForge exactly recovers the area implied by published span and chord; the maximum `0.06284%` comparison difference is the source's independently rounded quarter-chord location.
- Verified panel corners, independent two-triangle areas, centroids/references, unit normals, local directions, bound-vortex endpoints, collocation points, trailing edges, deterministic ordering, station/control boundaries, connected shared-edge topology, and vertical/horizontal orientation. Mirrored horizontal vortices consistently run port-to-starboard, so mirroring does not introduce a circulation-sign reversal.
- Verified render lofts and computational panels consume the same authoritative stations, while preserving the deliberate distinction between closed thickness render surfaces and thin mean-camber analysis surfaces.
- Added coarse/medium/fine geometric refinement evidence. Representative mean-surface area converges `17.690472 -> 17.699828 -> 17.701057 m²` while projected reference area remains exactly `17.5 m²`; cylinder wetted area and station-defined ellipsoid volume converge monotonically toward closed-form values.
- Maximum fine numerical error is `0.02856%` for cylinder wetted area; the fine ellipsoid volume error is `0.02219%`. Analytical planform/tail/panel cases agree to double-precision roundoff.
- Corrected one validation-order defect: invalid parent geometry with attached controls now returns structured `invalid-parent-geometry` mesh errors instead of throwing during dependent control validation. Valid geometry calculations and numerical results are unchanged.
- Audited future horseshoe/vortex-ring compatibility. Current contracts are sufficient for a neutral conventional first VLM, provided M7 defines circulation/wake signs, wake topology, adjacency/strip construction, and force/moment frames. Deflected lattices and unconventional configurations remain explicitly unsupported.
- Verification passes: strict typecheck, 136 automated tests across 21 files, and production build. Vite's existing non-blocking main-chunk warning remains (`1,220.13 kB` minified / `334.28 kB` gzip).

## M5.6 checkpoint - 2026-11-27

The repository is on the `development` branch. M5.6, Analysis-Ready Geometry Discretization, is complete. A versioned computational geometry layer now derives deterministic thin lifting-surface panels from the authoritative schema-v3 design without consuming or modifying visualization meshes. No VLM solve, wake, circulation, force, pressure, CFD, fuselage lattice, or structural FEA was added.

## M5.6 completed

- Added strongly typed model-v1 contracts for lifting surfaces, panel corners, centroids, collocation points, areas, normals, local frames, panel-local quarter-chord bound vortices, trailing-edge flags, parent surface/section/control identifiers, configuration, assumptions, and validation results.
- Added pure main-wing, horizontal-tail, and vertical-tail discretization over the existing station/profile transforms. Symmetric and asymmetric, swept, tapered, twisted, dihedral, incidence, and cambered configurations use interpolated NACA mean-camber geometry rather than the closed render skins.
- Added independent uniform/cosine chordwise and per-engineering-section spanwise resolution. Engineering station breaks plus enabled control span and hinge boundaries are inserted exactly; deterministic ordering is surface, increasing span coordinate, then leading-to-trailing chord index.
- Added finite-coordinate, area/degeneracy, unit-normal/orientation, aspect-ratio, duplicate, connectivity, station-boundary, settings, parent-geometry, and declared-scope diagnostics. Invalid inputs are reported without repair, and the interactive mesh is limited to 20,000 panels.
- Restricted M5.6 analysis geometry to the neutral control configuration. Enabled controls retain panel identifiers and exact boundaries; nonzero current deflections produce explicit warnings instead of silently changing the lattice.
- Added a dedicated mesh workspace with surface selection, coarse/medium/fine presets, resolution and spacing controls, regenerate action, per-component counts, quality summary, persistent stale-mesh detection, and wireframe/normal/collocation/bound-vortex overlays.
- Added independent rectangular area/reference, tapered multi-section, station boundary, swept/dihedral/twist/camber, uniform/cosine, panel-local quarter/three-quarter chord, asymmetric, tail orientation, control boundary, refinement, invalid geometry/configuration, deterministic output, and stale-state tests.
- Browser smoke covered initial generation, 512-panel default counts, coarse 128-panel regeneration, visualization toggles, individual surface selection, quality status, and stale detection after authoritative wing editing/reset.
- Verification passes: strict typecheck, 124 automated tests across 20 files, and production build. Vite's existing non-blocking main-chunk warning remains (approximately 1.220 MB minified / 334 kB gzip).

## M5.5 checkpoint - 2026-11-27

The repository is on the `development` branch. M5.5, Advanced Parametric Fuselage and Empennage Geometry, is complete. `AircraftDesign` is schema version 3; its component-versioned fuselage and conventional empennage station models are authoritative, while the schema-v2 wing remains unchanged. No VLM, CFD, new aerodynamic solver, landing gear, nacelle, cabin, FEA, unconventional tail, or optimization work was added.

## M5.5 completed

- Replaced the scalar fuselage with ordered longitudinal stations carrying width, height, lateral/vertical center offsets, circular/elliptical/superelliptical shape, and exponent. Schema-v1 and schema-v2 migrations preserve the prior overall dimensions and scalar tail planforms.
- Added C1 smoothstep interpolation between fuselage stations, closed nose/tail triangulation, finite normals, circular/superellipse area evaluation, Gaussian volume and volume-centroid integration, and triangulated wetted-area estimation with documented 8-by-48 default discretization.
- Added a full fuselage station editor with add/insert/duplicate/remove/edit, cross-section overlays, station selection/highlighting, live length/width/height/area/volume/wetted-area/centroid feedback, validation, undo, and reset. The UI explicitly distinguishes geometric centroid from aircraft CG and outer volume from usable volume.
- Generalized the conventional horizontal and vertical tails to multi-station chord/leading-edge/twist/airfoil definitions and adjacent sections. Horizontal-tail incidence, dihedral, and three-axis placement are supported; the vertical tail supports lateral/base-height placement and explicitly rejects cant in the conventional configuration.
- Reused the wing station operations, profile interpolation, quarter-chord transform, and lofting path for the empennage. Added live projected areas, aspect ratios, MACs, reference locations, moment arms, and horizontal/vertical tail-volume coefficients.
- Updated elevator and rudder geometry to derive from the actual tail stations and profiles. Tail edits are rejected when they invalidate attached controls; compatible edits preserve hinge coverage and deflection behavior.
- Preserved the existing preliminary sizing, analysis, and M4.6 isolation behavior. Candidate previews now deep-copy the station arrays for fuselage and both tails; no component mass or drag model is inferred from geometric volume or wetted area.
- Added independent circle/ellipse area, cylinder/ellipsoid volume, wetted-area convergence, centroid, editing, invalid-definition, watertightness, tail-reference, volume-coefficient, migration, control-compatibility, store-history, and candidate-isolation tests.
- Browser smoke covered fuselage insertion, live volume updates, invalid-dimension rejection, undo, horizontal-tail insertion and live reference changes, vertical-tail editing/reset, section overlays, and elevator/rudder preservation.
- A follow-up default-design refinement now uses 11 fuselage stations, multi-panel stabilizers, and authoritative low-wing/fuselage/dorsal-fin attachment coordinates to present a coherent conventional subsonic configuration. Smooth computed normals and physically based paint materials improve visual continuity without decorative geometry. All dimensions are documented illustrative assumptions.
- Verification passes: strict typecheck, 111 automated tests across 19 files, and production build. Vite's existing non-blocking main-chunk warning remains (approximately 1.199 MB minified / 328 kB gzip).

## M5.4 checkpoint - 2026-11-26

The repository is on the `development` branch. M5.4, Parametric Control Surface Design, is complete. A separately versioned conventional control-surface model now derives movable geometry from the authoritative parent lifting surfaces and visualizes rigid three-dimensional hinge deflection without changing the undeflected reference aircraft. No VLM, aerodynamic control derivatives, flap corrections, trim, actuators, flight controls, complex high-lift devices, optimization, or persistence was added.

## M5.4 completed

- Added typed, versioned definitions for ailerons, trailing-edge plain flaps, elevators, and rudders with unique identity, parent, span interval, chord/hinge fractions, enabled state, deflection bounds/current command, operation mode, and physical side.
- Added pure validation and editing operations for creation, edit, delete, and neutral reset. Validation rejects incompatible parent/type and side/operation combinations, nonfinite or reversed limits, invalid fractions or deflections, out-of-parent spans, enabled overlaps, and rigid controls crossing a schema-v2 wing station break.
- Derived wing control profiles from the M5.3 span/profile interpolation and quarter-chord transform. Added compatible scalar-tail adapters for horizontal-tail elevators and vertical-tail rudders using their actual taper, sweep, placement, and incidence where applicable.
- Added cosine-spaced trailing-edge skins, straight three-dimensional endpoint hinge axes, Rodrigues rotation, hinge-axis invariance, distinct control colors, visible hinge lines, viewport selection, and real-time deflection. Non-collinear transformed hinges report their midpoint deviation instead of silently hiding the straight-axis approximation.
- Defined command signs explicitly: positive linked flap/elevator command is trailing-edge down on both sides; positive differential aileron command is starboard down/port up; independent horizontal surfaces affect the selected side; positive rudder moves the trailing edge starboard.
- Added the control editor to the geometry workspace with add/select/enable/edit/delete, linked/differential/independent operation, neutral-all reset, actionable errors, and live projected area, total span, hinge fraction, and physical left/right angles.
- Preserved undeflected wing references and existing analyses. Parent geometry changes are rejected when they invalidate controls, and M4.6 candidate previews preserve each wing control's normalized semi-span coverage.
- Added independent area, interpolation, hinge preservation, sign, swept/dihedral rotation, operation, invalid/overlap, neutral recovery, state, and candidate regression tests. Browser smoke covered creation, selection, deflection, validation, reset, a second control type, and deletion.
- Verification passes: strict typecheck, 96 automated tests across 17 files, and the production build. Vite's existing non-blocking main-chunk warning remains (approximately 1.161 MB minified / 321 kB gzip).

## M5.3 checkpoint — 2026-11-26

The repository is on the `development` branch. M5.3, Advanced Section-Level Geometry and Airfoil Lofting, is complete. The renderer now consumes a pure section-transform and interpolated-loft layer derived from the authoritative schema-v2 wing. Projected reference definitions and existing analysis results are unchanged. No control surfaces, VLM, polar database, advanced fuselage geometry, optimization, or persistence was added.

## M5.3 completed

- Separated normalized local NACA four-digit coordinates from the aircraft-coordinate transformation. Each physical station is transformed about its invariant quarter-chord using the documented `x` aft, `y` starboard, `z` up convention; positive and negative geometric twist support wash-in and washout.
- Preserved sweep and dihedral exactly once: leading-edge `x` and propagated station `z` define the reference-line position, while twist alone rotates the local airfoil section. Analytical projected area, span, AR, MAC, and reference locations remain independent of loft tessellation.
- Added matched cosine-sampled interpolation between independently selected station airfoils, with four render intervals per engineering section. The schema-v2 engineering stations remain authoritative; interpolated rings are disposable render geometry.
- Corrected twisted tip-cap centers and root/tip cap winding, retained continuous symmetric/asymmetric loft topology, and computed finite vertex normals. Unsupported or zero-thickness airfoil identifiers are rejected before geometry commit.
- Added exact station cross-section display plus optional chord-line, leading-edge, quarter-chord, and twist-angle guides in the M5.2 editor.
- Added independent rectangular, swept/dihedral, positive/negative twist, quarter-chord invariance, profile interpolation, symmetry/asymmetry, finite triangle, nondegenerate topology, outward cap-normal, and reference-metric regression tests.
- Browser smoke verified independent root/tip profiles, wash-in/washout, cross-section and guide toggles, annotations, asymmetric expansion, and reset. Verification passes: strict typecheck, 84 automated tests across 16 files, and the production build.

## M5.2 checkpoint — 2026-11-26

The repository is on the `development` branch. M5.2, Interactive Wing Section Editor and 3D Lofting, is complete. The dedicated geometry workspace edits the existing schema-v2 wing directly, with validated real-time lofting and reference-property feedback. No control surfaces, VLM, new aerodynamic solver, advanced fuselage geometry, optimization, or persistence was added.

## M5.2 completed

- Added a dedicated wing workspace with an editable station table for span, chord, leading-edge position, derived leading-edge sweep, twist, section dihedral, and supported NACA airfoil identifiers.
- Added validated add-outboard, insert-after, duplicate, remove, symmetric/asymmetric conversion, undo, and reset operations as pure transformations of the authoritative schema-v2 wing. Invalid ordering, dimensions, topology, and symmetry changes are rejected before state mutation with actionable messages.
- Added live span, projected area, aspect ratio, MAC, MAC leading-edge, and quarter-chord reference feedback. Every accepted edit increments the design revision and updates the same geometry consumed by existing analyses.
- Added selectable station rows and viewport markers, selected-station highlighting, optional station dimensions, and top/front/side/isometric engineering views over the actual expanded physical stations.
- Preserved backward compatibility with schema-v1 migration, the simple station model, preliminary sizing, M4.6 detached candidate generation, and all existing analysis regressions.
- Added focused operation, validation, symmetry, live-metric, history, reset, and editor-to-mesh consistency tests. Browser smoke covered insertion, editing, all engineering views, annotations, asymmetric conversion/editing, invalid-input rejection, undo, and reset.
- Verification passes: strict typecheck, 76 automated tests across 15 files, and the production build. Vite's existing non-blocking main-chunk warning remains.

## M5.1 checkpoint — 2026-11-26

The repository is on the `development` branch. M5.1, Multi-Section Aircraft Geometry Foundation, is complete. The authoritative aircraft schema is version 2 and the wing is represented once as validated spanwise stations and connecting piecewise-trapezoidal sections. No advanced editor, control surfaces, VLM, takeoff model, optimization, or project persistence was added.

## M5.1 completed

- Added strongly typed wing stations with span position, chord, leading-edge x, geometric twist, and airfoil identifier; connecting sections carry local dihedral and explicit adjacency.
- Added symmetric half-wing and asymmetric full-span configurations. Symmetric source stations are mirrored analytically; asymmetric stations use signed `y` positions and an explicit root station.
- Added pure validation for model version, station order, unique identifiers, positive chords, finite positions, nonempty airfoils, bounded twist/dihedral, symmetry topology, and complete adjacent section connectivity.
- Added pure piecewise-linear calculations for full projected span, projected planform area, aspect ratio, mean aerodynamic chord, reference leading-edge/quarter-chord locations, spanwise interpolation, physical station height, and section-level area/taper/sweep/MAC properties.
- Migrated the former schema-v1 trapezoid to an equivalent schema-v2 two-station symmetric wing. The existing simple geometry inspector edits the same authoritative station model through validated whole-wing transforms.
- Updated the wing renderer to loft all physical stations while keeping analytical properties independent of tessellation. Existing aerodynamics, structures, stability, metrics, sizing, and isolated M4.6 candidate generation now consume the shared station geometry.
- Preserved M4.6 behavior: a candidate remains a detached, two-station trapezoid sized from area/aspect/taper and retains the source wing's global sweep, dihedral, tip twist, root airfoil, and placement.
- Added independent rectangular, trapezoidal, multi-section, symmetric/asymmetric, MAC/reference-location, interpolation, invalid-definition, and v1-migration tests. Existing M4 sizing and candidate regressions pass.
- Verification passes: strict typecheck, 69 automated tests across 14 files, and the production build. Vite's existing non-blocking main-chunk warning remains (approximately 1.095 MB minified / 302 kB gzip).

## M4.6 checkpoint — 2026-11-26

The repository is on the `development` branch. M4.6, Provisional Aircraft Candidate Generation, is complete. Candidate data remains transient and isolated from the authoritative aircraft design; no apply workflow, takeoff model, advanced geometry, VLM, or optimization was added.

## M4.6 completed

- Added a pure, versioned provisional-candidate generator gated on a converged, current-revision M4.4 result with positive finite mass, wing area, installed shaft power, and energy-storage mass.
- Derived trapezoidal wing span and root/tip chords from required area plus user-selected aspect and taper ratios. Existing sweep, dihedral, twist, airfoil, placement, fuselage, empennage, structure, and propulsion configuration remain unchanged.
- Included calculated takeoff mass, installed shaft power, payload and fuel/battery mass in an isolated preview design without adding an authoritative-state mutation path.
- Added side-by-side current/provisional parameters, a reusable non-destructive 3D preview, sizing assumptions, provenance, limitations, and copied M4.3 constraint statuses.
- Preserved mission-indeterminate status and explicitly unevaluated takeoff. The UI never claims full aircraft validation or feasibility.
- Added deterministic source fingerprints and stale warnings for mission/design revisions, sizing outputs, propulsion type, aspect ratio, and taper ratio. Candidates can be discarded locally.
- Added focused geometry, state-isolation, status-preservation, staleness, revision-mismatch, missing-result, non-convergence, and invalid-input regression tests.
- Verification passes: strict typecheck, 60 automated tests across 13 files, and the production build. The existing bundle-size warning remains non-blocking.

## M4.5 checkpoint — 2026-11-26

The repository is on the `development` branch. M4.5, Independent Engineering Verification and Validation, is complete. No aircraft generation, geometry modification, mission-segment solver, propulsion map, VLM, optimization, or takeoff model was added.

## M4.5 completed

- Added a versioned, reproducible benchmark fixture and `docs/BENCHMARKS.md` with equations, sources, inputs, independent expectations, AeroForge results, differences, tolerances, status, and limitations.
- Independently verified the 1976 standard atmosphere, stall W/S, cruise/climb/service-ceiling shaft P/W, wing area, installed shaft power, mass closure, electric battery mass, fuel mass, mission energy, reserve, and dimensional consistency.
- Verified convergence from three initial masses and three relaxation factors; tolerance behavior, residuals, impossible fractions, infeasible points, extreme ranges, unit invariance, and explicit non-convergence all pass.
- Added published NASA TERA electric regional-aircraft sanity checks for MTOW conversion, wing area, wing loading, motor power, installed shaft P/W, and a simple battery specific-energy example.
- Preserved the boundary between analytical verification and published-data comparison. NASA's complete battery/mission model is not claimed to be reproduced.
- Found no production-equation defect. Corrected one benchmark fixture to the cited sea-level density precision and extracted direct wing/power algebra into a reusable pure helper without changing equations.
- M4.6 is not approved for unqualified automatic geometry application. A provisional, user-reviewed candidate workflow may be considered only with all indeterminate/unsupported statuses preserved.

## M4.4 completed

- Added a pure, versioned preliminary sizing solver that consumes mission requirements and the shared M4.3 W/S–installed-shaft-P/W design point without changing current geometry.
- Added explicit airframe, propulsion, fixed-equipment and payload mass accounting. Empty mass is user supplied; no undocumented empirical correlation is used.
- Added separate electric effective shaft-specific-energy and fuel brake-specific-consumption models with reserve capacity.
- Added cruise shaft-energy estimation by reusing ISA atmosphere, the analytical drag polar, propulsive efficiency, and shared level-flight power model.
- Added damped fixed-point mass closure with configurable initial mass, damping, mass tolerance and iteration limit.
- Added convergence, non-convergence, infeasible and incomplete states; physically impossible energy fractions and invalid design points are rejected.
- Added required wing area, installed shaft power, cruise shaft power, storage mass/capacity, mass residual and energy residual outputs.
- Added two-initial-guess sensitivity, convergence history visualization, mass breakdown, and SI/aviation displays.
- A converged closure remains mission-indeterminate because takeoff distance is mandatory and unevaluated.
- Added independent mass balance, W/S area, P/W power, electric/fuel bookkeeping, convergence sensitivity, non-convergence, infeasibility, invalid-input and unit-conversion tests.

## M4.3 completed

- Added schema version 1, an incrementing in-memory design revision, and a versioned constraint-result contract with model ID/version, validity, assumptions, warnings, and sources. Persistence and migration remain future work.
- Added a pure aircraft constraint solver using wing loading `W/S` and installed shaft power loading `P/W`.
- Added maximum-stall-speed, cruise shaft-power, minimum-rate-of-climb, and supported service-ceiling constraints.
- Reused ISA atmosphere, planform metrics, mass warnings, mission validation, the parabolic drag polar, and a shared level-flight power calculation.
- Distinguished installed shaft power, propulsive power, and available propulsive power. Propulsive efficiency is applied once; shaft-power altitude derating is explicitly unavailable and assumed unity.
- Added an interactive SVG diagram, evaluated-feasible shading, current design point, click-selected candidate, governing constraint, and signed numerical margins.
- Added SI and aviation axis conversions: N/m² ↔ lbf/ft² and W/N ↔ hp/lbf.
- Added the mission service-ceiling input and the FAA 100 ft/min criterion at the parabolic-polar minimum-power point.
- Takeoff remains not evaluated. Passing plotted constraints produces an overall indeterminate label, never overall feasible.
- Added independent stall, cruise, climb, service-ceiling conversion, boundary, intersection, infeasible-domain, invalid-input, unit, and contract tests.

## Phase 4A completed

- Added a strongly typed `MissionRequirements` model to the shared aircraft design state for category, payload, range, cruise speed/altitude, stall and takeoff limits, climb requirement, maximum operating speed, and design objective.
- Added a dedicated Mission workspace and inspector with live editing in SI or aviation units.
- Added deterministic unit conversions for kg/lb, km/nmi, m/ft, m/s/kt, and m/s/ft/min.
- Added finite, bounded mission validation and the operating-speed-above-stall consistency rule.
- Added pass/fail/not-evaluated cards and signed numerical margins.
- Reused the existing mass, atmosphere, stall, power, climb, and range functions. No numerical model was duplicated.
- Payload, requested cruise point, range, sea-level stall speed, and point climb are evaluated where model inputs and validity permit.
- Takeoff distance, category-specific constraints, ceiling, and design-objective optimization remain explicitly not evaluated with visible limitations.
- Existing geometry, aerodynamics, multidisciplinary performance, stability, maneuver-envelope, and structure workflows remain available.

The codebase is a functional conceptual-design demonstrator with three preliminary analysis baselines. It is not yet an end-to-end aircraft sizing, VLM, simulation, controls, optimization, persistence, export, or deployment platform. “Implemented” below means deterministic code and focused tests exist; it does not imply high-fidelity validation.

## What is actually implemented

| Capability | Evidence in repository | Assessment |
|---|---|---|
| Frontend foundation | React 18, strict TypeScript, Vite, Zustand, Three.js/React Three Fiber, Vitest; CAD-style navigation and inspector | Implemented baseline |
| Shared design state | Typed `AircraftDesign` schema version 3 with incrementing revision and mission, geometry, mass, propulsion, stability, and structure groups | Versioned in memory; v1/v2 geometry migrations exist, but project persistence is not implemented |
| Geometry | Validated multi-section wing and conventional empennage, independent station airfoils/twist, cosine-interpolated lofts, generalized fuselage stations/cross-sections, component editors/history, conventional controls, and separate thin mean-camber analysis panels | M5.7 independently verified conventional neutral geometry complete; no unconventional tails, complex high-lift devices, deflected lattice, or VLM solve |
| Geometry metrics | Wing/tail projected area, span, aspect ratio, MAC/reference locations, tail moment arms/volume coefficients, fuselage area distribution/volume/wetted area/centroid, wing loading, and conditional stall speed | Implemented and analytically tested in declared scope |
| Atmosphere | ISA 1976-style troposphere from 0–11 km plus manual density | Implemented and tested; manual-density Mach uses sea-level sound speed with warning |
| Aerodynamics | Linear finite-wing lift slope, pre-stall CL, parabolic polar, forces, Mach, L/D, analytical elliptical span load | Implemented low-fidelity baseline; key coefficients are supplied assumptions |
| Weight/CG | Four lumped component masses, longitudinal moments, CG, mismatch warning | Implemented baseline; no hierarchy, envelope, or inertia |
| Propulsion/performance | Supplied shaft power/efficiency/energy, level-flight power, excess-power climb, endurance, range, and aggregate electric/fuel preliminary sizing | Implemented baseline; no maps, derating, takeoff, or segment mission simulation |
| Stability | Tail area/volume, neutral point, static margin from supplied tail/downwash assumptions | Implemented baseline; no trim, control authority, lateral or dynamic stability |
| Flight envelope | Simplified aerodynamic/structural maneuver envelope | Implemented baseline; no gust or dynamic effects |
| Structures | Half-wing Euler–Bernoulli cantilever, constant EI, elliptical limit load, shear/moment/stress/deflection/safety factor | Implemented benchmark model; no wing box, materials workflow, self-weight, torsion, buckling, or FEA |
| Tests | 136 automated tests in 21 files, including independent schema-v3 geometry/panel benchmarks, published NASA dimensions, geometric convergence, analysis-panel topology/refinement/quality/staleness, fuselage/tail geometry, watertight render topology, control compatibility, migrations/isolation, mission/constraint benchmarks, mass/energy closure, robustness, version contracts, and units | Conventional geometry and M4.2–M4.4 equations are independently verified in their declared scope; full-aircraft external validation remains incomplete |
| Optimization, 6-DOF, flight controls | Conventional movable geometry only; no aerodynamic effectiveness, dynamics, or controller implementation | Planned beyond geometry |
| Save/load, reports, geometry/data export, public release workflow | No implementation found | Planned |

## Verification performed at this checkpoint

- `npm.cmd run typecheck`: **passed**.
- `npm.cmd test`: **passed**, 136 tests across 21 files.
- `npm.cmd run build`: **passed**.
- Vite reports the existing production chunk warning: approximately 1.220 MB minified / 334 kB gzip for the main JavaScript asset.

## Phase status against the long-term objective

| Phase | Status | Principal gap |
|---:|---|---|
| 1. Mission requirements and preliminary sizing | M4.2–M4.5 complete; broader phase partial | Analytical pipeline independently verified; no takeoff model, matched full-aircraft closure validation, sourced empty-mass correlation, or segment mission sizing |
| 2. Advanced parametric geometry | M5.7 conventional aircraft and neutral analysis geometry complete | Independently benchmarked schema-v3 definitions, migrations, render lofts, references, controls, and analysis lattice exist; unconventional configurations, complex mechanisms, deflected lattice, persistence, and export remain later extensions |
| 3. Airfoil analysis and VLM | Partial precursor | NACA coordinates, analytical lift model, and solver-ready panels exist; no polar import, wake, influence matrix, circulation, or VLM results |
| 4. Structures and materials | Partial precursor | Constant-EI beam only; no load transfer, wing box, materials, or advanced failure modes |
| 5. Propulsion sizing | Partial precursor | Aggregate electric/fuel cruise sizing exists; no component maps, electrical details, derating, or operating-point coverage |
| 6. Weight and CG | Partial | Fixed-mass closure and four lumped CG masses exist; no hierarchy, loading envelope, inertia, or consumable CG changes |
| 7. Static and dynamic stability | Partial static precursor | Static margin only; no trim, control derivatives, lateral/directional or dynamic modes |
| 8. Performance and mission analysis | Partial | Fixed-condition estimates; no takeoff/landing, ceiling, turns, gusts, or segment mission |
| 9. 6-DOF simulation | Not started | Requires validated force/moment tables, inertia, frames, trim, and integration |
| 10. Flight controls | Not started | Requires 6-DOF plant, actuators/sensors, and stability models |
| 11. MDO | Not started | Requires stable versioned analysis pipeline and feasibility contract |
| 12. Export, reports, deployment | Not started | No persistence, exports, report manifest, CI release, or public deployment evidence |

## Key technical debt and risks

- The in-memory schema and constraint result are versioned and v1 wing migration exists, but project persistence, a serialized envelope, uncertainty, and common contracts for older analysis results remain.
- Input validation is distributed and largely warning-based; UI fields accept values that may make geometry or downstream analysis invalid.
- Aerodynamic lift slope omits sweep and compressibility; `CD0`, Oswald efficiency, section slope, zero-lift angle, and `CLmax` are supplied.
- Elliptical span loading does not respond to taper, twist, sweep, tails, or fuselage.
- Range assumes constant mass, speed, altitude, efficiency, and no wind; mission requirements are not simulated as segments.
- Static stability depends on supplied tail/downwash data and does not establish trim or control authority.
- The beam model has constant stiffness and omits self-weight, torsion, shear stress, buckling, joints, and aeroelasticity.
- No traceable material, airfoil polar, propeller, motor, engine, battery, fuel-consumption, or empirical sizing dataset is integrated; M4.4 therefore requires explicit user properties.
- No project persistence means edits are session-only; the header correctly identifies the project as unsaved.
- Advanced computations may require Web Workers and code splitting before adding a backend; a Python service is not yet justified.

## Planning deliverables completed

- `docs/ROADMAP.md`: 12-phase engineering plan, effort ranges, MVP/stretch boundary, and 12-week schedule.
- `docs/REQUIREMENTS.md`: traceable functional and quality requirements with current status and MVP priority.
- `docs/BACKLOG.md`: dependency-ordered weekly delivery backlog, exit gates, risk responses, and post-MVP work.
- `docs/VALIDATION.md`: evidence levels, audited baseline, discipline benchmarks, tolerances, and release gates.

## Current stop point

M5.7 and the bounded conventional M5 geometry phase are complete. Development stops here pending owner review. Independent analytical, published-dimension, render-topology, migration, integration, and geometric-refinement evidence supports proceeding to M6 airfoil/polar work and M7 neutral conventional VLM geometry use. No wake, Biot-Savart solver, influence matrix, circulation, aerodynamic force, trim, or control-effectiveness model is implemented. Provisional candidates remain isolated with no apply action; takeoff and full segment mission analysis remain unavailable, so mission feasibility remains indeterminate.
