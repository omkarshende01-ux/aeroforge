# Project context — consolidated conversation handoff

## Vision
AeroForge / Aircraft Engineering Studio is a modern browser-based combination of the conceptual-design workflow of OpenVSP, airfoil/aerodynamic analysis associated with XFLR5, preliminary structural and performance analysis, and mission-driven optimization. It is intended as a serious aerospace/mechanical engineering portfolio project, not just a decorative dashboard or flight simulator.

The owner wants to use AI coding agents to build it and personally validate the engineering. Target initial scope: conventional subsonic propeller aircraft and fixed-wing UAVs, with other configurations (gliders, transports, business jets, experimental designs) deferred. Initial deployment is local on Windows; later public web demo with GitHub and Vercel. No need for multiple AI subscriptions. Codex is the preferred starting agent; Cursor/Claude Code are optional alternatives, Replit is an online-only alternative. Generic website/game builders are less suitable for a numerical engineering application.

## Design workflow
Mission requirements → preliminary weight/wing/power sizing → parametric geometry → aerodynamics/propulsion/structures/stability → flight performance → constrained optimization → reports and export.

| Module | Inputs | Outputs |
|---|---|---|
| Mission | Payload, range, cruise speed/altitude, takeoff distance | Design constraints |
| Weight | Component masses, materials, payload, energy storage | Empty and takeoff mass estimates |
| Geometry | Span, chords, taper, sweep, twist, dihedral, fuselage, tail, airfoil | 3D surfaces, planform, MAC |
| Aerodynamics | Geometry, speed, density, angle of attack | CL, CD, CM where supported, L/D, span loads |
| Propulsion | Power/thrust, efficiency, propulsion type | Power and energy/fuel use |
| Structures | Loads, spar geometry, material properties | Shear, moment, stress, deflection, safety margins |
| Stability | CG, tail, aerodynamic derivatives | Neutral point, static margin; later dynamic modes |
| Performance | Configuration and atmospheric conditions | Stall, climb, range, endurance, takeoff, V-n envelope |
| Optimization | Bounded design variables, objectives, constraints | Feasible trade studies and optimized candidate designs |
| Export | Design state, model settings, results | JSON, engineering report; geometry export later |

## Interface
Professional CAD-style workspace, left module navigation, central real 3D viewport, right parameter inspector, bottom analysis panel. Orbit/pan/zoom, top/front/side/isometric views. Real geometry generated from parameters, not fixed decorative aircraft. Live derived quantities and clear units. Eventually include constraints diagram, CL-alpha, drag polar, spanwise lift, shear and moment, V-n, sensitivity and Pareto plots. Save/load project data and report export are later enhancements.

## Illustrative design examples (not requirements or validated aircraft)
- Wing span 12 m, root chord 2 m, taper 0.5, leading-edge sweep 10 deg, mass 1200 kg, CLmax 1.5, sea-level density 1.225 kg/m^3. Trapezoidal planform gives S=18 m^2, AR=8, MAC=1.55556 m, tip chord=1 m. CLmax is an assumed input, not a prediction.
- Example mission: four passengers, range 1000 nmi, cruise 150 kt at 10000 ft, stall limit 55 kt, takeoff distance limit 500 m; minimize fuel. This is a demonstration target only; feasibility has not been established.

## Agent workflow
Eight roles are planned, not eight separate AI models: architect, frontend, geometry, aerodynamics, structures, performance/stability, optimization, validation. Begin with architect, then at most three specialist sessions (frontend, geometry, validation) after shared interfaces are established. Later activate only the specialists needed. The owner is chief engineer. Use isolated branches/worktrees and lead integration. See agents/.

## Reference candidates
- Raymer, Aircraft Design: A Conceptual Approach
- Anderson, Introduction to Flight
- Roskam, Airplane Design
- Megson, Aircraft Structures for Engineering Students
- Etkin, Dynamics of Flight
- NASA OpenVSP: https://openvsp.org/ ; https://www.nasa.gov/reference/openvsp-vspaero-basics/
- AeroSandbox: https://github.com/peterdsharpe/AeroSandbox
- UIUC airfoil coordinates: https://m-selig.ae.illinois.edu/ads/coord_database.html
- JSBSim (optional future flight dynamics): https://github.com/JSBSim-Team/jsbsim
- MATLAB and ANSYS for independent verification where available.

References are candidates, not claims of validation. Verify applicable equations, editions, licenses and data provenance during development.

## Portfolio objective
Demonstrate real numerical methods, aerodynamic/structural reasoning, constrained optimization and full-stack development. Only claim capabilities actually implemented and validated. A public interactive demonstration, source code, model documentation and reproducible benchmarks are more valuable than a visually polished interface with invented physics.
