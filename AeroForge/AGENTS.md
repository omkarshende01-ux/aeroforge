# AeroForge — repository instructions

AeroForge is a browser-based conceptual aircraft design and multidisciplinary optimization platform, not a game or a certified design tool. The human owner is chief engineer and approves technical decisions.

Read `docs/PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/ENGINEERING_MODELS.md`, `docs/ROADMAP.md`, and `docs/VALIDATION.md` before changing architecture or engineering models. `agents/` contains optional specialist task briefs, not automatically running agents.

- Start with Phase 1 only: a functioning parametric geometry editor for conventional subsonic aircraft. Do not implement CFD, FEA, authentication, payments, databases, or AI APIs yet.
- Use strict TypeScript; React/Vite; Three.js/React Three Fiber; Zustand; Tailwind CSS; Vitest. Plotly.js when plots are useful. Defer Python/AeroSandbox/FastAPI until justified.
- Keep physics, shared design schema, rendering, and UI separate. SI units internally, with explicit conversion at UI boundaries. Document axes, signs, references, and angle units. Never guess build-critical dimensions or present assumptions as measured facts.
- All engineering outputs must come from actual deterministic calculations. Clearly distinguish user inputs, illustrative defaults, model estimates, unavailable results, and validated values. Do not invent coefficients, sources, tests, or results. Do not claim flightworthiness or certification.
- Prefer minimal dependencies, small reviewed changes, independent tests, and meaningful commit messages. Run the build, typecheck, and tests. Report failures and unresolved assumptions.
- The lead architect owns shared interfaces and integration. Delegate only disjoint tasks; use separate Git worktrees or branches for concurrent edits. Review changes before merging. Do not overwrite existing user work.
- Keep the roadmap and model documentation current. Verify references and applicable licenses before integrating external data or code.
