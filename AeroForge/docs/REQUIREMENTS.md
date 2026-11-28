# AeroForge product and engineering requirements

## Purpose and scope

This specification defines the portfolio MVP and the contracts that preserve a path to the long-term multidisciplinary platform. The initial supported class is a conventional, subsonic, fixed-wing propeller aircraft or UAV. AeroForge provides conceptual/preliminary estimates only. It must not imply airworthiness, certification, validated CFD/FEA, or safe real-world operation.

Priority: **P0** is required for a releasable MVP, **P1** is desired if it does not threaten P0 gates, and **P2** is a post-MVP stretch goal. Status is **implemented**, **partial**, or **planned** based on the 2026-11-26 repository audit.

## System-wide requirements

| ID | Requirement | Priority | Status | Verification |
|---|---|---:|---|---|
| SYS-001 | Use a versioned, serializable aircraft/project schema shared by geometry, analyses, UI, persistence, and exports. Provide explicit migrations. | P0 | Partial | Schema round-trip and migration tests |
| SYS-002 | Store physical quantities in SI units; label UI conversions; document axes, signs, reference points, and angle conventions. | P0 | Partial | Unit and frame contract tests |
| SYS-003 | Keep domain types, pure engineering calculations, rendering, state, and UI separable. Rendering meshes must not be the sole engineering definition. | P0 | Partial | Architecture review and dependency checks |
| SYS-004 | Every analysis result shall include model/version, inputs or design revision, assumptions, warnings, validity status, convergence metadata where applicable, and source provenance. | P0 | Partial | Constraint and sizing contracts plus M4.5 benchmark traceability; older result types still need migration |
| SYS-005 | Reject non-finite, physically invalid, or topologically invalid inputs before dependent analysis; do not silently invent missing coefficients. | P0 | Partial | Boundary/property tests |
| SYS-006 | Deterministic calculations shall reproduce from the same versioned project and run settings. Optimization randomness shall use recorded seeds. | P0 | Partial | Repeat-run equality tests |
| SYS-007 | The UI shall distinguish user inputs, illustrative defaults, estimated values, imported data, unavailable results, and validated results. | P0 | Partial | UX review and accessibility tests |
| SYS-008 | Long computations shall not block interactive editing; solver cancellation/progress and Web Worker or service boundaries shall be available when justified. | P1 | Planned | Responsiveness and cancellation tests |
| SYS-009 | The browser MVP shall operate without accounts, payments, databases, AI APIs, or required Python services. | P0 | Implemented | Clean local and deployed smoke tests |

## Functional requirements

### Mission and preliminary sizing

| ID | Requirement | Priority | Status |
|---|---|---:|---|
| MIS-001 | Define payload, crew, range/endurance, cruise speed/altitude, stall speed, climb, ceiling, takeoff/landing, reserve, and propulsion type with units. | P0 | Partial |
| MIS-002 | Plot applicable wing-loading versus power/thrust-loading constraints and identify feasible regions and the selected design point. | P0 | Implemented | M4.3 |
| MIS-003 | Iterate takeoff mass, empty mass, energy/fuel, wing area, and installed power to a reported residual or an infeasibility result. | P0 | Implemented | M4.4 |
| MIS-004 | Preserve the source, applicability range, and uncertainty of empirical sizing correlations. | P0 | Partial | M4.4 uses explicit user inputs and provenance; sourced statistical correlations remain planned |
| MIS-005 | Generate a stale-aware, non-destructive provisional geometry candidate from converged sizing while preserving unsupported constraints and requiring user review. | P0 | Implemented | M4.6 |

### Parametric geometry

| ID | Requirement | Priority | Status |
|---|---|---:|---|
| GEO-001 | Edit and render wing, fuselage, horizontal tail, and vertical tail from shared mathematical parameters with live derived metrics. | P0 | Implemented |
| GEO-002 | Support multi-section lifting surfaces with section span/chord/sweep/dihedral/twist/airfoil and continuous loft validation. | P0 | **Implemented (M5.5 conventional scope):** schema-v2 wing plus component-v1 horizontal/vertical tail station editing, lofting, references, and validation are complete; unconventional tails remain planned |
| GEO-003 | Define aerodynamic references and analysis discretization independently of render tessellation. | P0 | **Implemented and independently verified (M5.7 conventional neutral scope):** deterministic mean-camber panels, refinement invariance, exact station/control boundaries, panel frames/references, topology/orientation diagnostics, render separation, published-dimension comparison, and stale detection pass; deflected lattices and the VLM solver remain planned |
| GEO-003A | Define control surfaces and reject overlaps or invalid hinge geometry. | P1 | **Implemented (M5.4 conventional scope):** aileron, plain flap, elevator, and rudder definitions, operation modes, bounds/overlap validation, parent-derived hinge geometry, rigid deflection visualization, and geometric properties; aerodynamic effectiveness and complex high-lift devices remain planned |
| GEO-004 | Support generalized fuselage stations for noncircular cross-sections; nacelles, gear, and arbitrary configurations are P2. | P1 | **Implemented (M5.5 fuselage scope):** circular, elliptical, and superelliptical stations, closed loft, geometric volume/wetted area/centroid, migration, and editor are complete |
| GEO-005 | Provide standard views, orbit/pan/zoom, axes, and geometry diagnostics. | P0 | Implemented |

