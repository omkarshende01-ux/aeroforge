import type {
  AerodynamicPolarDataset, AirfoilIdentifier, AirfoilLibrary, DataProvenance, GeometryGenerationMethod, ImportedAirfoilGeometry,
  ImportMessage, ImportResult, MomentReference, NormalizedAirfoilPoint, PolarGenerationMethod, PolarPoint,
} from '../domain/airfoilData';
import { AERODYNAMIC_POLAR_MODEL_VERSION, AIRFOIL_GEOMETRY_MODEL_VERSION, AIRFOIL_LIBRARY_MODEL_VERSION } from '../domain/airfoilData';
import { naca4PointAtChordFraction, naca4SurfaceCoordinates, parseNaca4Designation, type AirfoilSurfaceSide } from './airfoil';

export type CoordinateImportFormat = 'selig-dat' | 'lednicer-dat' | 'csv';
export type PolarImportFormat = 'csv' | 'xfoil';
type MutablePoint = [number, number];
const tolerance = 1e-9;

function finite(value: number): boolean { return Number.isFinite(value); }
function pointEqual(a: NormalizedAirfoilPoint, b: NormalizedAirfoilPoint): boolean { return Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance; }
function parseNumbers(line: string): number[] { return line.trim().split(/[\s,;]+/).map(Number); }
function message(severity: ImportMessage['severity'], code: string, text: string, line?: number): ImportMessage { return { severity, code, message: text, line }; }
function cleanId(id: string): string { return id.trim().replace(/\s+/g, ' '); }

function removeConsecutiveDuplicates(points: MutablePoint[], messages: ImportMessage[]): MutablePoint[] {
  return points.filter((point, index) => {
    const duplicate = index > 0 && pointEqual(point, points[index - 1]);
    if (duplicate) messages.push(message('warning', 'duplicate-consecutive-point', 'Removed an exactly repeated consecutive coordinate.'));
    return !duplicate;
  });
}

function segmentIntersection(a: NormalizedAirfoilPoint, b: NormalizedAirfoilPoint, c: NormalizedAirfoilPoint, d: NormalizedAirfoilPoint): boolean {
  const cross = (p: NormalizedAirfoilPoint, q: NormalizedAirfoilPoint, r: NormalizedAirfoilPoint) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const abC = cross(a, b, c); const abD = cross(a, b, d); const cdA = cross(c, d, a); const cdB = cross(c, d, b);
  return abC * abD < -tolerance && cdA * cdB < -tolerance;
}

function selfIntersects(upper: NormalizedAirfoilPoint[], lower: NormalizedAirfoilPoint[]): boolean {
  const contour = [...upper.slice().reverse(), ...lower.slice(1)];
  const segments = contour.map((point, index) => [point, contour[(index + 1) % contour.length]] as const);
  return segments.some(([a, b], i) => segments.some(([c, d], j) => j > i + 1 && !(i === 0 && j === segments.length - 1) && segmentIntersection(a, b, c, d)));
}

function interpolateSurface(points: NormalizedAirfoilPoint[], x: number): number {
  let index = points.findIndex((point) => point[0] >= x - tolerance); if (index <= 0) return points[0][1]; if (index < 0) return points.at(-1)![1];
  const from = points[index - 1]; const to = points[index]; const fraction = Math.abs(to[0] - from[0]) <= tolerance ? 0 : (x - from[0]) / (to[0] - from[0]);
  return from[1] + fraction * (to[1] - from[1]);
}

