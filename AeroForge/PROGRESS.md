# AeroForge Progress

## Completed

- Phase 1: strict TypeScript/Vite foundation, shared aircraft schema, CAD-style workspace, editable wing/fuselage/tail geometry, NACA four-digit sections, orbit/pan/zoom viewport, wing metrics and conditional stall-speed estimate.
- Phase 2: ISA troposphere and manual density modes; supplied aerodynamic assumptions; finite-wing lift slope; linear pre-stall CL; parabolic drag polar; dynamic pressure, Mach, lift, drag and L/D; analytical elliptical span-load display.
- Phase 3: component mass/CG accounting; mission range and climb constraints; shaft-power, endurance and still-air range estimates; tail volume, neutral point and static margin; simplified maneuver envelope; constant-EI cantilever wing loads, stress and deflection.
- Geometry audit: unified `x` aft / `y` starboard / `z` up transforms; closed wing and tail airfoil lofts; rounded-nose/cabin/tapered-tail fuselage; explicit component stations; corrected normals and assembly; orthographic standard views; responsive viewport and overflow fixes.
- Verification: geometry invariants plus existing engineering tests cover airfoils, component bounds, symmetry, normals, atmosphere, aerodynamics and multidisciplinary benchmarks. Typecheck and production build pass.

## Current status

Phase 3 baseline is complete. Engineering equations, assumptions and validity limits are documented in `docs/ENGINEERING_MODELS.md` and benchmarks in `docs/VALIDATION.md`. Further phases require owner approval.

## Known issues and limitations

- Aerodynamic lift slope does not include sweep or compressibility corrections.
- CD0, Oswald efficiency, section lift slope, zero-lift angle and CLmax are supplied assumptions rather than predicted values.
- Span loading is elliptical and does not respond to taper, twist or sweep.
- No airfoil polar import, lifting-line, VLM, CFD, detailed propulsion maps, trim, aeroelasticity, FEA or optimization yet.
- Range excludes wind and changing mass; the maneuver envelope excludes gusts and dynamic effects.
- Wing structure uses constant stiffness and elliptical loading without self-weight, torsion, buckling or joint effects.
- The production JavaScript chunk is about 1 MB; Vite reports a chunk-size warning.
- Fuselage cross-sections are circular and do not yet model a windshield, cabin windows, landing gear or propulsion geometry.

## Next steps

Keep analysis-module development paused. Next geometry work should add reference overlays or higher-fidelity cabin and propulsion shapes only when explicitly requested.
