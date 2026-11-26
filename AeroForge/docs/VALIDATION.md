# Verification & validation plan

No implementation or validation has been performed in this planning package.

## Phase 1 benchmarks
- b=12 m, cr=2 m, ct=1 m gives S=18 m^2, AR=8, MAC=14/9 m, tip chord=1 m.
- Rectangular wing lambda=1 gives MAC=cr, S=b*cr.
- For m=1200 kg, S=18 m^2, rho=1.225 kg/m^3, CLmax=1.5, independently compute Vs=sqrt(2*1200*9.80665/(1.225*18*1.5)) m/s; knots conversion 1 m/s≈1.94384 kt.
- Test scaling, symmetry, sweep/dihedral/twist, NACA 0012 symmetry, finite coordinates, invalid inputs, units and persistence as applicable.
- Verify 3D geometry matches numeric parameters; inspect standard views and edge cases.

## Later tests
Compare finite-wing/induced drag models against analytical results; use published or OpenVSP/VSPAERO benchmark cases for advanced aero; test beam response against independent cantilever solutions; compare performance estimates to published aircraft data with explicitly matched conditions; verify optimization using known feasible/infeasible problems. Verify numerical convergence where applicable.

## Phase 2 implemented benchmarks
- ISA sea level: 288.15 K, 101325 Pa and approximately 1.225 kg/m^3. ISA at 11 km: 216.65 K, approximately 22632 Pa and 0.3639 kg/m^3.
- For AR=8, `a0=2*pi /rad`, `e=0.8`, alpha=4 deg and alpha0=-2 deg, independently evaluate `a`, `CL`, induced `CD`, total `CD`, dynamic pressure, lift and drag from the documented equations.
- Verify that the analytical elliptical load is symmetric, is zero at both tips, reaches `4L/(pi*b)` at the centerline and integrates analytically to total lift.
- Invalid atmosphere, negative speed, nonpositive lift slope or efficiency, negative CD0, CL beyond supplied CLmax and Mach above 0.3 must produce explicit invalid results or warnings.

## Phase 3 implemented benchmarks
- Verify component mass and CG against an independently summed mass moment table.
- At a fixed density and speed, independently solve level-flight CL, parabolic-polar drag, shaft power, excess-power climb, endurance and still-air range.
- Independently calculate tail volume, finite-wing lift slope, neutral point and static margin from supplied stations and derivatives.
- For total elliptical wing lift `L` and span `b`, each half-wing root shear is `L/2` and root moment is `L*b/(3*pi)`. Compare the numerical beam integration with these analytical values and require positive tip deflection.
- Verify maneuver-envelope values remain inside the supplied aerodynamic and structural limits.

Keep a benchmark log including inputs, reference source, assumptions, independent expected result, tolerance, actual result, status and software version. Use independent calculations rather than testing a function against itself. Report discrepancies rather than adjusting coefficients simply to match a target. Run npm tests, typecheck and production build on each integrated milestone.
