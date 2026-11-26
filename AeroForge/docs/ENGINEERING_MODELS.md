# Engineering model specification (preliminary)

## Phase 1
- Geometry and rendering use a right-handed aircraft-fixed convention: `x` aft from the nose, `y` starboard and `z` up. Positive sweep moves an outboard leading edge aft; positive dihedral raises both tips; twist is applied about each section's quarter-chord. Component placement stations use the same axes as mass and stability inputs.
For a symmetric, single trapezoidal wing, span b, root chord cr, tip chord ct, taper lambda=ct/cr:
- S=b(cr+ct)/2
- AR=b^2/S
- MAC=(2/3)cr(1+lambda+lambda^2)/(1+lambda)
- W=mg, g=9.80665 m/s^2; W/S in N/m^2.
- Vs=sqrt(2W/(rho*S*CLmax)) for steady 1-g flight with positive supplied rho and aircraft CLmax. This is true airspeed at the chosen density, not automatically indicated airspeed. Do not infer CLmax from geometry alone.
- NACA four-digit upper and lower surfaces use the standard camber and thickness equations with the finite trailing-edge coefficient `-0.1015`. Wings and stabilizers loft closed section loops with outward winding and computed vertex normals. The fuselage loft uses a rounded nose, near-constant cabin section and power-law tapered tail. Reference planform calculations remain independent of projected mesh area.

## Phase 2 aerodynamics
- The implemented ISA atmosphere uses the 1976 standard troposphere equations from 0 through 11,000 m. Manual density remains available. When manual density is selected, Mach uses the standard sea-level speed of sound and is labeled by a warning.
- The finite-wing lift slope is `a=a0/(1+a0/(pi*e*AR))`, where section slope `a0` and Oswald efficiency `e` are supplied inputs. `CL=a(alpha-alpha0)` with angles converted to radians. The model is linear, incompressible and pre-stall; it does not currently correct lift slope for sweep.
- The drag polar is `CD=CD0+CL^2/(pi*e*AR)`, with supplied `CD0` and `e`. `q=rho*V^2/2`, `L=q*S*CL`, and `D=q*S*CD`.
- The displayed span loading is the analytical elliptical estimate `l(y)=4L/(pi*b)*sqrt(1-(2y/b)^2)`. It integrates to total lift but is not a lifting-line or VLM solution and does not respond to taper, twist or sweep.
- Results warn when calculated absolute CL exceeds the supplied CLmax, Mach exceeds 0.3, inputs are invalid, or sweep is present but not modeled in the lift-slope correction.

## Phase 3 multidisciplinary baseline
- Component mass accounting uses `m_total=sum(m_i)` and longitudinal CG `x_cg=sum(m_i*x_i)/m_total`. The entered takeoff mass remains authoritative for flight loads; a mismatch with the component total is reported.
- Level flight uses `CL=W/(q*S)` and the Phase 2 drag polar at the selected true airspeed. Required shaft power is `P_shaft=D*V/eta_p`; climb rate is `(eta_p*P_available-D*V)/W`. Endurance is usable shaft energy after reserve divided by required shaft power, and still-air range is `V*endurance`. Wind, altitude change, propeller maps and changing mass are excluded.
- The maneuver envelope applies `n=q*S*CL/W` using supplied positive and negative CL limits, capped by supplied structural load limits through a supplied maximum operating speed. Gust, compressibility and dynamic effects are excluded.
- Horizontal-tail volume is `V_H=S_t*l_t/(S*c_bar)`. The neutral point is `x_np=x_ac_w+c_bar*eta_t*(a_t/a_w)*(1-d_epsilon/d_alpha)*V_H`, and static margin is `(x_np-x_cg)/c_bar`. Wing and tail quarter-chord stations are derived from the rendered planform placement, sweep, taper and MAC; tail slope, efficiency and downwash gradient remain supplied inputs.
- The wing structure is a rigid-root Euler-Bernoulli cantilever with constant `E*I`. A supplied limit load factor scales an elliptical lift distribution; numerical integration gives shear, moment, curvature, slope and deflection. Root stress is `sigma=M*c/I`, compared with a supplied allowable stress. Wing self-weight, torsion, shear stress, buckling, joints and aeroelasticity are excluded.