### Aerodynamics

| ID | Requirement | Priority | Status |
|---|---|---:|---|
| AER-001 | Retain the documented ISA/manual-density and analytical finite-wing/parabolic-polar model as a fast comparison model. | P0 | Implemented |
| AER-002 | Import airfoil coordinates and polar tables with Reynolds number, Mach, transition settings, source, and license metadata. | P0 | **Implemented (M6.1):** versioned Selig/Lednicer/CSV geometry and CSV/XFOIL polar imports, raw provenance, explicit unknowns, library UI, and geometry selection |
| AER-003 | Interpolate only inside supported polar domains unless explicit, warned extrapolation is selected. | P0 | Planned |
| AER-004 | Compute geometry-sensitive attached-flow forces, moments, and span loads with a documented VLM and panel-convergence controls. | P0 | Planned |
| AER-005 | Keep profile/viscous drag and stall treatment separate from inviscid VLM; never present VLM as stall-capable CFD. | P0 | Planned |
| AER-006 | CFD coupling, transonic flow, unsteady aerodynamics, and aeroelasticity are P2. | P2 | Planned |

### Structures and materials

| ID | Requirement | Priority | Status |
|---|---|---:|---|
| STR-001 | Preserve the current constant-EI cantilever as a transparent benchmark model. | P0 | Implemented |
| STR-002 | Map aerodynamic and inertial loads to spanwise structure while demonstrating force/moment equilibrium. | P0 | Planned |
| STR-003 | Model spanwise spar/wing-box properties and calculate stress, deflection, and margins for declared load cases. | P1 | Planned |
| STR-004 | Compare traceable material candidates by density and allowables; keep safety factors/load factors explicit. | P0 | Planned |
| STR-005 | Detailed buckling, fatigue, joints, composites, modal response, and general FEA are P2. | P2 | Planned |

### Propulsion

| ID | Requirement | Priority | Status |
|---|---|---:|---|
| PRO-001 | Calculate required shaft power, available excess power, energy-based endurance, and range using explicit efficiencies. | P0 | Implemented |
| PRO-002 | Represent electric and fuel propulsion with distinct mass, energy, reserve, and derating models. | P0 | Partial | M4.4 aggregate energy models; maps and derating remain planned |
| PRO-003 | Import and interpolate propeller/motor/engine maps with domain checks and source metadata. | P0 | Planned |
| PRO-004 | Size installed power/thrust and energy/fuel capacity across mission operating points. | P0 | Partial | M4.4 sizes installed shaft power and cruise-only capacity |

### Weight, CG, and inertia

| ID | Requirement | Priority | Status |
|---|---|---:|---|
| WGT-001 | Sum component mass and longitudinal moments and report mismatch with authoritative takeoff mass. | P0 | Implemented |
| WGT-002 | Support a component hierarchy, loading cases, CG envelope, and empty/operating/takeoff mass definitions. | P0 | Planned |
| WGT-003 | Estimate or accept inertia tensors with source and confidence, and apply the parallel-axis theorem consistently. | P1 | Planned |
| WGT-004 | Feed consumable mass changes back into mission CG and performance. | P1 | Planned |

### Stability and performance

| ID | Requirement | Priority | Status |
|---|---|---:|---|
| STA-001 | Calculate horizontal-tail volume, neutral point, and static margin with declared supplied assumptions. | P0 | Implemented |
| STA-002 | Solve longitudinal trim and elevator/control authority with residual and limit reporting. | P1 | Planned |
| STA-003 | Calculate directional/lateral static derivatives where supported and record derivative provenance. | P1 | Planned |
| STA-004 | Produce linear longitudinal and lateral-directional modes only when complete, validated derivative/inertia inputs exist. | P2 | Planned |
| PER-001 | Calculate point drag/power, climb, range/endurance, and maneuver limits with applicability warnings. | P0 | Partial |
| PER-002 | Add takeoff/landing, climb/ceiling, turn performance, gust envelope, and plotted optima. | P0 | Planned |
| PER-003 | Integrate ordered mission segments with changing time, distance, altitude, mass, and energy/fuel. | P0 | Planned |