function normalizeSurfaces(upperInput: MutablePoint[], lowerInput: MutablePoint[], messages: ImportMessage[]): { upper: NormalizedAirfoilPoint[]; lower: NormalizedAirfoilPoint[] } | undefined {
  let upper = removeConsecutiveDuplicates(upperInput, messages); let lower = removeConsecutiveDuplicates(lowerInput, messages);
  if (upper.length < 3 || lower.length < 3) { messages.push(message('error', 'insufficient-points', 'Upper and lower surfaces each require at least three coordinates.')); return undefined; }
  if (upper[0][0] > upper.at(-1)![0]) upper = upper.slice().reverse();
  if (lower[0][0] > lower.at(-1)![0]) lower = lower.slice().reverse();
  if (![...upper, ...lower].every((point) => point.every(finite))) { messages.push(message('error', 'non-finite-coordinate', 'Coordinates must contain only finite numbers.')); return undefined; }
  const minX = Math.min(...upper.map((p) => p[0]), ...lower.map((p) => p[0])); const maxX = Math.max(...upper.map((p) => p[0]), ...lower.map((p) => p[0])); const chord = maxX - minX;
  if (!finite(chord) || chord <= tolerance) { messages.push(message('error', 'degenerate-chord', 'Leading and trailing edges do not define a positive chord.')); return undefined; }
  const leadingPoints = [...upper, ...lower].filter((point) => Math.abs(point[0] - minX) <= tolerance); const leadingZ = leadingPoints.reduce((sum, point) => sum + point[1], 0) / leadingPoints.length;
  const normalize = (point: MutablePoint): NormalizedAirfoilPoint => [(point[0] - minX) / chord, (point[1] - leadingZ) / chord];
  const normalizedUpper = upper.map(normalize); const normalizedLower = lower.map(normalize);
  const monotonic = (points: NormalizedAirfoilPoint[]) => points.every((point, index) => index === 0 || point[0] >= points[index - 1][0] - tolerance);
  if (!monotonic(normalizedUpper) || !monotonic(normalizedLower)) { messages.push(message('error', 'invalid-ordering', 'Each separated surface must be monotonic from leading edge to trailing edge.')); return undefined; }
  if ([normalizedUpper, normalizedLower].some((points) => Math.abs(points[0][0]) > tolerance || Math.abs(points.at(-1)![0] - 1) > tolerance)) { messages.push(message('error', 'incomplete-chord', 'Both surfaces must contain the detected leading and trailing edges.')); return undefined; }
  const signature = new Set<string>();
  for (const point of [...normalizedUpper, ...normalizedLower]) { const key = `${point[0].toPrecision(14)},${point[1].toPrecision(14)}`; if (signature.has(key) && point[0] > tolerance && point[0] < 1 - tolerance) { messages.push(message('error', 'duplicate-point', 'A non-adjacent interior coordinate is duplicated.')); return undefined; } signature.add(key); }
  const samples = Array.from({ length: 49 }, (_, index) => (index + 1) / 50);
  if (samples.some((x) => interpolateSurface(normalizedUpper, x) <= interpolateSurface(normalizedLower, x) + tolerance)) { messages.push(message('error', 'degenerate-thickness', 'Upper and lower surfaces cross or have no positive interior thickness.')); return undefined; }
  if (selfIntersects(normalizedUpper, normalizedLower)) { messages.push(message('error', 'self-intersection', 'The airfoil contour self-intersects.')); return undefined; }
  return { upper: normalizedUpper, lower: normalizedLower };
}

function numericLines(raw: string): { line: number; values: number[] }[] {
  return raw.split(/\r?\n/).map((text, index) => ({ line: index + 1, values: parseNumbers(text) })).filter(({ values }) => values.length >= 2 && values.slice(0, 2).every(finite));
}

