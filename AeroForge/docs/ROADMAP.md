# Roadmap

Only Phase 1 is approved for initial implementation. Prior estimates of an eight-week prototype are illustrative, not commitments.

1. Foundation and geometry: shared schema, unit conventions, CAD-style interface, mathematical wing/fuselage/tail, NACA airfoils, live planform metrics and conditional stall estimate. Architect + frontend + geometry + validation.
2. Aerodynamics (implemented baseline): ISA/manual atmosphere, linear pre-stall finite-wing model, parabolic drag polar and analytical elliptical span-load estimate. Airfoil polar import and geometry-sensitive lifting-line/VLM remain later work. Architect + aerodynamics + frontend + validation.
3. Preliminary sizing and multidisciplinary analysis (implemented baseline): mission range/climb constraints, component mass and CG, shaft-power performance, energy-based endurance/range, static margin, simplified maneuver envelope and constant-EI wing beam under elliptical limit load. Higher-fidelity propulsion, trim and load transfer remain later work.
4. Optimization: parameter sweeps, sensitivity, feasibility, constrained search, eventually Pareto tradeoffs. Optimization + aero/performance + validation.
5. Public release: project persistence, report/geometry exports as supported, benchmark documentation, reproducible examples, GitHub and Vercel; Python service if needed.

At each milestone: freeze shared interfaces first, create disjoint tasks, independently review engineering equations and tests, integrate, run build/tests, update docs, demo to owner before proceeding.