## Phase 4A mission requirements and design feasibility

- Mission requirements are stored in SI as a typed part of the shared aircraft design. The editor may display kilograms or pounds, kilometres or nautical miles, metres or feet, metres per second or knots, and metres per second or feet per minute. Conversions occur only at the UI boundary.
- Validated Phase 4A inputs are aircraft category, required payload, range, cruise speed and altitude, maximum stall speed, maximum takeoff distance, minimum climb rate, maximum operating speed and a future design objective. Cruise altitude is limited to the implemented ISA troposphere, 0–11,000 m. Maximum operating speed must exceed the maximum permitted stall speed.
- Payload margin is `m_payload,current - m_payload,required`, using the existing component mass model. This checks the modeled payload entry; it does not estimate structural payload capacity.
- Cruise-point, climb and range checks reuse the existing performance calculation at the requested ISA altitude and true airspeed. The cruise point passes only when inputs are valid, required level-flight `CL` does not exceed the supplied `CLmax`, and excess-power climb is nonnegative. Cruise margin is reported as excess climb capability, not maximum-speed or ceiling margin.
- Climb margin is `ROC_calculated - ROC_required` at the requested cruise point. It is a point estimate, not an optimized climb schedule.
- Still-air range margin is `R_calculated - R_required`. Range is not evaluated when the requested cruise point cannot sustain level flight or performance inputs are invalid. The existing constant-speed, constant-altitude, constant-mass energy model and its limitations remain unchanged.
- Stall margin is `Vs,max - Vs_calculated`, using the existing steady 1-g sea-level true-airspeed relation and supplied `CLmax`. Positive constraint margins pass; negative margins fail.
- Takeoff distance is always not evaluated because no ground-roll, thrust-versus-speed, rolling-resistance, rotation or obstacle-clearance model exists. Aircraft category and design objective are recorded context only; no category-specific regulations, statistical sizing, or optimization are performed.
- Invalid mission inputs make all dependent feasibility results not evaluated. Unsupported requirements remain visible with a limitation instead of receiving fabricated values.

## M4.3 aircraft constraint analysis

- The analysis uses wing loading `x=W/S` in N/m² on the horizontal axis and installed shaft power loading `Pshaft/W` in W/N on the vertical axis. SI is authoritative. Aviation display units are lbf/ft² and hp/lbf.
- Design inputs and results use schema version 1. Each edit increments an in-memory design revision. Constraint results identify the schema, design revision, model ID/version, validity, assumptions, warnings, and sources. Project persistence and schema migration are not implemented yet.
- The stall constraint is `W/S <= 0.5*rho0*Vs,max^2*CLmax`, using ISA sea-level density and the supplied aircraft `CLmax`.
- For a flight condition with `q=0.5*rho*V²`, `CL=x/q`, induced factor `k=1/(pi*e*AR)`, and `CD=CD0+k*CL²`, the level-flight drag ratio is `D/W=q*CD/x`.
- Required propulsive power loading is `Pprop/W=V*D/W`. Required installed shaft power loading is `Pshaft/W=(Pprop/W)/eta_p`. The minimum climb constraint adds `ROCmin/eta_p` to the level-flight shaft-power loading. Cruise and climb use the requested cruise true airspeed and ISA altitude.
- The service-ceiling constraint follows the FAA convention of a 100 ft/min (0.508 m/s) steady climb. For constant shaft power and the parabolic polar, minimum power occurs at `CL_mp=sqrt(3*CD0/k)`; `V_mp=sqrt(2*x/(rho*CL_mp))`. Required shaft `P/W` is level-flight shaft `P/W + 0.508/eta_p` at the requested service-ceiling altitude. The curve is not evaluated if `CL_mp` exceeds supplied `CLmax`.
- Installed shaft power is assumed fully available at altitude because AeroForge has no engine/motor/propeller derating map. Altitude changes ISA density and aerodynamic power required; it does not change available shaft power in this model. This is an explicit limitation, not an inferred propulsion capability.
- The attached-flow domain is limited to Mach 0.3, positive bounded inputs, and the supplied `CLmax`. The displayed conceptual search domain is 100–3000 N/m² and 0–30 W/N. “No region” means no evaluated-feasible point in that displayed domain, not proof that no aircraft can satisfy the mission.
- The shaded region satisfies every evaluated constraint: it lies left of the stall limit and above the maximum cruise, climb, and supported service-ceiling power curve. A point's governing constraint is stall when the stall limit is violated; otherwise it is the evaluated power curve requiring the greatest shaft `P/W`.
- Positive numerical margin passes: stall margin is `(W/S)_max-x`; power margin is selected installed shaft `P/W` minus required shaft `P/W`.
- Takeoff distance remains not evaluated because thrust-versus-speed, rolling resistance, rotation, and obstacle-clearance models do not exist. Therefore a point that passes every plotted constraint is labeled evaluated-feasible but overall indeterminate, never overall feasible.
- Service-ceiling provenance: FAA Airplane Flying Handbook glossary, “Service ceiling,” https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/20_afh_glossary.pdf.

