# AeroForge verification and validation plan

## Purpose

Verification asks whether AeroForge implements its stated equations and contracts correctly. Validation asks whether a model is adequate for a declared use and regime. A passing software test does not make a conceptual model flightworthy. Every released result must name its model, validity range, assumptions, provenance, and evidence level.

Evidence levels:

- **V0 — unverified:** proposed or implemented without an independent check; not releaseable as an engineering result.
- **V1 — unit verified:** equations, invariants, boundaries, and error handling pass focused tests.
- **V2 — benchmark verified:** agrees with an independent analytical, textbook, published, or trusted-tool case within a declared tolerance.
- **V3 — cross-validated:** agrees across multiple configurations or against suitable experimental/public data with uncertainty discussed.

The portfolio MVP requires V2 for its primary reference workflow and at least V1 for all exposed branches. V3 is desirable but is not a certification claim.

## Audited current evidence — 2026-11-26

| Area | Existing evidence found | Level | Limitation |
|---|---|---:|---|
| Geometry/metrics | Tests for trapezoidal area, AR, MAC, stall relation, mesh bounds, symmetry, finite normals, NACA coordinates | V1 | No multi-section geometry, mesh snapshots, or external CAD comparison |
| Atmosphere | ISA sea-level and 11 km regression tests plus invalid-altitude case | V1/V2 | Troposphere only; reference citation should be pinned |
| Analytical aerodynamics | Independent coefficient/force formulas, span-load symmetry/tip behavior, CLmax warning | V1 | No numerical span-load integral test, sweep correction, polar data, or external aero benchmark |
| Mass/CG | Independent four-component mass-moment calculation | V1 | Longitudinal CG only; no hierarchy, envelope, or inertia |
| Performance | Independent fixed-condition CL/drag/power/climb/range calculation; envelope cap checks | V1 | No takeoff, ceiling, changing mass, wind, or mission integration |
| Static stability | Independent tail-volume/neutral-point/static-margin calculation | V1 | Relies on supplied derivatives; no trim or lateral/dynamic modes |
| Structures | Elliptical-load root shear/moment compared with analytical values | V1/V2 | Constant EI; no self-weight/torsion/buckling/material library/load-transfer evidence |
| Build quality | Typecheck, 45 tests, and the production build complete successfully on Windows | V1 | Existing Vite main-chunk size warning remains; CI/clean-clone evidence is still planned |

The M4.4 suite contains 45 tests across eleven test files. This count is inventory, not proof of completeness. Each release must reproduce tests and build from a clean checkout and record tool versions and environment.

## Validation process

1. Define the intended use, supported domain, inputs, outputs, frames, signs, and failure behavior.
2. Cite the governing method and data source, including edition/version and license.
3. Create an independent expected result before or separately from implementation.
4. Set absolute/relative tolerances from method order, discretization, and source uncertainty—not from the observed discrepancy.
5. Test nominal, boundary, invalid, symmetry, conservation, and convergence cases.
6. Record actual result, residual, environment, commit, model version, status, reviewer, and unresolved discrepancy.
7. Expose validity/convergence failures to users and reports. Never tune undocumented coefficients merely to hit a benchmark.

## Test layers

- **Unit and property tests:** pure equations, dimensions, monotonicity, symmetry, conservation, and invalid-input handling.
- **Numerical verification:** solver residual, condition warning, grid/time-step refinement, observed convergence, and repeatability.
- **Integration tests:** shared project revision propagates consistently through geometry, aero, structures, weight, stability, propulsion, and performance.
- **Golden workflow:** versioned reference aircraft/mission, saved project, selected plots/tables, report manifest, and exports.
- **Independent benchmark:** hand calculation, spreadsheet, analytical result, published dataset, or trusted external tool with matched definitions.
- **UI/deployment tests:** accessible input/error behavior, cross-browser smoke, safe import, public build, performance, and rollback.

## Phase validation matrix

### 1. Mission requirements and preliminary sizing