function separatedCoordinates(raw: string, format: CoordinateImportFormat, messages: ImportMessage[]): { upper: MutablePoint[]; lower: MutablePoint[] } | undefined {
  if (format === 'csv') {
    const lines = raw.split(/\r?\n/); const headers = lines[0]?.toLowerCase().split(',').map((item) => item.trim()) ?? [];
    const surfaceIndex = headers.indexOf('surface'); const xIndex = headers.indexOf('x_over_chord'); const zIndex = headers.indexOf('z_over_chord');
    if (surfaceIndex < 0 || xIndex < 0 || zIndex < 0) { messages.push(message('error', 'csv-header', 'Coordinate CSV requires surface,x_over_chord,z_over_chord columns.', 1)); return undefined; }
    const upper: MutablePoint[] = []; const lower: MutablePoint[] = [];
    lines.slice(1).forEach((line, offset) => { if (!line.trim()) return; const cells = line.split(',').map((item) => item.trim()); const target = cells[surfaceIndex]?.toLowerCase() === 'upper' ? upper : cells[surfaceIndex]?.toLowerCase() === 'lower' ? lower : undefined; const point: MutablePoint = [Number(cells[xIndex]), Number(cells[zIndex])]; if (!target || !point.every(finite)) messages.push(message('error', 'csv-row', 'Each coordinate row requires surface upper/lower and finite x_over_chord,z_over_chord.', offset + 2)); else target.push(point); });
    return { upper, lower };
  }
  const rows = numericLines(raw);
  if (format === 'selig-dat') {
    if (rows.length < 6) { messages.push(message('error', 'insufficient-points', 'Selig DAT requires a single contour with at least six coordinate rows.')); return undefined; }
    const points = rows.map(({ values }) => [values[0], values[1]] as MutablePoint); const leadingIndex = points.reduce((best, point, index) => point[0] < points[best][0] ? index : best, 0);
    if (leadingIndex === 0 || leadingIndex === points.length - 1) { messages.push(message('error', 'selig-ordering', 'Selig DAT must run from one trailing edge through the leading edge to the other trailing edge.')); return undefined; }
    const first = points.slice(0, leadingIndex + 1).reverse(); const second = points.slice(leadingIndex);
    return first[Math.min(1, first.length - 1)][1] >= second[Math.min(1, second.length - 1)][1] ? { upper: first, lower: second } : { upper: second, lower: first };
  }
  const countRow = rows.find(({ values }) => values.length >= 2 && values[0] >= 3 && values[1] >= 3 && Number.isInteger(values[0]) && Number.isInteger(values[1]));
  if (!countRow) { messages.push(message('error', 'lednicer-counts', 'Lednicer DAT requires integer upper and lower point counts.')); return undefined; }
  const after = rows.filter((row) => row.line > countRow.line); const upperCount = countRow.values[0]; const lowerCount = countRow.values[1];
  if (after.length < upperCount + lowerCount) { messages.push(message('error', 'lednicer-counts', 'Lednicer point counts exceed the available coordinate rows.', countRow.line)); return undefined; }
  return { upper: after.slice(0, upperCount).map((row) => [row.values[0], row.values[1]]), lower: after.slice(upperCount, upperCount + lowerCount).map((row) => [row.values[0], row.values[1]]) };
}

export function importAirfoilCoordinates(rawSource: string, options: { format: CoordinateImportFormat; airfoilId: string; displayName?: string; provenance: DataProvenance }): ImportResult<ImportedAirfoilGeometry> {
  const messages: ImportMessage[] = []; const airfoilId = cleanId(options.airfoilId);
  if (!airfoilId) messages.push(message('error', 'missing-id', 'A unique airfoil identifier is required.'));
  const separated = separatedCoordinates(rawSource, options.format, messages); const normalized = separated && normalizeSurfaces(separated.upper, separated.lower, messages);
  if (!normalized || messages.some((item) => item.severity === 'error')) return { messages };
  const method: Record<CoordinateImportFormat, GeometryGenerationMethod> = { 'selig-dat': 'selig-dat-import', 'lednicer-dat': 'lednicer-dat-import', csv: 'csv-import' };
  const value: ImportedAirfoilGeometry = {
    modelVersion: AIRFOIL_GEOMETRY_MODEL_VERSION, airfoilId, displayName: options.displayName?.trim() || airfoilId,
    coordinateConvention: 'x-over-chord-z-over-chord', contourOrdering: 'upper-te-to-le-lower-le-to-te',
    upperSurface: { ordering: 'leading-edge-to-trailing-edge', points: normalized.upper }, lowerSurface: { ordering: 'leading-edge-to-trailing-edge', points: normalized.lower },
    leadingEdge: [(normalized.upper[0][0] + normalized.lower[0][0]) / 2, (normalized.upper[0][1] + normalized.lower[0][1]) / 2],
    trailingEdgeUpper: normalized.upper.at(-1)!, trailingEdgeLower: normalized.lower.at(-1)!, geometryMethod: method[options.format], provenance: options.provenance, rawSource,
  };
  messages.push(message('info', 'normalized', 'Coordinates were translated and scaled by the detected chord; no smoothing or geometric repair was applied.'));
  return { value, messages };
}

