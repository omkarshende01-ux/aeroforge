# AeroForge progress

## Phase 4A checkpoint — 2026-11-26

The repository is on the `development` branch. Phase 4A, Mission Requirements and Design Feasibility, is complete. No optimization, new aerodynamic solver, advanced sizing loop, or takeoff model was added.

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
| Shared design state | One typed `AircraftDesign` with geometry, flight condition, mission, mass, propulsion, stability, and structure groups | Implemented but unversioned; shallow path updater and no persistence/migration |
| Geometry | Single trapezoidal wing and tails, NACA four-digit sections, circular-section fuselage loft, component stations, standard views, orbit/pan/zoom | Implemented baseline; not advanced/multi-section CAD |
| Geometry metrics | Area, aspect ratio, tip chord, MAC, wing loading, conditional stall speed | Implemented and tested |
| Atmosphere | ISA 1976-style troposphere from 0–11 km plus manual density | Implemented and tested; manual-density Mach uses sea-level sound speed with warning |
| Aerodynamics | Linear finite-wing lift slope, pre-stall CL, parabolic polar, forces, Mach, L/D, analytical elliptical span load | Implemented low-fidelity baseline; key coefficients are supplied assumptions |
| Weight/CG | Four lumped component masses, longitudinal moments, CG, mismatch warning | Implemented baseline; no hierarchy, envelope, or inertia |
| Propulsion/performance | Supplied shaft power/efficiency/energy, level-flight power, excess-power climb, endurance, still-air range | Implemented baseline; not propulsion sizing or a mission simulation |
| Stability | Tail area/volume, neutral point, static margin from supplied tail/downwash assumptions | Implemented baseline; no trim, control authority, lateral or dynamic stability |
| Flight envelope | Simplified aerodynamic/structural maneuver envelope | Implemented baseline; no gust or dynamic effects |
| Structures | Half-wing Euler–Bernoulli cantilever, constant EI, elliptical limit load, shear/moment/stress/deflection/safety factor | Implemented benchmark model; no wing box, materials workflow, self-weight, torsion, buckling, or FEA |
| Tests | 26 automated tests in eight files, including mission validation, feasibility states/margins, model-validity gating, and SI/aviation conversion round trips | Useful V1 evidence; limited system/external validation |
| Optimization, 6-DOF, controls | No implementation found | Planned |
| Save/load, reports, geometry/data export, public release workflow | No implementation found | Planned |

## Verification performed at this checkpoint

- `npm.cmd run typecheck`: **passed**.
- `npm.cmd test`: **passed**, 26 tests across eight files.
- `npm.cmd run build`: **passed**.
- Vite reports the existing production chunk warning: approximately 1.04 MB minified / 287 kB gzip for the main JavaScript asset.

## Phase status against the long-term objective

| Phase | Status | Principal gap |
|---:|---|---|
| 1. Mission requirements and preliminary sizing | Phase 4A complete; broader phase partial | Typed requirements and feasibility exist; no constraint diagram, mass closure, takeoff model, or design-point iteration |
| 2. Advanced parametric geometry | Partial | Single trapezoids/circular fuselage only; no multi-section surfaces, controls, analysis discretization, or schema migration |
| 3. Airfoil analysis and VLM | Partial precursor | NACA coordinates and analytical lift model only; no polar import or VLM |
| 4. Structures and materials | Partial precursor | Constant-EI beam only; no load transfer, wing box, materials, or advanced failure modes |
| 5. Propulsion sizing | Partial precursor | Supplied aggregate power/energy only; no component maps, derating, or sizing loop |
| 6. Weight and CG | Partial | Four lumped masses; no component hierarchy, loading envelope, inertia, or mass closure |
| 7. Static and dynamic stability | Partial static precursor | Static margin only; no trim, control derivatives, lateral/directional or dynamic modes |
| 8. Performance and mission analysis | Partial | Fixed-condition estimates; no takeoff/landing, ceiling, turns, gusts, or segment mission |
| 9. 6-DOF simulation | Not started | Requires validated force/moment tables, inertia, frames, trim, and integration |
| 10. Flight controls | Not started | Requires 6-DOF plant, actuators/sensors, and stability models |
| 11. MDO | Not started | Requires stable versioned analysis pipeline and feasibility contract |
| 12. Export, reports, deployment | Not started | No persistence, exports, report manifest, CI release, or public deployment evidence |

## Key technical debt and risks

- The schema has no version, migration, provenance, uncertainty, analysis revision, or solver-result contract.
- Input validation is distributed and largely warning-based; UI fields accept values that may make geometry or downstream analysis invalid.
- Aerodynamic lift slope omits sweep and compressibility; `CD0`, Oswald efficiency, section slope, zero-lift angle, and `CLmax` are supplied.
- Elliptical span loading does not respond to taper, twist, sweep, tails, or fuselage.
- Range assumes constant mass, speed, altitude, efficiency, and no wind; mission requirements are not simulated as segments.
- Static stability depends on supplied tail/downwash data and does not establish trim or control authority.
- The beam model has constant stiffness and omits self-weight, torsion, shear stress, buckling, joints, and aeroelasticity.
- No traceable material, airfoil polar, propeller, motor, engine, or empirical sizing dataset is integrated.
- No project persistence means edits are session-only; the header correctly identifies the project as unsaved.
- Advanced computations may require Web Workers and code splitting before adding a backend; a Python service is not yet justified.

## Planning deliverables completed

- `docs/ROADMAP.md`: 12-phase engineering plan, effort ranges, MVP/stretch boundary, and 12-week schedule.
- `docs/REQUIREMENTS.md`: traceable functional and quality requirements with current status and MVP priority.
- `docs/BACKLOG.md`: dependency-ordered weekly delivery backlog, exit gates, risk responses, and post-MVP work.
- `docs/VALIDATION.md`: evidence levels, audited baseline, discipline benchmarks, tolerances, and release gates.

## Current stop point

Phase 4A is complete. Development stops here pending owner review. The next roadmap work remains the design-constraint and preliminary sizing loop, but it is not part of this milestone and has not been started.

## Previously recommended broader milestone

**M4: Traceable mission sizing and versioned design contract (weeks 1–2, approximately 10–11 person-days).**

1. Restore reproducible tests/typecheck/build and create the validation ledger.
2. Freeze a versioned project and result contract with units, provenance, validity, warnings, and migrations.
3. Add the complete mission requirements model and wing-loading/power-loading constraint diagram.
4. Add bounded iterative mass, wing area, installed power, and energy/fuel closure.
5. Validate one reference mission by independent hand/textbook calculations and demonstrate an infeasible case.

This is the recommended next milestone because it turns the existing collection of useful calculators into the start of a coherent aircraft-design workflow and supplies stable inputs to geometry, VLM, propulsion, structures, performance, and optimization. Implementation remains paused until the owner approves the plan and chooses the primary MVP propulsion demonstration (electric, fuel-powered, or one primary path with the other schema-only).
