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

## Later physics
- Aerodynamics: add sourced airfoil polars, lifting-line or VLM, geometry-sensitive spanwise loads and component drag buildup. VLM is inviscid and is not a stall/viscous drag model.
- Structures: add geometry-varying stiffness, wing self-weight, torsion, shear stress and validated aerodynamic load transfer; later buckling, modal, fatigue and FEA comparison.
- Performance/propulsion: add propulsion-specific maps, changing mass/energy state, takeoff integration and wind-aware missions.
- Stability: add trim, control authority, sourced aerodynamic derivatives and later linearized eigenmodes.
- Weight: empirical or component-based estimates with applicability and source; distinguish mass/force; iterate mass closure.
- Optimization: bounded design variables such as span, area, taper, power, spar sizing. Minimize fuel/energy or mass under range, stall, takeoff, stress, static margin and other justified constraints. Start with parameter sweeps; later constrained numerical algorithms and Pareto fronts. Never label an infeasible design as optimized.

## Limits
These are preliminary model proposals, not a complete derivation or an airworthiness analysis. Document source, assumptions, valid regime, uncertainty and benchmarks before releasing a model. Do not silently implement arbitrary coefficients or build-critical dimensions. Advanced models may use AeroSandbox/SciPy rather than reinventing solvers.