export function airfoilExists(library: AirfoilLibrary | undefined, airfoilId: AirfoilIdentifier): boolean { return Boolean(parseNaca4Designation(airfoilId) || library?.geometries.some((geometry) => geometry.airfoilId === airfoilId)); }
export function airfoilDisplayOptions(library: AirfoilLibrary): { id: string; name: string; source: 'generated' | 'imported' }[] {
  const generated = ['NACA 0012', 'NACA 2412', 'NACA 4412'].map((id) => ({ id, name: id, source: 'generated' as const }));
  return [...generated, ...library.geometries.map((geometry) => ({ id: geometry.airfoilId, name: geometry.displayName, source: 'imported' as const }))];
}

export function airfoilPointAtChordFraction(airfoilId: string, chordFraction: number, side: AirfoilSurfaceSide, library?: AirfoilLibrary): NormalizedAirfoilPoint {
  const generated = parseNaca4Designation(airfoilId); if (generated) return naca4PointAtChordFraction(generated.canonicalId, chordFraction, side);
  const geometry = library?.geometries.find((item) => item.airfoilId === airfoilId); if (!geometry) throw new RangeError(`Airfoil geometry "${airfoilId}" is not registered.`);
  const points = side === 'upper' ? geometry.upperSurface.points : geometry.lowerSurface.points; return [chordFraction, interpolateSurface(points, chordFraction)];
}

export function cosineSampledAirfoilCoordinates(airfoilId: string, intervals: number, library?: AirfoilLibrary): NormalizedAirfoilPoint[] {
  if (parseNaca4Designation(airfoilId)) return naca4SurfaceCoordinates(airfoilId, intervals);
  const upper: NormalizedAirfoilPoint[] = []; const lower: NormalizedAirfoilPoint[] = [];
  for (let index = 0; index <= intervals; index += 1) { const x = (1 - Math.cos(Math.PI * index / intervals)) / 2; upper.push(airfoilPointAtChordFraction(airfoilId, x, 'upper', library)); lower.push(airfoilPointAtChordFraction(airfoilId, x, 'lower', library)); }
  return [...upper.reverse(), ...lower.slice(1, -1)];
}

function parseOptional(cells: string[], index: number): number | undefined { const text = cells[index]?.trim(); if (!text) return undefined; const value = Number(text); return finite(value) ? value : Number.NaN; }
function validatePolarPoint(point: PolarPoint, messages: ImportMessage[], line?: number) {
  if (!finite(point.angleOfAttackDeg)) messages.push(message('error', 'invalid-alpha', 'Angle of attack must be finite degrees.', line));
  for (const [name, value] of [['CL', point.liftCoefficient], ['CD', point.dragCoefficient], ['CM', point.pitchingMomentCoefficient]] as const) if (value !== undefined && !finite(value)) messages.push(message('error', 'invalid-coefficient', `${name} must be finite or explicitly blank.`, line));
  if (point.dragCoefficient !== undefined && point.dragCoefficient < 0) messages.push(message('error', 'negative-drag', 'Drag coefficient cannot be negative.', line));
  for (const value of [point.upperTransitionXOverChord, point.lowerTransitionXOverChord]) if (value !== undefined && (!finite(value) || value < 0 || value > 1)) messages.push(message('error', 'invalid-transition', 'Transition location must be within [0,1] or blank.', line));
}
function validateCondition(reynoldsNumber: number | undefined, machNumber: number | undefined, messages: ImportMessage[]) {
  if (reynoldsNumber !== undefined && (!finite(reynoldsNumber) || reynoldsNumber <= 0)) messages.push(message('error', 'invalid-reynolds', 'Reynolds number must be positive and finite.'));
  if (machNumber !== undefined && (!finite(machNumber) || machNumber < 0)) messages.push(message('error', 'invalid-mach', 'Mach number must be nonnegative and finite.'));
}
function validateDuplicates(points: PolarPoint[], messages: ImportMessage[]) { const seen = new Set<string>(); points.forEach((point) => { const key = point.angleOfAttackDeg.toPrecision(14); if (seen.has(key)) messages.push(message('error', 'duplicate-operating-point', `Duplicate angle of attack ${point.angleOfAttackDeg} deg in one operating-condition dataset.`)); seen.add(key); }); }

