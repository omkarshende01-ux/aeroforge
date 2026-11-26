# AeroForge

A browser-based aircraft conceptual-design workspace built with React, TypeScript, Vite, React Three Fiber, Zustand and Vitest. The application currently implements parametric geometry and preliminary subsonic aerodynamic estimates.

## Run locally

Requires Node.js LTS.

```powershell
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173/`.

## Validate

```powershell
npm run typecheck
npm test
npm run build
```

## Implemented scope

- Parametric wing, fuselage and empennage geometry with a Three.js viewport.
- NACA four-digit airfoil sections and trapezoidal-wing metrics.
- ISA troposphere or manual density flight conditions.
- Linear finite-wing lift, parabolic drag polar, lift/drag forces and an analytical elliptical span-load estimate.
- Component mass/CG accounting, mission power and range estimates, static margin, a simplified maneuver envelope and constant-EI wing-beam loads.
- A dedicated mission workspace with typed requirements, SI/aviation-unit editing, validation, and pass/fail/not-evaluated feasibility margins from existing models.
- An interactive wing-loading versus installed shaft-power-loading constraint diagram with stall, cruise, climb, supported service-ceiling curves, candidate selection, and explicit takeoff limitations.
- A preliminary sizing workspace with damped mass closure, electric/fuel cruise-energy bookkeeping, required wing area and installed shaft power, convergence/sensitivity plots, mass breakdown, and explicit limitations.
- Reproducible analytical and published-data verification fixtures documented in `docs/BENCHMARKS.md`.

All models are preliminary conceptual estimates. AeroForge does not provide CFD, viscous airfoil polars, lifting-line/VLM results, detailed FEA, aeroelasticity or certification evidence. Model equations and limitations are documented in `docs/ENGINEERING_MODELS.md`; milestone status is tracked in `PROGRESS.md`.
