# AeroForge development roadmap

## Planning basis

This roadmap was baselined on 2026-11-26 from the repository implementation, not from aspirational UI labels. AeroForge targets conventional, subsonic, fixed-wing propeller aircraft and UAVs. It is a conceptual/preliminary design tool, not a flightworthy design authority, CFD/FEA replacement, or certification system.

Status terms:

- **Baseline implemented:** deterministic code and focused automated tests exist, but the method remains preliminary.
- **Partial:** a lower-fidelity precursor exists; the stated phase is not complete.
- **Planned:** no substantive implementation was found.
- **MVP:** required for the 12-week portfolio release. **Stretch:** scheduled only after MVP gates pass or if capacity remains.

Effort is remaining focused engineering effort in person-days, including implementation, tests, documentation, and review. Estimates assume one experienced full-stack/aerospace engineer, existing repository foundations, and timely owner decisions. A 20% schedule reserve is held for integration and model correction.

## Portfolio-ready MVP outcome

At the end of week 12, a user should be able to define a mission, size and edit a conventional aircraft, run documented conceptual analyses, compare feasible design alternatives, save/load the project, export results, and reproduce a benchmark case in a public browser deployment. Every output must identify its model, assumptions, units, validity warnings, and provenance. The MVP will not claim viscous CFD, general FEA, certified loads, nonlinear departure behavior, autopilot readiness, or globally optimal design.

## Phase plan

### 1. Mission requirements and preliminary aircraft sizing — partial, MVP

- **Completed:** M4.2 mission definition/current-design feasibility, M4.3 interactive W/S versus installed shaft P/W constraints, and M4.4 damped mass/wing/power/cruise-energy closure with electric and fuel branches. Takeoff remains explicitly unevaluated.
- **Objective:** translate payload, range, endurance, cruise, stall, climb, ceiling, and takeoff constraints into a traceable design point and initial mass/wing/power estimates.
- **Milestones:** mission schema and editor; unit-aware requirement validation; constraint diagram; iterative mass closure; candidate design-point selection; sizing summary.
- **Engineering methods:** wing-loading/power-loading constraints, dynamic-pressure stall relation, excess-power climb, statistical empty-mass fractions with cited applicability, and damped fixed-point iteration. Keep electric energy and fuel-energy models distinct.
- **Dependencies:** atmosphere, unit system, aerodynamic assumptions, propulsion efficiency, and weight model. Existing range/climb margins are inputs to this phase, not full sizing.
- **Acceptance:** a documented reference mission converges from two initial guesses; infeasible requirements are identified; selected wing area and installed power reproduce the plotted constraint intersection within tolerance.
- **Validation:** hand calculations plus one published textbook/design example with matched assumptions; mass and energy balance residuals reported.
- **Remaining effort:** 3–5 days for a sourced reference-aircraft benchmark, richer empty-mass correlations, and mission-segment energy; M4.4 itself is complete.

### 2. Advanced parametric aircraft geometry — partial, MVP core; stretch extensions

- **Objective:** evolve the current single-trapezoid assembly into analysis-ready, editable geometry without coupling mesh rendering to physics.
- **Milestones:** versioned geometry schema; multi-section wing and tail; per-section airfoil/twist/dihedral; control-surface definitions; generalized fuselage stations; geometry validation; reference areas and aerodynamic reference frame. Nacelles, landing gear, and arbitrary configurations are stretch.
- **Engineering methods:** piecewise lofted sections, cosine airfoil sampling, consistent quarter-chord transforms, watertight surface checks, and separate render/analysis discretizations.
- **Dependencies:** shared design schema, units, coordinate convention, migration for existing projects.
- **Acceptance:** symmetric and asymmetric section definitions produce finite, correctly oriented meshes; derived area/MAC/volume agree with independent integration; invalid topology is rejected before analysis.
- **Validation:** analytic rectangular/trapezoidal cases, mesh invariants, snapshot/reference views, and convergence of derived geometry with discretization.
- **Remaining effort:** 5–7 days for MVP; 8–12 additional days for stretch geometry.

### 3. Airfoil analysis and vortex-lattice methods — partial precursor, MVP