## M4.4 iterative preliminary aircraft sizing

- Inputs are the M4.3 selected design point `x=W/S` and `p_i=P_installed,shaft/W`, mission requirements, explicit fixed component masses, reserve fraction, propulsion-specific energy data, and numerical controls. Current aircraft geometry is not modified.
- At each mass estimate `m_n`, weight is `W_n=m_n*g`. Required wing area and installed shaft power after closure are `S=W/x` and `P_installed,shaft=p_i*W`. Mass and weight remain dimensionally distinct.
- The existing level-flight parabolic-polar model supplies cruise shaft power loading `p_c`. Nominal cruise duration is `t=R/V`, and nominal mission shaft energy is `E_mission=p_c*W*t`. This is a constant-mass, steady, level, still-air cruise estimate.
- Electric sizing uses user-supplied effective shaft-deliverable battery specific energy `e_b` in J/kg: `m_battery=E_mission/[e_b*(1-r)]`. The effective property includes pack-to-shaft losses; AeroForge does not silently introduce a motor/controller efficiency.
- Fuel sizing uses user-supplied brake-specific fuel consumption `c_b` in kg/J of shaft energy: `m_fuel=E_mission*c_b/(1-r)`. No engine map, altitude derating, or fuel-flow schedule is inferred.
- Reserve `r` is a fraction of total stored capacity unavailable to the nominal mission. Thus total shaft-energy-equivalent capacity is `E_total=E_mission/(1-r)` and reserve capacity is `E_total-E_mission`.
- Fixed empty mass is the sum of explicit airframe, propulsion, and fixed-equipment inputs. No undocumented statistical empty-mass fraction is used. Target takeoff mass is `F(m_n)=m_empty+m_payload+m_energy(m_n)`.
- Damped fixed-point iteration is `m_(n+1)=m_n+lambda*[F(m_n)-m_n]`, with user-selected `0<lambda<=1`, absolute mass tolerance, and iteration limit. The complete signed residual history is retained. A second user-selected initial mass runs through the same solver for sensitivity.
- The energy-storage mass fraction must be finite and below one. Nonpositive properties, negative masses, invalid design points, non-finite states, excessive mass, violated M4.3 constraints, and exhausted iteration limits produce explicit incomplete, infeasible, or non-converged states.
- A converged result remains mission-indeterminate because takeoff is mandatory and unevaluated. Cruise-only energy excludes takeoff, climb, descent, taxi, loiter, wind, fuel-mass depletion, and altitude-dependent propulsion availability.
- Model provenance is internal analytical power and constraint equations plus clearly labeled user-supplied assumptions. No aircraft-specific empirical coefficient source is claimed.

## M4.5 verification status

- The M4.2–M4.4 deterministic equations are independently checked in `docs/BENCHMARKS.md` using versioned inputs and expected values that are not generated by the production solver.
- Analytical checks cover atmosphere, stall, cruise/climb/service-ceiling power, wing/power sizing, electric and fuel closure, reserve, residuals, convergence controls, failure states, extremes, and unit invariance.
- The NASA TERA comparison verifies direct dimensional wing-loading and motor-power-loading calculations against published MTOW, area, and power. It does not validate AeroForge's complete mass or battery closure because the source's full empty-mass, aerodynamic, and segment inputs are not available.
- NASA's parametric battery study includes climb/descent/reserve segments and state-of-charge, voltage, current, and end-of-mission power limits. M4.4 is deliberately a simpler effective-energy model and must not inherit the NASA study's feasibility claims.
- No production equation was tuned to benchmark data. The only production refactor extracts `S=W/(W/S)` and `P=(P/W)W` into a pure helper reused by the sizing solver and regression tests.

