# Airfoil coordinate and aerodynamic polar data

## Scope and versioning

M6.1 adds independently versioned model-v1 contracts for the airfoil library, imported geometry, and aerodynamic polar datasets. The aircraft remains schema v3 and stores stable airfoil identifiers at lifting-surface stations. The library resolves an identifier to either the existing deterministic NACA four-digit generator or registered imported coordinates. No imported polar changes the aircraft-level analytical aerodynamic assumptions automatically.

Unknown source fields, operating conditions, transition data, convergence state, and coefficients remain absent (`undefined`) rather than being estimated. `experimental`, `computational`, `user-supplied`, and `generated` are distinct source classifications; importing a table never promotes it to experimental truth.

## Coordinate convention

- Coordinates are dimensionless `(x/c,z/c)`, with `x/c=0` at the detected leading edge, `x/c=1` at the detected trailing edge, and positive `z/c` on the upper side.
- Stored upper and lower surfaces are each ordered leading edge to trailing edge. The closed rendering contour is upper trailing edge to leading edge, then lower leading edge to trailing edge.
- Import normalization translates the detected leading edge to `(0,0)` and divides x and z by the detected chord `(max x-min x)`. It does not rotate, smooth, fit, close, or otherwise repair geometry.
- Consecutive identical points are removed with a warning. Non-adjacent duplicated interior points, non-monotonic separated surfaces, nonfinite coordinates, zero chord, nonpositive interior thickness, and self-intersection are rejected.
- Rendering and analysis use the existing cosine chord stations. Imported ordinates are linearly evaluated on each stored surface at those stations; the original points and raw source text remain unchanged.

## Coordinate import formats

### Selig DAT

The first non-coordinate line may contain a name. Subsequent rows contain whitespace-separated `x z` pairs in one contour, ordered from one trailing edge through the leading edge to the other trailing edge. The importer identifies the minimum-x leading-edge row, separates the two sides, determines upper/lower by ordinate, and validates both surfaces.

### Lednicer DAT

The name is followed by a row containing integer upper and lower point counts. The declared upper rows then lower rows use whitespace-separated `x z` pairs. Either surface direction is accepted, but each surface must become monotonic after an explicit whole-surface reversal.

### AeroForge coordinate CSV

Required header names are:

```text
surface,x_over_chord,z_over_chord
```

`surface` is exactly `upper` or `lower` (case-insensitive). Each side needs at least three finite points.

## Polar convention and formats

Angles of attack are degrees. Reynolds and Mach numbers are dimensionless. `CL`, `CD`, and `CM` are dimensionless two-dimensional section coefficients. The moment reference stores its chord location separately from its sign convention; supported signs are positive nose-up, positive nose-down, or unknown. A quarter-chord reference is `x/c=0.25`. Missing coefficients are allowed and remain unknown. Negative `CD`, nonfinite values, invalid Reynolds/Mach, duplicate angle-of-attack points within one operating condition, invalid transition fractions, and inconsistent moment-reference declarations are rejected.

### AeroForge polar CSV

`alpha_deg` is required. Optional columns are `reynolds`, `mach`, `cl`, `cd`, `cm`, `converged`, `transition_upper_x_over_chord`, and `transition_lower_x_over_chord`. Blank optional cells remain unknown. Rows are grouped into separate datasets by their exact Reynolds/Mach values, allowing several operating conditions for one airfoil without interpolation.

### XFOIL polar text

The importer reads the conventional `alpha CL CD ... CM Top_Xtr Bot_Xtr` table and `Re =` / `Mach =` header values. Readable table rows are stored as computational predictions. Unreadable rows after the header are skipped with a non-convergence warning; no coefficient is synthesized for them. Raw source text is retained.

## Provenance and applicability

Geometry and polar records may retain source name, URL, citation, license, original file name, import timestamp, notes, generation method, and model applicability. Redistribution permission must be verified before adding any external dataset to the repository. The M6.1 automated fixtures are synthetic project-authored parser fixtures, not sourced measurements.

## Limitations

M6.1 provides storage, validation, preview, selection, and exact-condition data inspection only. It does not implement XFOIL, CFD, VLM, stall prediction, Reynolds/Mach interpolation, polar extrapolation, automatic 2-D-to-3-D conversion, or automatic replacement of the existing aircraft-level `CL`, `CD`, or `CM` assumptions. Those distinctions remain explicit in the interface and contracts.