export function importPolarData(rawSource: string, options: { format: PolarImportFormat; datasetId: string; airfoilId: string; displayName?: string; provenance: DataProvenance; generationMethod?: PolarGenerationMethod; momentReference?: MomentReference; reynoldsNumber?: number; machNumber?: number }): ImportResult<AerodynamicPolarDataset[]> {
  const messages: ImportMessage[] = []; const datasets: AerodynamicPolarDataset[] = []; const defaultMoment: MomentReference = options.momentReference ?? { axis: 'unknown', signConvention: 'unknown' };
  if (!cleanId(options.datasetId)) messages.push(message('error', 'missing-id', 'A unique polar dataset identifier is required.'));
  if (defaultMoment.axis === 'airfoil-quarter-chord' && defaultMoment.chordFraction !== undefined && Math.abs(defaultMoment.chordFraction - 0.25) > tolerance) messages.push(message('error', 'incompatible-moment-reference', 'Quarter-chord moment reference must use x/c=0.25.'));
  if (defaultMoment.axis === 'specified-chord-fraction' && (defaultMoment.chordFraction === undefined || !finite(defaultMoment.chordFraction) || defaultMoment.chordFraction < 0 || defaultMoment.chordFraction > 1)) messages.push(message('error', 'incompatible-moment-reference', 'A specified moment reference requires a finite chord fraction within [0,1].'));
  if (defaultMoment.axis === 'unknown' && defaultMoment.chordFraction !== undefined) messages.push(message('error', 'incompatible-moment-reference', 'An unknown moment reference cannot declare a chord fraction.'));
  if (options.format === 'csv') {
    const lines = rawSource.split(/\r?\n/); const headers = lines[0]?.toLowerCase().split(',').map((item) => item.trim()) ?? []; const find = (name: string) => headers.indexOf(name);
    const alpha = find('alpha_deg'); const re = find('reynolds'); const mach = find('mach'); const cl = find('cl'); const cd = find('cd'); const cm = find('cm'); const converged = find('converged'); const top = find('transition_upper_x_over_chord'); const bottom = find('transition_lower_x_over_chord');
    if (alpha < 0) messages.push(message('error', 'csv-header', 'Polar CSV requires alpha_deg; optional columns are reynolds,mach,cl,cd,cm,converged and transition locations.', 1));
    const grouped = new Map<string, { reynoldsNumber?: number; machNumber?: number; points: PolarPoint[] }>();
    lines.slice(1).forEach((line, offset) => { if (!line.trim()) return; const cells = line.split(','); const reynoldsNumber = re >= 0 ? parseOptional(cells, re) : options.reynoldsNumber; const machNumber = mach >= 0 ? parseOptional(cells, mach) : options.machNumber; const point: PolarPoint = { angleOfAttackDeg: Number(cells[alpha]), liftCoefficient: cl >= 0 ? parseOptional(cells, cl) : undefined, dragCoefficient: cd >= 0 ? parseOptional(cells, cd) : undefined, pitchingMomentCoefficient: cm >= 0 ? parseOptional(cells, cm) : undefined, upperTransitionXOverChord: top >= 0 ? parseOptional(cells, top) : undefined, lowerTransitionXOverChord: bottom >= 0 ? parseOptional(cells, bottom) : undefined, converged: converged >= 0 && cells[converged]?.trim() ? /^(true|1|yes)$/i.test(cells[converged].trim()) : undefined }; validatePolarPoint(point, messages, offset + 2); validateCondition(reynoldsNumber, machNumber, messages); const key = `${reynoldsNumber ?? 'unknown'}|${machNumber ?? 'unknown'}`; const group = grouped.get(key) ?? { reynoldsNumber, machNumber, points: [] }; group.points.push(point); grouped.set(key, group); });
    [...grouped.values()].forEach((group, index) => { validateDuplicates(group.points, messages); datasets.push({ modelVersion: AERODYNAMIC_POLAR_MODEL_VERSION, id: grouped.size === 1 ? cleanId(options.datasetId) : `${cleanId(options.datasetId)}-${index + 1}`, airfoilId: cleanId(options.airfoilId), displayName: options.displayName?.trim() || cleanId(options.datasetId), reynoldsNumber: group.reynoldsNumber, machNumber: group.machNumber, momentReference: defaultMoment, generationMethod: options.generationMethod ?? 'csv-import', provenance: options.provenance, points: group.points.sort((a, b) => a.angleOfAttackDeg - b.angleOfAttackDeg), rawSource }); });
  } else {
    const reynoldsMatch = rawSource.match(/Re\s*=\s*([0-9.+\-]+)(?:\s*[eE]\s*([+\-]?\d+))?/i); const machMatch = rawSource.match(/Mach\s*=\s*([0-9.eE+\-]+)/i); const nCritMatch = rawSource.match(/Ncrit\s*=\s*([0-9.eE+\-]+)/i); const parsedReynolds = reynoldsMatch ? Number(reynoldsMatch[1]) * (reynoldsMatch[2] ? 10 ** Number(reynoldsMatch[2]) : 1) : undefined; const reynoldsNumber = options.reynoldsNumber ?? parsedReynolds; const machNumber = options.machNumber ?? (machMatch ? Number(machMatch[1]) : undefined); validateCondition(reynoldsNumber, machNumber, messages);
    const lines = rawSource.split(/\r?\n/); const headerIndex = lines.findIndex((line) => /\balpha\b/i.test(line) && /\bCL\b/i.test(line) && /\bCD\b/i.test(line)); const header = headerIndex >= 0 ? lines[headerIndex].trim().split(/\s+/).map((item) => item.toLowerCase()) : []; if (headerIndex < 0) messages.push(message('error', 'xfoil-header', 'XFOIL polar text requires a column header containing alpha, CL and CD.'));
    const index = (name: string) => header.indexOf(name.toLowerCase()); const points: PolarPoint[] = [];
    lines.slice(headerIndex + 1).forEach((line, offset) => { if (!line.trim() || /^[\s-]+$/.test(line)) return; const cells = line.trim().split(/\s+/); const alphaIndex = index('alpha'); const clIndex = index('cl'); const cdIndex = index('cd'); const cmIndex = index('cm'); const topIndex = index('top_xtr'); const bottomIndex = index('bot_xtr'); const point: PolarPoint = { angleOfAttackDeg: Number(cells[alphaIndex]), liftCoefficient: parseOptional(cells, clIndex), dragCoefficient: parseOptional(cells, cdIndex), pitchingMomentCoefficient: cmIndex >= 0 ? parseOptional(cells, cmIndex) : undefined, upperTransitionXOverChord: topIndex >= 0 ? parseOptional(cells, topIndex) : undefined, lowerTransitionXOverChord: bottomIndex >= 0 ? parseOptional(cells, bottomIndex) : undefined, converged: true }; if (!finite(point.angleOfAttackDeg)) { messages.push(message('warning', 'non-converged-row', 'Skipped an unreadable or non-converged XFOIL row.', headerIndex + offset + 2)); return; } validatePolarPoint(point, messages, headerIndex + offset + 2); points.push(point); }); validateDuplicates(points, messages);
    datasets.push({ modelVersion: AERODYNAMIC_POLAR_MODEL_VERSION, id: cleanId(options.datasetId), airfoilId: cleanId(options.airfoilId), displayName: options.displayName?.trim() || cleanId(options.datasetId), reynoldsNumber, machNumber, nCrit: nCritMatch ? Number(nCritMatch[1]) : undefined, momentReference: defaultMoment, generationMethod: options.generationMethod ?? 'xfoil', provenance: options.provenance, points: points.sort((a, b) => a.angleOfAttackDeg - b.angleOfAttackDeg), rawSource });
  }
  if (datasets.some((dataset) => dataset.points.length === 0)) messages.push(message('error', 'empty-polar', 'A polar dataset must contain at least one valid point.'));
  if (messages.some((item) => item.severity === 'error')) return { messages };
  return { value: datasets, messages };
}