## M4.6 provisional aircraft candidate

- Generation requires a converged M4.4 result tied to the current design revision. Takeoff mass, required wing area, installed shaft power, and fuel/battery mass must be positive and finite. Non-converged, infeasible, incomplete, stale-revision, or invalid results are blocked.
- For required wing area `S`, user-selected aspect ratio `AR`, and taper `lambda`, the trapezoidal preview uses `b=sqrt(AR*S)`, `c_root=2S/[b(1+lambda)]`, and `c_tip=lambda*c_root`. The provisional validity bounds are `3 <= AR <= 20` and `0 < lambda <= 1`; these are input guards, not certification limits.
- Only span, root chord, taper, takeoff mass, installed shaft power, payload mass, and energy-storage mass are populated from sizing. Under schema v2 the provisional wing is deliberately rebuilt as a two-station trapezoid while preserving global leading-edge sweep, dihedral, tip twist, root airfoil and placement. Existing fuselage, empennage, structure, propulsion efficiency, component stations, and other unsupported properties are copied unchanged rather than synthesized.
- The preview is a detached `AircraftDesign` copy and is never written to authoritative state. A source fingerprint covers design revision and mission, sizing model/status/results/design point, propulsion branch, aspect ratio, and taper ratio; any change marks an existing candidate stale.
- M4.3 constraint margins/statuses and M4.4 assumptions, sources, warnings, and mission status are preserved. Mandatory unevaluated takeoff therefore keeps the candidate mission-indeterminate. The preview is not a validated complete aircraft, and no integration, structural, stability, control, landing-gear, or packaging checks are implied.

## M5.1 multi-section wing geometry

- `AircraftDesign` schema version 2 contains one authoritative wing model, version 2. Each station defines `y` span position, local chord `c`, leading-edge `x_LE`, geometric twist, and an airfoil identifier. Each section connects two adjacent named stations and defines its local dihedral. Lengths use metres and angles use explicitly named degrees.
- Geometry uses the existing right-handed aircraft-fixed axes: `x` aft, `y` starboard, `z` up. Leading-edge positions are absolute aircraft `x` coordinates. Twist rotates about the local quarter-chord; positive rotation follows the renderer's existing section convention. Reference planform properties are analytical and do not depend on render tessellation.
- A symmetric wing stores the starboard/source half at nonnegative `y`, beginning at `y=0`; it is mirrored about the `x-z` plane. An asymmetric wing stores the complete strictly increasing signed-`y` chain from port to starboard and must include a station at `y=0`. The configured `verticalPositionM` is the root-plane height.
- For adjacent stations `i` and `i+1`, `Delta y=y_(i+1)-y_i > 0`. Chord, leading edge, twist, and section height are linearly interpolated in `y`. Height propagates as `z_(i+1)=z_i+Delta y tan(Gamma_i)`, where `Gamma_i` is local dihedral. For a symmetric source half, mirroring produces equal tip heights and opposite signed `dz/dy` on the port half.
- The projected section area is `S_i=Delta y(c_i+c_(i+1))/2`. “Projected” means the `x-y` planform; dihedral does not increase this reference area. Total projected area is `S=sum(S_i)` after symmetry expansion, total span is `b=y_max-y_min`, and `AR=b^2/S`.
- The mean aerodynamic chord is integrated exactly for piecewise-linear chord: `MAC=[sum Delta y(c_i^2+c_i c_(i+1)+c_(i+1)^2)/3]/S`. This is the reference chord length, not an average of station chords.
- The reference quarter-chord location is `x_MAC/4=[sum integral c(y)(x_LE(y)+0.25c(y))dy]/S`; each integrand is quadratic and is integrated exactly. The equivalent MAC leading edge is `x_LE,MAC=x_MAC/4-0.25 MAC`. The span reference is the chord-area first moment; symmetric wings report its positive semi-span magnitude, while asymmetric wings retain the signed centroid.
- Section results expose projected span/area, taper, leading-edge sweep, local dihedral, section MAC, section MAC span station, and leading-edge/quarter-chord positions. A pure span-query function returns interpolated chord, leading edge, quarter chord, height, twist, and airfoil identifier for future lattice generation.
- Validation rejects unsupported versions, fewer than two stations, nonfinite coordinates, nonpositive chords, empty/duplicate identifiers, empty airfoils, unordered stations, twist or dihedral at or beyond 89 degrees, invalid symmetry topology, and sections that do not connect every adjacent station exactly once.
- Schema-v1 migration maps the old trapezoid to root and tip stations at `y=0` and `y=b/2`; `c_tip=lambda c_root`, `x_LE,tip=x_LE,root+(b/2)tan(Lambda_LE)`, and the old dihedral/tip twist/airfoil/placement are retained. No second legacy planform is stored.
- M5.1 does not add control surfaces, an advanced station editor, VLM panels, aerodynamic load prediction, takeoff analysis, or optimization. Per-station airfoil identifiers are geometry metadata only; no polar is inferred.