- Rectangular/trapezoidal wing-loading constraint calculations against hand solutions.
- M4.3 stall benchmark independently evaluates `0.5*rho0*Vs,max²*CLmax`.
- M4.3 cruise benchmark independently evaluates `CL`, `CD`, `D/W`, propulsive `P/W`, and shaft `P/W` without calling the shared power helper.
- M4.3 climb benchmark independently adds `ROCmin/eta_p`; service ceiling verifies the FAA 100 ft/min conversion.
- Exact power and stall boundary points pass; immediately lower power or higher W/S points fail. Manufactured crossing curves verify interpolated constraint intersections.
- An excessive but valid climb requirement produces no evaluated-feasible region in the plotted domain.
- Invalid efficiency/input cases return an invalid versioned result; takeoff remains not evaluated and prevents an overall feasible label.
- W/S and shaft P/W aviation conversions have independent one-unit benchmarks and round-trip tests.
- A textbook sizing case with matched propulsion and empirical assumptions; cite exact source and edition.
- Mass closure from two separated initial guesses; report iteration residual and convergence rate.
- Deliberately infeasible stall/climb/takeoff combinations must return no feasible region.
- Energy/fuel and reserve balances must close within 0.1% for deterministic cases.
- M4.4 independently checks the closed component mass sum, signed mass/energy residuals, `S=W/(W/S)`, and `P_installed=(P/W)*W`.
- Electric storage mass is checked from effective shaft-specific energy; fuel mass is checked independently from brake-specific fuel consumption. Both include reserve as unavailable total capacity.
- Two separated initial masses converge to the same solution within twice the requested tolerance. A one-iteration budget returns non-converged, and an energy mass fraction at least one returns infeasible.
- Missing propulsion properties, invalid iteration controls, non-finite design points, and M4.3-infeasible points return incomplete or infeasible without fabricated outputs.
- Area, power, energy, specific-energy, and fuel-consumption conversions have independent aviation-unit benchmarks or round-trip tests.
- External aircraft validation remains open: no published reference aircraft is claimed because M4.4 deliberately uses user-supplied effective energy and fixed-mass assumptions.

### 2. Advanced parametric geometry

- Existing checks: for `b=12 m`, `cr=2 m`, `ct=1 m`, require `S=18 m²`, `AR=8`, and `MAC=14/9 m`.
- Multi-section area, first moment, MAC, and volume against independent numerical integration; target relative error below 0.1%.
- NACA symmetric/cambered section properties, cosine spacing, finite normals, winding, closure, section continuity, and mirrored topology.
- Translation/rotation/reference-frame invariance where applicable; render tessellation changes must not change analytical reference properties.
- Exported mesh reopens in an independent viewer with correct scale and axes.

### 3. Airfoil analysis and VLM

- Polar parser exact-point recovery, interpolation manufactured solutions, domain boundary, and prohibited-extrapolation tests.
- Rectangular unswept wing lift-curve trend against lifting-line theory; elliptic loading induced drag approaches `CL²/(pi*AR)` for `e=1`.
- Symmetric geometry at zero sideslip: near-zero side force, rolling moment, and yawing moment.
- Panel refinements of at least three levels; define convergence on `CL`, `CDi`, `Cm`, and span load before accepting a default mesh.
- Compare one published wing and one full-aircraft case with OpenVSP/VSPAERO or another traceable reference using matched axes, wake, reference area, Mach, and boundary conditions.
- VLM must warn outside attached, predominantly subsonic flow and must not supply `CLmax` by itself.

### 4. Structures and materials

- Uniform point/distributed-load cantilever deflection, shear, moment, and stress against closed forms.
- Existing elliptical half-wing requirements: root shear `L/2`, root moment `L*b/(3*pi)`; require reaction/load balance within 0.5%.
- Variable-EI manufactured case and station-refinement study; deflection changes below the declared tolerance.
- Material records checked against named datasheets/handbooks, including temper/direction/environment where relevant.
- One independent spreadsheet or simple FEA beam comparison with identical supports and loads.

### 5. Propulsion sizing

- Exact recovery at map nodes; interpolation manufactured surface; explicit rejection/warning outside RPM, speed, altitude, and power domains.
- Shaft/propulsive/thrust power balance and efficiency bounded in `(0,1]`.
- Electric energy and peak-power limits checked independently; fuel case checked with a cited BSFC/SFC relation.
- Published propeller/motor/engine operating points reproduced within source uncertainty.

### 6. Weight, CG, and inertia

- Independent mass-moment table for empty and forward/aft loading cases.
- Parallel-axis theorem checks using point masses, rods, boxes, and cylinders.
- Component sum, authoritative takeoff mass, and consumable changes reconcile to configured tolerance.
- Coordinate translation changes inertia consistently and leaves mass invariant.

### 7. Static and dynamic stability