export function registerAirfoilGeometry(library: AirfoilLibrary, geometry: ImportedAirfoilGeometry): ImportResult<AirfoilLibrary> {
  if (library.modelVersion !== AIRFOIL_LIBRARY_MODEL_VERSION) return { messages: [message('error', 'library-version', 'Unsupported airfoil library version.')] };
  if (parseNaca4Designation(geometry.airfoilId) || library.geometries.some((item) => item.airfoilId === geometry.airfoilId)) return { messages: [message('error', 'duplicate-airfoil-id', `Airfoil identifier "${geometry.airfoilId}" is already registered.`)] };
  return { value: { ...library, revision: library.revision + 1, geometries: [...library.geometries, structuredClone(geometry)] }, messages: [] };
}
export function registerPolarDatasets(library: AirfoilLibrary, datasets: AerodynamicPolarDataset[]): ImportResult<AirfoilLibrary> {
  const ids = new Set(library.polarDatasets.map((item) => item.id)); if (datasets.some((dataset) => ids.has(dataset.id) || !airfoilExists(library, dataset.airfoilId))) return { messages: [message('error', 'polar-reference', 'Polar identifiers must be unique and reference a registered or generated airfoil.')] };
  return { value: { ...library, revision: library.revision + 1, polarDatasets: [...library.polarDatasets, ...structuredClone(datasets)] }, messages: [] };
}
export function referencedAirfoilIds(design: { wing: { stations: { airfoilId: string }[] }; horizontalTail: { stations: { airfoilId: string }[] }; verticalTail: { stations: { airfoilId: string }[] } }): Set<string> { return new Set([...design.wing.stations, ...design.horizontalTail.stations, ...design.verticalTail.stations].map((station) => station.airfoilId)); }
export function removeAirfoilGeometry(library: AirfoilLibrary, airfoilId: string, referencedIds: ReadonlySet<string>): ImportResult<AirfoilLibrary> {
  if (referencedIds.has(airfoilId)) return { messages: [message('error', 'airfoil-in-use', `Airfoil "${airfoilId}" is referenced by aircraft geometry and cannot be removed.`)] };
  if (!library.geometries.some((item) => item.airfoilId === airfoilId)) return { messages: [message('error', 'airfoil-not-found', `Airfoil "${airfoilId}" is not an imported geometry.`)] };
  return { value: { ...library, revision: library.revision + 1, geometries: library.geometries.filter((item) => item.airfoilId !== airfoilId), polarDatasets: library.polarDatasets.filter((item) => item.airfoilId !== airfoilId) }, messages: [] };
}
export function removePolarDataset(library: AirfoilLibrary, datasetId: string): ImportResult<AirfoilLibrary> {
  if (!library.polarDatasets.some((item) => item.id === datasetId)) return { messages: [message('error', 'polar-not-found', `Polar dataset "${datasetId}" was not found.`)] };
  return { value: { ...library, revision: library.revision + 1, polarDatasets: library.polarDatasets.filter((item) => item.id !== datasetId) }, messages: [] };
}
