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
| Geometry/metrics | Independent rectangular, trapezoidal, multi-section and asymmetric reference-property cases; editor history; local/global section transforms; cosine profile blending; quarter-chord invariance; closure, winding and finite topology; invalid topology and v1 migration | V2 for analytical reference properties; V1 for editor and section loft | No external CAD comparison, generalized tail stations, mesh round-trip, or actual wetted-area benchmark |
| Atmosphere | 1976 Standard Atmosphere source plus independent 3000 m and boundary regressions | V2 | Troposphere only; altitude is treated as geopotential in the implemented equation |
| Analytical aerodynamics | Independent coefficient/force formulas, span-load symmetry/tip behavior, CLmax warning | V1 | No numerical span-load integral test, sweep correction, polar data, or external aero benchmark |
| Mass/CG | Independent four-component mass-moment calculation | V1 | Longitudinal CG only; no hierarchy, envelope, or inertia |
| Mission constraints/performance | Independent stall, cruise, climb, and service-ceiling values plus exact boundaries and failure cases | V2 | No takeoff, changing mass, wind, or segment mission integration |
| Preliminary sizing | Closed-form electric/fuel mass, energy, reserve, wing, and power benchmarks; convergence matrix; NASA TERA direct sizing sanity check | V2 for declared equations | Published full-aircraft mass/battery closure not reproduced; NASA case has a higher-fidelity battery/mission model |
| Static stability | Independent tail-volume/neutral-point/static-margin calculation | V1 | Relies on supplied derivatives; no trim or lateral/dynamic modes |
| Structures | Elliptical-load root shear/moment compared with analytical values | V1/V2 | Constant EI; no self-weight/torsion/buckling/material library/load-transfer evidence |
| Build quality | Typecheck, 136 tests across 21 files, production build, M5.6 browser workflow, and M5.7 independent geometry audit complete successfully on Windows | V1/V2 geometry | Existing Vite main-chunk warning remains (`1,220.13 kB` minified / `334.28 kB` gzip); CI/clean-clone evidence is still planned |

The current suite contains 136 tests across 21 test files. Detailed M4.5 evidence and source links are recorded in `BENCHMARKS.md`; the independently reproducible M5.7 geometry ledger is in `GEOMETRY_BENCHMARKS.md`. This count is inventory, not proof of completeness. Each release must reproduce tests and build from a clean checkout and record tool versions and environment.

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
- A complete textbook/published sizing case with matched propulsion and empirical assumptions remains required before authoritative automatic geometry application.
- Mass closure from two separated initial guesses; report iteration residual and convergence rate.
- Deliberately infeasible stall/climb/takeoff combinations must return no feasible region.
- Energy/fuel and reserve balances must close within 0.1% for deterministic cases.
- M4.4 independently checks the closed component mass sum, signed mass/energy residuals, `S=W/(W/S)`, and `P_installed=(P/W)*W`.
- Electric storage mass is checked from effective shaft-specific energy; fuel mass is checked independently from brake-specific fuel consumption. Both include reserve as unavailable total capacity.
- Two separated initial masses converge to the same solution within twice the requested tolerance. A one-iteration budget returns non-converged, and an energy mass fraction at least one returns infeasible.
- Missing propulsion properties, invalid iteration controls, non-finite design points, and M4.3-infeasible points return incomplete or infeasible without fabricated outputs.
- Area, power, energy, specific-energy, and fuel-consumption conversions have independent aviation-unit benchmarks or round-trip tests.
- M4.5 independently verifies all preceding equations with a versioned fixture and declared tolerances; see `docs/BENCHMARKS.md`.
- M4.5 compares direct wing/power sizing against NASA's published TERA MTOW, wing area, and motor power. Battery fraction is context only and is not fitted because the NASA source uses a materially higher-fidelity mission and battery model.
- M4.6 provisional generation is verified for the trapezoid identities `S=b(cr+ct)/2`, `AR=b²/S`, and `lambda=ct/cr`; required area and selected aspect/taper are reproduced to floating-point tolerance.
- Candidate isolation tests prove the source design is unchanged and unsupported configuration values are preserved. Constraint statuses, including unevaluated takeoff and mission-indeterminate, are copied without promotion.
- Fingerprint regressions cover mission/design revision, sizing-output, aspect-ratio, and taper changes. Non-converged, revision-mismatched, incomplete, non-finite, and out-of-bound inputs are blocked.
- M4.6 remains blocked from authoritative or automatic application. It validates only candidate transformation and isolation, not full-aircraft geometry, packaging, structures, stability, propulsion integration, or mission feasibility.

### 2. Advanced parametric geometry