- **Objective:** replace purely supplied aerodynamic coefficients with geometry-sensitive attached-flow analysis while keeping viscous and stall limits explicit.
- **Milestones:** airfoil coordinate/polar import with provenance; polar interpolation; horseshoe/ring VLM lattice; boundary conditions and linear solve; force/moment/span-load results; mesh convergence UI; comparison against the current analytical model.
- **Engineering methods:** 2-D polar lookup or optional externally generated XFOIL data; incompressible VLM with Prandtl-Glauert correction only in a declared range; Trefftz-plane or near-field induced drag; stripwise viscous drag buildup. No VLM stall prediction.
- **Dependencies:** analysis-ready geometry, reference axes, robust matrix solver, atmosphere, and validated sign conventions.
- **Acceptance:** lift-curve slope and induced drag converge with panel refinement; symmetric zero-sideslip cases produce negligible side force/roll/yaw moment; results include convergence and validity warnings.
- **Validation:** flat-plate/elliptic-wing analytical trends, published VLM/OpenVSP VSPAERO cases where licensing permits, and reciprocal/reference-frame checks.
- **Remaining effort:** 10–14 days; the largest MVP technical risk.

### 4. Structural analysis and material selection — partial precursor, MVP-lite

- **Objective:** connect aerodynamic loads to a preliminary wing-box model and compare material/spar candidates without presenting beam theory as FEA.
- **Milestones:** material library with sources and aerodynamic/inertial load mapping into the existing transparent beam are MVP. Geometry-varying EI/GJ and candidate margin plots are P1 pull work. Shell/solid FEA, buckling panels, fatigue, and aeroelasticity are stretch.
- **Engineering methods:** Euler–Bernoulli/Timoshenko selection by slenderness, thin-wall section properties, yield/ultimate allowables with declared factors, and conservative load cases.
- **Dependencies:** mass distribution, VLM loads, maneuver/gust cases, and geometry stations.
- **Acceptance:** load equilibrium closes; uniform cantilever benchmarks pass; material ranking is based on traceable density/allowables; failed margins are prominent.
- **Validation:** closed-form beam cases, mesh/station convergence, reaction-force balance, and one independent spreadsheet or FEA comparison.
- **Remaining effort:** 6–8 days for MVP-lite; 15+ days for advanced structures.

### 5. Propulsion system sizing — partial, MVP

- **Objective:** size a propeller-driven electric or fuel-powered system over takeoff, climb, cruise, and reserve conditions.
- **Milestones:** propulsion-type contract; motor/engine and propeller map import; efficiency interpolation; installed power/thrust sizing; energy/fuel storage sizing; operating-envelope warnings.
- **Engineering methods:** actuator-disk sanity bounds, propeller advance ratio and map interpolation, shaft-to-thrust power balance, altitude derating, battery specific energy/power, and fuel specific consumption where data exists.
- **Dependencies:** mission segments, performance drag, atmosphere, and weight iteration.
- **Acceptance:** selected system satisfies required operating points or is declared infeasible; no extrapolation outside maps without warning; energy and reserve totals reconcile.
- **Validation:** map interpolation tests, static/limit cases, published propeller or engine data, and independent power-balance calculations.
- **Remaining effort:** 5–7 days.

### 6. Aircraft weight and center-of-gravity analysis — partial, MVP

- **Objective:** extend four lumped masses into a component hierarchy, loading cases, mass closure, inertia estimates, and CG envelope.
- **Milestones:** component tree; empty/operating/takeoff mass definitions; station and inertia inputs; payload/fuel/energy loading cases; CG envelope; link to sizing iteration.
- **Engineering methods:** mass moments, parallel-axis theorem, bounded empirical estimates with citations, and explicit distinction between entered, estimated, and calculated quantities.
- **Dependencies:** geometry volumes/stations, propulsion and structures, mission consumables.
- **Acceptance:** component sums close to authoritative totals within a configured tolerance; forward/aft CG cases are reproducible; negative or unlocated masses block dependent analysis.
- **Validation:** independent mass-moment tables, canonical inertia shapes, and loading-case regression tests.
- **Remaining effort:** 3–5 days.

### 7. Static and dynamic stability — partial static precursor; dynamic stretch