## M5.2 interactive wing editing

- Editor operations transform the authoritative schema-v2 `WingGeometry`; the station table, analytical metrics, and 3D loft do not keep independent planform values. A candidate change is committed only after the M5.1 topology and physical validation succeeds.
- Insertion linearly interpolates chord, leading-edge position, twist, and section height at the new span station and splits the original section. Duplication creates a nearby station within the selected adjacent interval. Add-outboard extrapolates a finite positive-chord station from the outermost section. Removal reconnects the surviving neighbors. These are geometry-editing rules, not aerodynamic assumptions.
- Changing to asymmetric geometry expands the current symmetric wing to its explicit port-to-starboard physical stations. Changing back retains the root and starboard half and restores analytical mirroring. Asymmetric edits may therefore represent unequal planforms, but no asymmetric aerodynamic loads, lateral stability, or structural response are inferred.
- Leading-edge sweep shown for a section is derived from its adjacent station coordinates, `Lambda_LE=atan2(Delta x_LE, Delta y)`. Editing sweep moves only that section's outboard leading edge. Dihedral remains a section property; twist and airfoil identifier remain station properties.
- Undo stores validated in-session wing snapshots; reset restores the default schema-v2 wing. Neither is project persistence. Selection, markers, dimension annotations, and engineering camera views are visualization state only and do not affect geometry or metrics.
- Live span, projected area, aspect ratio, MAC, and reference locations use the analytical M5.1 equations after every accepted edit. The renderer lofts the same expanded physical stations, so render tessellation and annotations cannot change reference properties.
- Airfoil editing is restricted to the NACA four-digit identifiers currently supported by the loft generator. An identifier selects section coordinates only; it does not supply a polar. Control surfaces, VLM, complex-wing aerodynamic validity, takeoff analysis, and optimization remain outside M5.2.

## Later physics
- Aerodynamics: add sourced airfoil polars, lifting-line or VLM, geometry-sensitive spanwise loads and component drag buildup. VLM is inviscid and is not a stall/viscous drag model.
- Structures: add geometry-varying stiffness, wing self-weight, torsion, shear stress and validated aerodynamic load transfer; later buckling, modal, fatigue and FEA comparison.
- Performance/propulsion: add propulsion-specific maps, changing mass/energy state, takeoff integration and wind-aware missions.
- Stability: add trim, control authority, sourced aerodynamic derivatives and later linearized eigenmodes.
- Weight: empirical or component-based estimates with applicability and source; distinguish mass/force; iterate mass closure.
- Optimization: bounded design variables such as span, area, taper, power, spar sizing. Minimize fuel/energy or mass under range, stall, takeoff, stress, static margin and other justified constraints. Start with parameter sweeps; later constrained numerical algorithms and Pareto fronts. Never label an infeasible design as optimized.

## Limits
These are preliminary model proposals, not a complete derivation or an airworthiness analysis. Document source, assumptions, valid regime, uncertainty and benchmarks before releasing a model. Do not silently implement arbitrary coefficients or build-critical dimensions. Advanced models may use AeroSandbox/SciPy rather than reinventing solvers.