- M5.1 rectangular check: `b=10 m`, constant `c=2 m` requires `S=20 m²`, `AR=5`, `MAC=2 m`, and quarter-chord `0.5 m` aft of its leading edge.
- M5.1 trapezoid check: `b=12 m`, `cr=2 m`, `ct=1 m` requires `S=18 m²`, `AR=8`, and `MAC=14/9 m`; zero sweep requires `x_LE,MAC=0` and `x_MAC/4=7/18 m` for a root leading edge at zero.
- M5.1 multi-section check independently sums half-wing panels `(y,c)=(0,4),(2,3),(5,1)`: `S=26 m²`, `AR=100/26`, and `MAC=113/39 m`. Section areas and sweeps are checked separately.
- M5.1 asymmetric check uses `(-4,2),(0,3),(6,1)` and requires `b=10 m`, `S=22 m²`, `AR=100/22`, and `MAC=7/3 m`; independent port/starboard dihedral signs produce upward tips without implicit mirroring.
- Spanwise manufactured interpolation verifies chord, leading edge, quarter chord, twist, and integrated height. Invalid ordering, zero/negative chord, broken adjacency, empty airfoil, and 90-degree dihedral are rejected.
- Schema-v1 migration must preserve the established 12 m trapezoid's area, AR, MAC, sweep-derived tip leading edge, dihedral, twist, airfoil, and placement. M4.6 regression tests must continue to reproduce candidate area/aspect/taper and state isolation.
- M5.2 station-operation tests cover insertion with analytical area/MAC preservation, duplicate/add/remove connectivity, station and section edits, supported sweep edits, symmetric-to-asymmetric expansion, independent asymmetric changes, and invalid chord/order/root-removal rejection.
- M5.2 store tests verify accepted edits update the authoritative design revision, undo restores the preceding validated wing, and reset restores the default schema-v2 geometry. Mesh-bound and vertex-count checks verify the viewport consumes the edited physical stations rather than a separate planform.
- M5.2 browser smoke covers station insertion and chord editing with immediate metric changes; top, side, and front views; dimension annotations; asymmetric conversion and port-side editing; actionable negative-chord rejection; airfoil selection; duplicate/remove; undo; and reset.
- M5.3 independently checks an untwisted rectangular section, swept/dihedral station placement, positive and negative twist, and exact quarter-chord invariance using the documented local-to-aircraft transform.
- M5.3 profile-transition tests compare every midpoint coordinate with the arithmetic mean of independently generated NACA 0012 and NACA 4412 cosine samples. Symmetric expansion and an unequal explicit asymmetric chain verify physical-ring endpoints without implicit mirroring.
- Every M5.3 loft triangle is checked for finite coordinates and nonzero area. Indexed cap faces must point toward `-y` at the port tip and `+y` at the starboard tip; computed vertex normals must remain finite. Render refinement is proven not to change analytical reference properties.
- M5.3 browser smoke covers independent NACA 4412 root/NACA 0012 tip selection, `+4 deg` root wash-in, `-6 deg` tip washout, section-curve display, chord/quarter-chord guides, twist annotations, asymmetric expansion, and reset. Span, projected area, AR and MAC remain unchanged when only profile/twist changes.
- M5.4 analytical cases verify rectangular and tapered control area, spanwise hinge interpolation on swept/dihedral/twisted geometry, exact hinge-axis preservation under Rodrigues rotation, consistent outward winding of mirrored closed skins, positive/negative linked command signs, differential and independent side operation, and horizontal/vertical-tail compatibility adapters.
- M5.4 invalid-definition cases reject out-of-parent spans, enabled overlap, and rigid controls crossing a wing station break. Neutral reset reproduces neutral vertices while leaving projected wing metrics unchanged. Store tests reject parent-wing changes that invalidate an attached control, and M4.6 regression preserves normalized control span coverage in resized candidate previews.
- M5.4 browser smoke covers aileron creation/selection, real-time differential deflection, live area/span/physical-angle feedback, invalid span rejection with an actionable message, neutral reset, plain-flap creation, and delete. The viewport shows distinct movable skins and hinge lines derived from the same engineering model.
- M5.5 cross-section benchmarks require `A_circle=pi d^2/4` and `A_ellipse=pi wh/4`. A 5 m by 2 m closed cylinder requires `V=5pi m^3`, centroid `x=2.5 m`, and closed area `12pi m^2`; radial refinement from 8 to 192 segments reduces the surface-area error. A dense 6 m ellipsoid station definition is compared with `4pi abc/3`.
- M5.5 editing and validation cases cover C1 midpoint interpolation, insert/duplicate/remove, ordered longitudinal stations, positive interior dimensions, jointly collapsed endpoints, circular dimension consistency, supported airfoils, and rejection of vertical-tail cant. The collapsed-tip fuselage mesh is checked for finite coordinates, valid indices, and exactly two incident triangles per undirected edge.
- M5.5 tail cases independently recover trapezoid area, aspect ratio, MAC, aerodynamic references, both tail moment arms, and `V_H`/`V_V`. Multi-panel insertion reuses the wing editor transformation and preserves analytical geometry on removal. Store tests verify fuselage/tail undo/reset and reject tail changes that invalidate attached elevators or rudders.
- Schema-v2 migration tests preserve the prior wing metrics, fuselage length/maximum diameter, tail spans, and control model. M4.6 regression verifies detached candidate fuselage and tail station arrays are deep copies. Existing sizing, aerodynamics, stability, structures, and mission tests remain green.
- M5.5 browser smoke covers fuselage insert and live volume/centroid changes, actionable negative-width rejection, undo recovery, horizontal-tail insertion and metric updates, vertical-tail live editing/reset, station cross-section display, and elevator/rudder preservation after compatible tail changes.
- The refined illustrative demonstrator asserts wing and horizontal-tail reference heights lie inside the interpolated fuselage envelope, the vertical-tail base lies within `0.08 m` of the local dorsal surface, and all three component definitions remain editable multi-station models. This verifies attachment consistency, not a structural joint or aerodynamic interference model.
- M5.6 rectangular panels recover `20 m²` for a `10 m × 2 m` wing at coarse and refined resolutions. One-panel chord cases place bound-vortex endpoints at `x/c=0.25` and collocation at `x/c=0.75`; all panel areas, local directions, and declared normals are finite and consistently oriented.
- Tapered multi-section tests preserve every physical station boundary and recover the analytical projected area. Independent cases cover sweep, dihedral, positive/negative twist, blended NACA camber, asymmetric port/starboard geometry, horizontal-tail `+z` normals, vertical-tail `+y` normals, uniform/cosine spacing, control span/hinge insertion, neutral-only deflection warnings, deterministic output, invalid settings/parent geometry, and design-revision staleness.
- M5.6 browser smoke generates the default 512-panel mesh (`128` wing, `256` horizontal tail, `128` vertical tail), regenerates the coarse 128-panel preset, toggles normals/collocation/bound vortices, changes selected surfaces, and proves an authoritative wing edit/reset marks the retained mesh stale. It does not validate a VLM solution because none is implemented.
- M5.7 independently recovers rectangular, trapezoidal, multi-section, asymmetric, tail, control, circle/ellipse, cylinder, and ellipsoid references without using production functions to create expected values. Analytical cases agree to roundoff; fine cylinder wetted-area and station-defined spheroid-volume errors are `0.02856%` and `0.02219%`.
- NASA NTRS 20220018375's documented untwisted, untapered OpenVSP wing is reproduced from its published `3.048 m` span and `0.7141 m` chord. The computed `2.1765768 m2` area differs from the separately rounded published `2.1767 m2` by `0.00566%`; the reconstructed quarter-chord differs by `0.06284%`, within the half-unit rounding implied by the published dimensions.
- Panel audit independently verifies corners, triangle areas, reference points, frames, normal magnitude/orientation, global increasing-span bound-vortex direction, deterministic ordering, shared-edge connectivity, station/control boundaries, trailing edges, neutral-control warnings, and degenerate rejection. Closed render loft station coordinates match the computational boundaries and remain watertight with finite normals.
- Geometric refinement uses 8/96/384 panels on a cambered, swept, twisted, dihedral wing. Three-dimensional mean-surface area converges `17.690472 -> 17.699828 -> 17.701057 m2`, while projected reference area remains invariant at `17.5 m2`. This is not aerodynamic convergence evidence.
- Full regression retains schema-v1/v2 migration, M4 sizing/candidate isolation and stale detection, geometry-edit mesh invalidation, and existing analysis-model limitations. One M5.7 correction prevents attached-control validation from throwing after invalid selected-parent geometry; it now returns a structured invalid-parent result.
- VLM geometry gate: pass for a neutral conventional first solver. M7 must still define wake topology, circulation sign, adjacency/strip construction, force/moment frames, and solver residual/convergence validation. Deflected lattices and unconventional configurations remain outside the verified scope.
- Multi-section volume and independent numerical-integration comparison remain planned because M5.1 defines a reference surface, not a closed wing volume model. Target relative error for later numerical comparisons remains below 0.1%.
- NACA symmetric/cambered section properties, cosine spacing, finite normals, winding, closure, section continuity, and mirrored topology.
- Translation/rotation/reference-frame invariance where applicable; render tessellation changes must not change analytical reference properties.
- Exported mesh reopens in an independent viewer with correct scale and axes.

### 3. Airfoil analysis and VLM

- M6.1 uses synthetic project-authored fixtures with declared non-experimental provenance to verify Selig, Lednicer, and coordinate CSV parsing; leading/trailing-edge identification; normalization; ordering; consecutive duplicate handling; and rejection of malformed, degenerate, crossing, nonfinite, or duplicated geometry.
- CSV and XFOIL polar fixtures verify exact tabulated recovery, missing coefficient preservation, convergence and transition metadata, multiple Reynolds groups, negative-drag/invalid-condition rejection, duplicate operating points, explicit moment reference/sign, raw-source retention, and source classification.
- Imported geometry is cosine-resampled through the same wing loft, render mesh, and thin analysis-mesh paths as generated NACA profiles. Station airfoil changes increment design revision and make retained meshes stale; referenced imported geometry cannot be removed.
- Full regression retains schema-v3 geometry, M4 sizing/candidate isolation, control surfaces, NACA lofting, and M5 computational geometry. M6.1 contains no polar interpolation or aerodynamic solution benchmark.

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