- **Objective:** integrate traceable static margins for MVP, add longitudinal trim/control authority as P1 pull work, then linear dynamic modes when derivative quality supports them.
- **Milestones:** force/moment reference conventions and static-margin integration are MVP; longitudinal trim, control authority, and directional static stability are P1. Derivative registry, state-space linearization, and eigenmodes are stretch.
- **Engineering methods:** VLM-derived or sourced derivatives, tail/downwash corrections, trim root solving, dimensional-to-nondimensional derivative conversion, and standard small-disturbance state matrices.
- **Dependencies:** CG/inertia, aerodynamic moments, control surfaces, propulsion thrust line.
- **Acceptance:** trim residuals meet tolerance; static margins and control deflections are bounded and signed consistently; dynamic modes are never shown without complete derivative provenance.
- **Validation:** textbook stick-fixed cases, finite-difference derivative checks, eigenvalue reconstruction, and published mode comparisons.
- **Remaining effort:** 2–3 days for MVP integration; 3–5 days for P1 trim/control authority; 8–12 additional days for dynamic stability.

### 8. Flight performance and mission analysis — partial, MVP

- **Objective:** simulate point performance and a segment-based mission with changing mass/energy and explicit constraints.
- **Milestones:** drag/power curves; takeoff and landing ground roll; climb schedule and ceiling; range/endurance; turn performance; maneuver-plus-gust envelope; mission segment integrator and reserves.
- **Engineering methods:** force/energy integration, density-altitude effects, Breguet relations only for appropriate fuel cases, time-stepped electric energy, and regulatory-style gust formulas only with cited category assumptions.
- **Dependencies:** aerodynamics, propulsion, weight, atmosphere, and mission definition.
- **Acceptance:** segment transitions conserve state; mission totals equal segment sums; infeasible segments stop with diagnostics; point-performance optima agree with curve extrema.
- **Validation:** analytic constant-condition cases, published aircraft trends with matched conditions, time-step convergence, and independent mission bookkeeping.
- **Remaining effort:** 6–8 days.

### 9. Six-degree-of-freedom flight simulation — planned, stretch

- **Objective:** provide a deterministic research simulator for model exploration, not pilot training or hardware qualification.
- **Milestones:** rigid-body state/frames contract; atmosphere and gravity; force/moment providers; quaternion integration; trim initialization; scripted maneuvers; playback and data export; optional JSBSim comparison.
- **Engineering methods:** Newton–Euler equations, normalized quaternions, selectable fixed-step integrators, lookup-table aerodynamics, actuator limits, and event handling.
- **Dependencies:** validated mass/inertia, derivatives or coefficient tables, propulsion dynamics, controls, and frame conventions.
- **Acceptance:** force-free and constant-rate invariants hold; energy/momentum behavior is bounded; step-size convergence is demonstrated; invalid lookup-table excursions are flagged.
- **Validation:** canonical rigid-body cases, trim hold, phugoid/short-period comparison to linear modes, and JSBSim/reference trajectory comparison.
- **Remaining effort:** 12–18 days after MVP.

### 10. Flight control systems — planned, stretch

- **Objective:** design and evaluate basic stability augmentation and autopilot loops against the validated simulation plant.
- **Milestones:** actuator/sensor models; PID gain tooling; attitude/altitude/airspeed loops; saturation and anti-windup; command scripts; frequency/time-domain metrics. LQR and gain scheduling follow only if justified.
- **Engineering methods:** linearization, root locus/Bode margins, PID/LQR, Monte Carlo uncertainty, and deterministic sampled-data execution.
- **Dependencies:** 6-DOF plant, trim/linear models, actuator/control-surface definitions.
- **Acceptance:** closed-loop tests meet stated rise time, overshoot, settling, and stability margins across the declared envelope without hidden saturation.
- **Validation:** unit-step and disturbance cases, linear/nonlinear agreement near trim, sample-time sensitivity, and parameter-uncertainty sweeps.
- **Remaining effort:** 10–15 days after Phase 9.

### 11. Multidisciplinary design optimization — planned, MVP basic; stretch advanced

- **Objective:** automate traceable design-space exploration while preserving feasibility and reproducibility.
- **Milestones:** design-variable/constraint registry; parameter sweep; sensitivity plots; feasible-set filtering; bounded single-objective search; saved run manifest. Pareto fronts, surrogate models, and robust optimization are stretch.
- **Engineering methods:** normalized variables, deterministic seeds, grid/Latin hypercube sampling, finite-difference sensitivity, derivative-free constrained search, and explicit penalty/feasibility rules.
- **Dependencies:** stable pure analysis pipeline, caching, model validity checks, and versioned design schema.
- **Acceptance:** known test problems are solved within tolerance; repeated runs reproduce results; infeasible candidates cannot be labeled optimal; the reported optimum can be re-evaluated independently.
- **Validation:** analytic optimization functions, brute-force comparison on small spaces, constraint-boundary tests, and sensitivity step-size checks.
- **Remaining effort:** 5–7 days for MVP sweeps/feasibility; 12–20 additional days for advanced MDO.

