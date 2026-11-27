# AeroForge delivery backlog

## Operating rules

This backlog implements the roadmap in dependency order. **P0** items form the portfolio MVP; **P1** items are pulled only after the week's P0 exit gate; **P2** items are post-MVP stretch work. Estimates are focused person-days and include code, tests, model documentation, and review. No item is done until its acceptance and validation evidence are recorded.

## Current baseline

The repository already contains the browser shell, parametric single-section wing/fuselage/tails, NACA four-digit sections, ISA atmosphere, analytical finite-wing aerodynamics, component mass/CG, simplified power/range/climb, static margin, maneuver envelope, and constant-EI beam. These are foundations to preserve and regression-test, not backlog items to reimplement.

Milestone status as of 2026-11-26:

- **M4.1 prerequisite complete for constraint analysis:** schema version, design revision, and versioned constraint-result contract exist in memory. Persistence and migration remain in ARC-01.
- **M4.2 complete:** typed mission definition, validation, unit conversion, and current-design feasibility.
- **M4.3 complete:** interactive W/S versus installed shaft P/W analysis with stall, cruise, climb, supported service ceiling, candidate selection, margins, governing constraint, and explicitly unevaluated takeoff.
- **M4.4 complete:** damped preliminary mass closure, explicit fixed masses, electric/fuel cruise-energy branches, wing/power sizing, residual history, sensitivity to two initial guesses, and explicit incomplete/infeasible/non-converged states.
- **M4.5 complete:** independent analytical fixture, published NASA TERA wing/power sanity check, convergence/robustness matrix, unit invariance, benchmark ledger, and conditional M4.6 readiness decision.
- **M4.6 complete:** gated provisional candidate generation, analytical trapezoid sizing, isolated 3D preview, current/candidate comparison, provenance and constraint status display, discard, and deterministic stale-result detection. No authoritative apply path exists.

## Twelve-week MVP backlog