### Simulation and controls

| ID | Requirement | Priority | Status |
|---|---|---:|---|
| SIM-001 | Integrate rigid-body 6-DOF Newton–Euler equations using documented frames and normalized quaternions. | P2 | Planned |
| SIM-002 | Initialize from trim, support scripted controls/disturbances, and export time histories. | P2 | Planned |
| SIM-003 | Demonstrate integrator convergence and canonical invariants; flag aerodynamic table excursions. | P2 | Planned |
| FCS-001 | Model actuator/sensor limits and deterministic sampled-data control. | P2 | Planned |
| FCS-002 | Tune and assess PID stability augmentation/autopilot loops with time/frequency metrics and saturation visibility. | P2 | Planned |
| FCS-003 | LQR, gain scheduling, and Monte Carlo robustness follow validated baseline controls. | P2 | Planned |

### Optimization

| ID | Requirement | Priority | Status |
|---|---|---:|---|
| OPT-001 | Register bounded design variables, objectives, constraints, scaling, model versions, and run settings. | P0 | Planned |
| OPT-002 | Run parameter sweeps and sensitivity studies, showing feasible and invalid candidates distinctly. | P0 | Planned |
| OPT-003 | Run a bounded single-objective search and re-evaluate the reported optimum through the normal analysis pipeline. | P1 | Planned |
| OPT-004 | Pareto, surrogate, robust, and distributed optimization are P2. | P2 | Planned |

### Persistence, export, reporting, and deployment

| ID | Requirement | Priority | Status |
|---|---|---:|---|
| EXP-001 | Save/load versioned project JSON locally with validation and migration; never execute imported content. | P0 | Planned |
| EXP-002 | Export selected tables/time histories as CSV and tessellated geometry as STL/OBJ with units and axes. | P0 | Planned |
| EXP-003 | Generate a printable engineering report containing inputs, configuration, results, models, warnings, evidence, and software version. | P0 | Planned |
| EXP-004 | STEP/IGES and native CAD feature export are P2 and may require a service or specialized library. | P2 | Planned |
| DEP-001 | Publish a reproducible static build with CI, HTTPS, security headers, error handling, and no secrets in the client. | P0 | Planned |
| DEP-002 | Provide at least one versioned example project and benchmark walkthrough. | P0 | Planned |

## Quality attributes and release thresholds

- **Correctness:** P0 benchmark tolerances in the validation plan pass; conservation/residual checks are visible.
- **Performance:** ordinary edits update the viewport and fast metrics within 100 ms on the reference development machine; long analyses show progress and do not freeze the UI for more than 200 ms.
- **Reliability:** invalid inputs produce actionable diagnostics, not NaN/Infinity or stale results.
- **Accessibility:** keyboard navigation, visible focus, semantic labels, non-color-only status, and WCAG 2.1 AA contrast for primary workflows.
- **Compatibility:** current stable Chrome, Edge, and Firefox desktop; responsive layout remains usable at 1280×720.
- **Maintainability:** strict TypeScript, pure engineering functions where practical, focused tests, no undocumented model constants, and model docs updated with code.
- **Security/privacy:** local-first MVP, safe file parsing, dependency audit, CSP-compatible deployment, no uploaded design data or telemetry without explicit disclosure and consent.
- **Performance budget:** initial compressed JavaScript target below 500 kB where practical; code-split Three.js and advanced solvers; document justified exceptions.

## MVP exclusions

The 12-week MVP excludes certification compliance, general-purpose CAD, arbitrary aircraft configurations, viscous/transonic CFD, nonlinear stall/departure, high-fidelity FEA, flutter/aeroelasticity, fatigue/life prediction, real-time pilot training, hardware-in-the-loop, production autopilots, collaboration/accounts, and claims of global optimization. These may be researched only after their dependencies and validation evidence exist.

## Change control

The owner is chief engineer and approves scope, engineering correlations, reference datasets, and release claims. A requirement may enter the MVP only with an identifier, acceptance test, dependencies, validation method, and schedule trade. Failed validation narrows or removes a capability claim; coefficients are not tuned solely to match a target.
