# AeroForge progress

## M4.4 checkpoint — 2026-11-26

The repository is on the `development` branch. M4.4, Iterative Preliminary Aircraft Sizing, is complete. No geometry modification, mission-segment solver, propulsion map, VLM, optimization, or takeoff model was added.

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
| Shared design state | Typed `AircraftDesign` schema version 1 with incrementing revision and mission, geometry, mass, propulsion, stability, and structure groups | Versioned in memory; shallow path updater and no persistence/migration |
| Geometry | Single trapezoidal wing and tails, NACA four-digit sections, circular-section fuselage loft, component stations, standard views, orbit/pan/zoom | Implemented baseline; not advanced/multi-section CAD |
| Geometry metrics | Area, aspect ratio, tip chord, MAC, wing loading, conditional stall speed | Implemented and tested |
| Atmosphere | ISA 1976-style troposphere from 0–11 km plus manual density | Implemented and tested; manual-density Mach uses sea-level sound speed with warning |
| Aerodynamics | Linear finite-wing lift slope, pre-stall CL, parabolic polar, forces, Mach, L/D, analytical elliptical span load | Implemented low-fidelity baseline; key coefficients are supplied assumptions |
| Weight/CG | Four lumped component masses, longitudinal moments, CG, mismatch warning | Implemented baseline; no hierarchy, envelope, or inertia |
| Propulsion/performance | Supplied shaft power/efficiency/energy, level-flight power, excess-power climb, endurance, range, and aggregate electric/fuel preliminary sizing | Implemented baseline; no maps, derating, takeoff, or segment mission simulation |
| Stability | Tail area/volume, neutral point, static margin from supplied tail/downwash assumptions | Implemented baseline; no trim, control authority, lateral or dynamic stability |
| Flight envelope | Simplified aerodynamic/structural maneuver envelope | Implemented baseline; no gust or dynamic effects |
| Structures | Half-wing Euler–Bernoulli cantilever, constant EI, elliptical limit load, shear/moment/stress/deflection/safety factor | Implemented benchmark model; no wing box, materials workflow, self-weight, torsion, buckling, or FEA |
| Tests | 45 automated tests in eleven files, including mission/constraint benchmarks, mass/energy closure, convergence sensitivity, failure states, version contracts, and unit conversions | Useful V1/V2 analytical evidence; limited external aircraft validation |
| Optimization, 6-DOF, controls | No implementation found | Planned |
| Save/load, reports, geometry/data export, public release workflow | No implementation found | Planned |

## Verification performed at this checkpoint

- `npm.cmd run typecheck`: **passed**.
- `npm.cmd test`: **passed**, 45 tests across eleven files.
- `npm.cmd run build`: **passed**.
- Vite reports the existing production chunk warning: approximately 1.08 MB minified / 297 kB gzip for the main JavaScript asset.

## Phase status against the long-term objective

| Phase | Status | Principal gap |
|---:|---|---|
| 1. Mission requirements and preliminary sizing | M4.2–M4.4 complete; broader phase partial | Mission, constraints and preliminary mass closure exist; no takeoff model, sourced statistical empty-mass correlation, or segment mission sizing |
| 2. Advanced parametric geometry | Partial | Single trapezoids/circular fuselage only; no multi-section surfaces, controls, analysis discretization, or schema migration |
| 3. Airfoil analysis and VLM | Partial precursor | NACA coordinates and analytical lift model only; no polar import or VLM |
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

- The in-memory schema and constraint result are versioned, but persistence, migration, uncertainty, and common contracts for the older analysis results remain.
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

M4.4 is complete. Development stops here pending owner review. Results remain separate from current geometry. Takeoff analysis, mission-segment integration, propulsion maps, VLM, automatic geometry changes, and optimization have not been started.