| ID | Week | Pri | Deliverable | Depends on | Effort | Done when |
|---|---:|---:|---|---|---:|---|
| ARC-01 | 1 | P0 | Versioned project/design/result contracts; model metadata and validity types | Current schema | 2.0 d | **Partial:** in-memory design/result contract complete; persistence and lossless migrations remain |
| VAL-01 | 1 | P0 | Machine-readable validation ledger and benchmark fixtures | ARC-01 | 1.5 d | **Complete for M4.2–M4.4 (M4.5):** independent expectations, sources, tolerances, results, and limitations are versioned; later models require new entries |
| TST-01 | 1 | P0 | Restore reproducible clean-clone test/typecheck/build workflow and CI skeleton | None | 1.5 d | All three commands run in CI and a clean Windows checkout |
| UX-01 | 1 | P1 | Global input/error/status conventions and units component | ARC-01 | 1.0 d | Input/estimate/warning/invalid states are visually distinct |
| MIS-01 | 2 | P0 | Mission schema/editor with payload, cruise, stall, climb, ceiling, takeoff, reserve | ARC-01 | 1.5 d | Invalid or dimensionally inconsistent inputs are blocked |
| MIS-02 | 2 | P0 | Wing-loading/power-loading constraints and design-point plot | MIS-01 | 2.0 d | **Complete (M4.3):** independent stall, cruise, climb, boundary, intersection, and infeasible-domain tests pass |
| MIS-03 | 2 | P0 | Iterative mass/wing/power/energy closure with residual history | MIS-02, WGT baseline | 2.0 d | **Complete (M4.4):** two initial guesses converge to the same closure or fail explicitly; takeoff keeps mission status indeterminate |
| MIS-04 | 2 | P0 | Provisional candidate geometry preview from verified sizing | MIS-03, VAL-01 | 1.0 d | **Complete (M4.6):** candidate is isolated, reviewable/discardable, stale-aware, and never labeled mission-feasible |
| GEO-01 | 3 | P0 | Multi-section lifting-surface domain model and migration | ARC-01 | 1.5 d | **Complete (M5.1 wing scope):** schema-v1 trapezoid becomes an equivalent schema-v2 two-station symmetric wing; asymmetric full-span definitions and validation are tested |
| GEO-02 | 3 | P0 | Piecewise wing/tail lofts and independent reference-property integration | GEO-01 | 2.0 d | **Complete (M5.5 conventional scope):** wing and conventional tail station lofts, independent profiles/twist, closure/winding checks, analytical references, moment arms, and volume coefficients are tested; external CAD comparison and export validation remain |
| GEO-03 | 3 | P1 | Control-surface definitions and overlap diagnostics | GEO-01 | 1.5 d | **Complete (M5.4 conventional scope):** four conventional types, linked/differential/independent operation, parent-derived deflected geometry, overlap/panel validation, editor workflow, and geometric area/span are tested; aerodynamic effects and complex mechanisms remain planned |
| GEO-04 | 3 | P1 | Generalized fuselage stations, closed loft, and geometric properties | GEO-01 | 2.0 d | **Complete (M5.5 conventional scope):** circular/elliptical/superelliptical stations, C1 interpolation, editor/history, closed mesh, volume/centroid, and convergent wetted area are tested; cabin/packaging semantics remain excluded |
| AFL-01 | 4 | P0 | Airfoil coordinate and polar import parser with provenance/license fields | ARC-01 | 1.5 d | Valid fixtures round-trip; malformed files produce diagnostics |
| AFL-02 | 4 | P0 | Reynolds/Mach/alpha polar interpolation with strict domain checks | AFL-01 | 2.0 d | Tabulated points and interpolation cases meet tolerance |
| AFL-03 | 4 | P1 | Airfoil plot, dataset selector, and provenance UI | AFL-01 | 1.0 d | User can identify source and valid domain for every curve |
| VLM-01 | 5 | P0 | Analysis lattice, wake, boundary conditions, and robust linear solve | GEO-02 | 3.0 d | Rectangular-wing symmetry and residual tests pass |
| VLM-02 | 5 | P0 | Force/moment coefficients and frame transforms | VLM-01 | 2.0 d | Sign/frame and zero-sideslip invariants pass |
| VLM-03 | 6 | P0 | Span loads, induced drag, panel-refinement study, cancellation/progress | VLM-02 | 2.5 d | Declared benchmark converges inside its tolerance |
| VLM-04 | 6 | P1 | Stripwise polar/profile-drag integration and model comparison UI | AFL-02, VLM-03 | 1.5 d | Inviscid and profile contributions remain separately auditable |
| VAL-02 | 6 | P0 | Independent VLM/OpenVSP or published-case comparison | VLM-03 | 1.0 d | Evidence reviewed; contingency decision recorded |
| PRO-01 | 7 | P0 | Electric/fuel propulsion contracts and sourced map import/interpolation | ARC-01 | 2.0 d | Map boundaries, interpolation, and derating tests pass |
| PRO-02 | 7 | P0 | Installed power and energy/fuel sizing across mission points | PRO-01, MIS-03 | 1.5 d | All sizing points pass or infeasibility is explicit |
| WGT-01 | 7 | P0 | Component hierarchy, loading cases, CG envelope, and mass closure | ARC-01, MIS-03 | 1.5 d | Independent mass-moment cases and tolerance checks pass |
| STR-01 | 8 | P0 | Spanwise spar/wing-box properties and traceable material library | GEO-02 | 1.5 d | Section properties and material records have sources |
| STR-02 | 8 | P0 | Aero/inertial load mapping with equilibrium checks | VLM-03, WGT-01 | 1.5 d | Applied loads and reactions close within 0.5% |
| STR-03 | 8 | P1 | Variable-EI stress/deflection/margin plots and candidate comparison | STR-01, STR-02 | 2.0 d | Beam benchmarks and station-convergence checks pass |
| STA-01 | 9 | P1 | Force/moment references, longitudinal trim, and control-authority solve | VLM-02, WGT-01, GEO-03 | 2.0 d | Residual and control-limit acceptance tests pass |
| PER-01 | 9 | P0 | Drag/power curves, climb/ceiling, takeoff/landing, turn performance | VLM-03, PRO-02 | 2.0 d | Analytic limits and plotted optima agree |
| PER-02 | 9 | P1 | Gust envelope with cited category assumptions | PER-01, STR-02 | 1.0 d | Published example reproduces within tolerance |
| MSN-01 | 10 | P0 | Segment mission state integrator with mass/energy changes and reserves | PER-01, WGT-01, PRO-02 | 2.5 d | Segment sums, transitions, and step convergence pass |
| OPT-01 | 10 | P0 | Variable/constraint registry, sweep engine, caching, and run manifest | ARC-01, stable analyses | 1.5 d | Repeated sweep is deterministic and invalid cases stay distinct |
| OPT-02 | 10 | P1 | Sensitivity/feasible-set plots and bounded single-objective search | OPT-01 | 1.0 d | Known optimization cases and brute-force comparison pass |
| IO-01 | 11 | P0 | Local project save/load, validation, and schema migrations | ARC-01 | 1.5 d | Golden project round-trip passes |
| EXP-01 | 11 | P0 | CSV and STL/OBJ exports with axes/units metadata | GEO-02, IO-01 | 1.5 d | Independent viewer and re-import checks pass |
| RPT-01 | 11 | P0 | Printable engineering report and run manifest | Result contracts | 1.5 d | Report contains all inputs, models, warnings, evidence, and version |
| PERF-01 | 11 | P1 | Code splitting and UI responsiveness pass | Integrated app | 0.5 d | Performance budget or documented exception is met |
| VAL-03 | 12 | P0 | End-to-end reference aircraft and mission evidence pack | All P0 analyses | 2.0 d | Requirements-to-test traceability is complete |
| DEP-01 | 12 | P0 | CI release workflow and static public deployment | TST-01, IO-01 | 1.0 d | Clean build deploys with rollback instructions |
| QA-01 | 12 | P0 | Cross-browser, responsive, accessibility, security, and dependency review | Integrated app | 1.5 d | Release checklist passes; no critical issue remains |
| DOC-01 | 12 | P0 | User walkthrough, limitations, model/version documentation | All P0 | 0.5 d | New user reproduces benchmark from published steps |