### 12. CAD export, engineering reports, and public deployment — planned, MVP

- **Objective:** make analyses portable, reviewable, reproducible, and safely deployable.
- **Milestones:** versioned JSON save/load and migrations; CSV results; STL/OBJ surface export; printable HTML/PDF engineering report; example project; CI; static deployment; error/telemetry policy. STEP/IGES and server jobs are stretch.
- **Engineering methods:** schema validation, deterministic report manifests, tessellation tolerances, content-security headers, lazy loading/code splitting, and reproducible build metadata.
- **Dependencies:** frozen MVP schema, analysis provenance, geometry, validation gates, and hosting decision.
- **Acceptance:** round-trip save/load is lossless within numeric tolerance; exports reopen in an independent viewer; reports contain inputs/models/warnings/version; public deployment passes smoke, accessibility, and performance checks.
- **Validation:** golden project/report snapshots, export re-import checks, clean-clone CI, cross-browser smoke tests, and deployment rollback drill.
- **Remaining effort:** 7–9 days.

## Twelve-week target schedule

| Week | Primary outcome | Included phases | Exit gate |
|---|---|---|---|
| 1 | Baseline, schema/versioning, requirement traceability, benchmark harness | all foundations | Current tests reproducible; project schema and model-result contract approved |
| 2 | Mission editor, constraint analysis, initial sizing loop | 1, 6 | Reference mission produces a converged or explicitly infeasible design point |
| 3 | Multi-section analysis-ready geometry and migrations | 2 | Geometry invariants and analytic area/MAC checks pass |
| 4 | Airfoil data import, provenance, polar interpolation | 3 | Imported datasets validate and reproduce tabulated points |
| 5 | VLM solver core, frames, force/moment coefficients | 3 | Symmetry and analytic trend benchmarks pass |
| 6 | VLM convergence and geometry-sensitive span loads; optional viscous integration | 3, 4 | Mesh study and load equilibrium gate pass |
| 7 | Propulsion maps, component weight/CG envelope, mass closure | 5, 6 | Reference aircraft closes mass/energy and operating points |
| 8 | Material library and aerodynamic/inertial load mapping; optional variable-EI beam | 4 | Material provenance and load-equilibrium gates pass |
| 9 | Integrated static stability and expanded point performance; optional trim | 7, 8 | Static-margin and point-performance benchmark gates pass |
| 10 | Segment mission analysis; parameter sweeps and feasibility | 8, 11 | End-to-end reference mission and repeatable trade study pass |
| 11 | Persistence, exports, report, integration hardening | 12 | Golden project round trip and report/export checks pass |
| 12 | Independent validation, accessibility/performance, public deployment | all MVP | Release checklist passes; known limitations and evidence published |

Contingency rule: if VLM has not passed convergence and reference checks by the end of week 6, ship the MVP with the existing analytical aerodynamic model plus polar import, clearly labeled, and move VLM behind an experimental flag. Do not consume validation/deployment reserve to preserve a feature claim.

## Stretch sequence after the MVP

1. Dynamic stability derivatives, eigenmodes, and control authority expansion.
2. 6-DOF rigid-body simulator and reference trajectory comparison.
3. Flight-control design, actuator/sensor uncertainty, and Monte Carlo evaluation.
4. Higher-fidelity structures: buckling, torsion, modal response, aeroelastic coupling, and external FEA interchange.
5. Advanced MDO: Pareto fronts, surrogate/robust optimization, distributed jobs.
6. Rich geometry/configurations, STEP/IGES workflow, backend compute service, collaboration, and accounts only when justified.

## Recommended next milestone

Approve **Milestone M4: Traceable mission sizing and versioned design contract** (weeks 1–2). It should add no advanced solver yet. First freeze the versioned input/result contracts and validation ledger, then implement the mission constraint diagram and iterative mass/wing/power closure using the already-tested atmosphere, metrics, performance, and mass modules. This closes the largest workflow gap, creates inputs for every later discipline, and provides an end-to-end portfolio story before taking on VLM risk.