- Existing tail-volume/neutral-point/static-margin benchmark retained.
- Trim solve must report force/moment residuals; target normalized residual below `1e-6` for well-conditioned reference cases.
- Finite-difference aerodynamic derivatives compared with solver-reported derivatives across step sizes.
- Static sign trends: aft CG reduces longitudinal margin; increased tail volume increases margin within the model's domain.
- Post-MVP eigenvalues reconstructed from state matrices and compared with textbook longitudinal/lateral cases and nonlinear 6-DOF perturbations.

### 8. Flight performance and mission analysis

- Existing fixed-condition power, climb, endurance, range, and maneuver-limit tests retained.
- Drag/power curve minima checked analytically for a parabolic polar.
- Takeoff/landing constant-force cases checked against closed-form kinematics before variable-force integration.
- Climb integration and mission segment state checked at successively halved step sizes; totals equal segment sums.
- Published aircraft data used only with matched weight, atmosphere, configuration, power rating, and uncertainty.

### 9. Six-degree-of-freedom simulation

- Force-free translation, torque-free rotation, constant gravity, and constant-rate turn canonical cases.
- Quaternion norm maintained within `1e-10` or explicitly renormalized and reported.
- At least three time steps demonstrate convergence of attitude and position histories.
- Trim initial state remains near equilibrium without control input drift beyond tolerance.
- Small perturbations reproduce linear-mode frequency/damping near trim; optional JSBSim trajectory cross-check.

### 10. Flight controls

- Discrete controller unit tests, sample-time changes, saturation, rate limits, anti-windup, and sensor failure behavior.
- Linear loop gain/phase margins and closed-loop pole locations recomputed independently.
- Nonlinear step/disturbance tests meet declared rise time, overshoot, settling, and steady-state error without hidden saturation.
- Monte Carlo/parameter sweeps use recorded seeds and report failure rate, not only successful traces.

### 11. Multidisciplinary optimization

- Known unconstrained and constrained analytic functions; optimum and feasibility tolerance declared.
- Small aircraft trade space compared against exhaustive enumeration.
- Repeated run with identical version/seed reproduces evaluated candidates and selected design.
- Re-evaluate the optimum outside optimizer caching; no invalid/infeasible point can be labeled optimal.
- Sensitivities checked across perturbation sizes and against analytic gradients where available.

### 12. Export, reports, and deployment

- Golden project save/load and old-schema migration; numerical round-trip tolerance `1e-12` unless serialization format justifies otherwise.
- CSV units/headers inspected; STL/OBJ dimensions and axes checked after independent import.
- Report snapshot verifies design revision, inputs, model versions, assumptions, warnings, convergence, evidence, and software commit.
- Clean-clone test/typecheck/build, dependency/license review, CSP/security headers, safe malformed-file imports, and no client secrets.
- Chrome/Edge/Firefox smoke tests, keyboard/accessibility audit, responsive 1280×720 check, and deployment rollback exercise.

## Release gates

### Milestone gate

- New or changed equations are documented and independently reviewed.
- Focused tests, typecheck, and production build pass in the supported environment.
- Validation ledger contains source, expected result, tolerance, actual result, status, and reviewer.
- Result UI/report exposes assumptions, warnings, validity, and convergence.
- Interfaces and saved-project migration are reviewed before integration.

### Portfolio MVP gate

- All P0 requirements are traced to passing evidence.
- The reference mission runs end-to-end from requirements through report/export.
- Primary workflow reaches V2; every exposed optional branch reaches at least V1.
- No unresolved severity-1 correctness, security, data-loss, or accessibility defect.
- Known limitations, dataset licenses, model versions, and the VLM contingency decision are published.

## Benchmark ledger template

| Field | Required content |
|---|---|
| Benchmark ID | Stable ID linked to requirement and test |
| Intended claim | Exact capability being supported |
| Inputs/configuration | Values, units, axes, options, discretization |
| Reference | Source, edition/version, URL/DOI where applicable, license |
| Independent expected result | Value/curve and derivation method |
| Tolerance | Absolute/relative and rationale |
| Actual result | Value/curve, residual, convergence |
| Environment | Browser/OS/runtime/tool versions |
| Software | Commit and model/schema version |
| Status/reviewer | Pass/fail/limited, date, reviewer |
| Discrepancy/limitations | Open difference and effect on claim |

The ledger is release evidence. A benchmark failure changes the implementation or narrows the claim; it is never hidden by changing a tolerance after observing the result.