Estimated workload is 49.5 focused days for P0 and 11.5 days for P1. A one-engineer, 60-day quarter therefore protects about 10.5 days for integration, correction, and absence by treating P1 as optional pull work. P1 work is not part of the schedule commitment and is the first scope removed when P0 work or independent validation runs late.

## MVP definition of done

- All P0 requirements have a linked automated test, review record, or reproducible manual procedure.
- The end-to-end reference project can be recreated from mission requirements and produces a versioned report.
- No unresolved severity-1 correctness, data-loss, security, or accessibility defect exists.
- Solver residuals/convergence and model validity are visible; unavailable results are not replaced by defaults.
- Tests, typecheck, production build, and deployed smoke tests pass from a clean checkout.
- Known limitations, source/license inventory, and benchmark evidence are published with the demo.

## Stretch backlog

| ID | Order | Capability | Dependency | Effort |
|---|---:|---|---|---:|
| STA-10 | 1 | Derivative registry, lateral/directional stability, state-space eigenmodes | VLM/trim, inertia | 8–12 d |
| SIM-10 | 2 | 6-DOF frames, rigid-body dynamics, quaternion integrator, trim initialization | STA-10 | 12–18 d |
| FCS-10 | 3 | Actuator/sensor models, PID loops, margins, scripted evaluation | SIM-10 | 10–15 d |
| STR-10 | 4 | Torsion, shear, buckling, modal response, aeroelastic load iteration | VLM, structure MVP | 15–25 d |
| OPT-10 | 5 | Pareto, surrogate, robust/uncertainty optimization | Stable full pipeline | 12–20 d |
| GEO-10 | 6 | Nacelles, landing gear, nonconventional layouts, richer fuselage controls | Geometry MVP | 8–15 d |
| CAD-10 | 7 | STEP/IGES or CAD-kernel service and external CAD round-trip | Stable geometry | 10–20 d |
| INF-10 | 8 | Python solver service, queued jobs, accounts/collaboration if justified | Proven browser limits | 15–30 d |

## Risks and responses

| Risk | Trigger | Response |
|---|---|---|
| VLM correctness consumes reserve | No converged benchmark by end of week 6 | Keep analytical model as MVP default; move VLM behind experimental flag |
| Empirical sizing inputs lack defensible sources | Correlation edition/applicability cannot be verified | Require user-supplied value or omit the estimate |
| Coupled mass/mission iteration oscillates | Residual fails to decrease or limit cycles | Damping, bounds, iteration history, explicit non-convergence |
| UI performance degrades with solver/Three.js growth | Interaction budget missed | Web Worker, code splitting, caching, smaller default meshes |
| Schema churn breaks saved projects | Contract changes after week 3 | Version/migrate; freeze MVP schema after geometry milestone |
| One engineer exceeds capacity | P0 burn exceeds 80% by week 8 | Drop P1 and advanced solver polish; preserve validation and release work |
| Public demo overstates fidelity | Result shown without validity/provenance | Block release via result-contract and report checks |

## Approval gate

The owner approved and completed the bounded Phase 4A mission-requirements/feasibility slice. Further implementation in this backlog remains gated by owner approval. Before propulsion sizing begins, select the MVP propulsion demonstration: electric, fuel-powered, or one primary path with the other retained as a schema-only extension.
