import type {
  AerodynamicMesh,
  AerodynamicPanel,
  AnalysisLiftingSurface,
  AnalysisMeshConfiguration,
  AnalysisPoint3,
  AnalysisSpacing,
  AnalysisSurfaceId,
  MeshValidationIssue,
  MeshValidationResult,
} from '../domain/analysisGeometry';
import { ANALYSIS_GEOMETRY_MODEL_VERSION } from '../domain/analysisGeometry';
import type { AircraftDesign, ControlSurfaceDefinition } from '../domain/types';
import { naca4PointAtChordFraction } from './airfoil';
import { validateControlSurfaceModel } from './controlSurfaces';
import {
  horizontalTailPhysicalStations,
  sampleHorizontalTailSectionAtDistance,
  sampleVerticalTailSection,
  transformVerticalTailAirfoilPoint,
  validateHorizontalTailGeometry,
  validateVerticalTailGeometry,
} from './tailGeometry';
import { physicalWingStations, validateWingGeometry } from './wingGeometry';
import { sampleWingSectionAtSpan, transformWingAirfoilPoint, type AirfoilPoint2 } from './wingLoft';

export const DEFAULT_ANALYSIS_MESH_CONFIGURATION: AnalysisMeshConfiguration = {
  modelVersion: ANALYSIS_GEOMETRY_MODEL_VERSION,
  surfaceIds: ['wing', 'horizontal-tail', 'vertical-tail'],
  chordwisePanels: 8,
  spanwisePanelsPerSection: 8,
  chordwiseSpacing: 'cosine',
  spanwiseSpacing: 'cosine',
  maximumPanelAspectRatio: 30,
};

export const ANALYSIS_MESH_PRESETS = {
  coarse: { chordwisePanels: 4, spanwisePanelsPerSection: 4 },
  medium: { chordwisePanels: 8, spanwisePanelsPerSection: 8 },
  fine: { chordwisePanels: 12, spanwisePanelsPerSection: 16 },
} as const;

const tolerance = 1e-9;
const maximumPanelCount = 20_000;
const surfaceOrder: AnalysisSurfaceId[] = ['wing', 'horizontal-tail', 'vertical-tail'];
const surfaceNames: Record<AnalysisSurfaceId, string> = { wing: 'Main wing', 'horizontal-tail': 'Horizontal stabilizer', 'vertical-tail': 'Vertical stabilizer' };

type SurfaceAdapter = {
  id: AnalysisSurfaceId;
  spanStartM: number;
  spanEndM: number;
  stationBoundariesM: number[];
  expectedNormal: AnalysisPoint3;
  pointAt: (spanCoordinateM: number, chordFraction: number) => AnalysisPoint3;
  sectionIdAt: (spanCoordinateM: number) => string;
};

function add(a: AnalysisPoint3, b: AnalysisPoint3): AnalysisPoint3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtract(a: AnalysisPoint3, b: AnalysisPoint3): AnalysisPoint3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a: AnalysisPoint3, factor: number): AnalysisPoint3 { return [a[0] * factor, a[1] * factor, a[2] * factor]; }
function dot(a: AnalysisPoint3, b: AnalysisPoint3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a: AnalysisPoint3, b: AnalysisPoint3): AnalysisPoint3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function magnitude(a: AnalysisPoint3): number { return Math.hypot(a[0], a[1], a[2]); }
function normalize(a: AnalysisPoint3): AnalysisPoint3 { const length = magnitude(a); return length > tolerance ? scale(a, 1 / length) : [Number.NaN, Number.NaN, Number.NaN]; }
function average(points: AnalysisPoint3[]): AnalysisPoint3 { return scale(points.reduce(add, [0, 0, 0]), 1 / points.length); }
function finitePoint(point: AnalysisPoint3): boolean { return point.every(Number.isFinite); }
function interpolate(from: number, to: number, fraction: number): number { return from + fraction * (to - from); }

function meanCamberPoint(airfoilId: string, chordFraction: number): AirfoilPoint2 {
  const upper = naca4PointAtChordFraction(airfoilId, chordFraction, 'upper');
  const lower = naca4PointAtChordFraction(airfoilId, chordFraction, 'lower');
  return [(upper[0] + lower[0]) / 2, (upper[1] + lower[1]) / 2];
}

function blendedMeanCamberPoint(fromAirfoilId: string, toAirfoilId: string, blend: number, chordFraction: number): AirfoilPoint2 {
  const from = meanCamberPoint(fromAirfoilId, chordFraction); const to = meanCamberPoint(toAirfoilId, chordFraction);
  return [interpolate(from[0], to[0], blend), interpolate(from[1], to[1], blend)];
}

function sectionSourceIndex(physicalIndex: number, sourceSectionCount: number, symmetric: boolean): number {
  if (!symmetric) return physicalIndex;
  return physicalIndex < sourceSectionCount ? sourceSectionCount - 1 - physicalIndex : physicalIndex - sourceSectionCount;
}

function sectionSideSuffix(spanCoordinateM: number, centerM: number): string { return spanCoordinateM < centerM ? 'port' : 'starboard'; }

function wingAdapter(design: AircraftDesign): SurfaceAdapter {
  const stations = physicalWingStations(design.wing); const sourceCount = design.wing.sections.length;
  return {
    id: 'wing', spanStartM: stations[0].spanPositionM, spanEndM: stations.at(-1)!.spanPositionM,
    stationBoundariesM: stations.map((station) => station.spanPositionM), expectedNormal: [0, 0, 1],
    pointAt: (span, chordFraction) => {
      const sample = sampleWingSectionAtSpan(design.wing, span);
      return transformWingAirfoilPoint(sample.station, blendedMeanCamberPoint(sample.fromAirfoilId, sample.toAirfoilId, sample.airfoilBlendFraction, chordFraction));
    },
    sectionIdAt: (span) => {
      const sample = sampleWingSectionAtSpan(design.wing, span); const sourceIndex = sectionSourceIndex(sample.physicalSectionIndex, sourceCount, design.wing.symmetry === 'symmetric');
      const sourceId = design.wing.sections[sourceIndex].id;
      return design.wing.symmetry === 'symmetric' ? `${sourceId}-${sectionSideSuffix(span, 0)}` : sourceId;
    },
  };
}

function horizontalTailAdapter(design: AircraftDesign): SurfaceAdapter {
  const tail = design.horizontalTail; const stations = horizontalTailPhysicalStations(tail); const center = tail.lateralPositionM; const sourceCount = tail.sections.length;
  return {
    id: 'horizontal-tail', spanStartM: stations[0].spanPositionM, spanEndM: stations.at(-1)!.spanPositionM,
    stationBoundariesM: stations.map((station) => station.spanPositionM), expectedNormal: [0, 0, 1],
    pointAt: (span, chordFraction) => {
      const side = span < center ? 'port' : 'starboard'; const sample = sampleHorizontalTailSectionAtDistance(tail, side, Math.abs(span - center));
      return transformWingAirfoilPoint(sample.station, blendedMeanCamberPoint(sample.fromAirfoilId, sample.toAirfoilId, sample.airfoilBlendFraction, chordFraction));
    },
    sectionIdAt: (span) => {
      const side = span < center ? 'port' : 'starboard'; const sample = sampleHorizontalTailSectionAtDistance(tail, side, Math.abs(span - center));
      return `${tail.sections[sectionSourceIndex(sample.physicalSectionIndex, sourceCount, true)].id}-${side}`;
    },
  };
}

function verticalTailAdapter(design: AircraftDesign): SurfaceAdapter {
  const tail = design.verticalTail; const end = tail.stations.at(-1)!.spanPositionM;
  return {
    id: 'vertical-tail', spanStartM: 0, spanEndM: end, stationBoundariesM: tail.stations.map((station) => station.spanPositionM), expectedNormal: [0, 1, 0],
    pointAt: (height, chordFraction) => {
      const sample = sampleVerticalTailSection(tail, height);
      return transformVerticalTailAirfoilPoint(tail, sample.station, blendedMeanCamberPoint(sample.fromAirfoilId, sample.toAirfoilId, sample.airfoilBlendFraction, chordFraction));
    },
    sectionIdAt: (height) => tail.sections[sampleVerticalTailSection(tail, height).sectionIndex].id,
  };
}

function adapterFor(design: AircraftDesign, id: AnalysisSurfaceId): SurfaceAdapter {
  if (id === 'wing') return wingAdapter(design);
  if (id === 'horizontal-tail') return horizontalTailAdapter(design);
  return verticalTailAdapter(design);
}

function spacing(count: number, kind: AnalysisSpacing): number[] {
  return Array.from({ length: count + 1 }, (_, index) => kind === 'uniform' ? index / count : (1 - Math.cos(Math.PI * index / count)) / 2);
}

function uniqueSorted(values: number[]): number[] {
  return values.filter(Number.isFinite).sort((a, b) => a - b).filter((value, index, sorted) => index === 0 || Math.abs(value - sorted[index - 1]) > tolerance);
}

function physicalControlSides(control: ControlSurfaceDefinition): ('port' | 'starboard' | 'center')[] {
  if (control.parentSurface === 'vertical-tail') return ['center'];
  if (control.operation === 'independent') return [control.side as 'port' | 'starboard'];
  return ['port', 'starboard'];
}

function controlSpanCoordinates(design: AircraftDesign, surfaceId: AnalysisSurfaceId): number[] {
  const controls = design.controlSurfaces.surfaces.filter((control) => control.enabled && control.parentSurface === surfaceId);
  return controls.flatMap((control) => physicalControlSides(control).flatMap((side) => {
    if (surfaceId === 'vertical-tail') return [control.spanStartM, control.spanEndM];
    const center = surfaceId === 'horizontal-tail' ? design.horizontalTail.lateralPositionM : 0;
    const sign = side === 'port' ? -1 : 1;
    return [center + sign * control.spanStartM, center + sign * control.spanEndM];
  }));
}

function spanBreaks(design: AircraftDesign, adapter: SurfaceAdapter, configuration: AnalysisMeshConfiguration): number[] {
  const points: number[] = [...adapter.stationBoundariesM, ...controlSpanCoordinates(design, adapter.id)];
  for (let index = 0; index < adapter.stationBoundariesM.length - 1; index += 1) {
    const from = adapter.stationBoundariesM[index]; const to = adapter.stationBoundariesM[index + 1];
    spacing(configuration.spanwisePanelsPerSection, configuration.spanwiseSpacing).forEach((fraction) => points.push(interpolate(from, to, fraction)));
  }
  return uniqueSorted(points.filter((point) => point >= adapter.spanStartM - tolerance && point <= adapter.spanEndM + tolerance));
}

function chordBreaks(design: AircraftDesign, surfaceId: AnalysisSurfaceId, configuration: AnalysisMeshConfiguration): number[] {
  const points = spacing(configuration.chordwisePanels, configuration.chordwiseSpacing);
  design.controlSurfaces.surfaces.filter((control) => control.enabled && control.parentSurface === surfaceId).forEach((control) => points.push(control.hingeChordFraction));
  return uniqueSorted(points);
}

function controlAt(design: AircraftDesign, surfaceId: AnalysisSurfaceId, span: number, chordStart: number): string | undefined {
  const center = surfaceId === 'horizontal-tail' ? design.horizontalTail.lateralPositionM : 0;
  const side = surfaceId === 'vertical-tail' ? 'center' : span < center ? 'port' : 'starboard';
  const distance = surfaceId === 'vertical-tail' ? span : Math.abs(span - center);
  return design.controlSurfaces.surfaces.find((control) => control.enabled && control.parentSurface === surfaceId
    && physicalControlSides(control).includes(side)
    && distance >= control.spanStartM - tolerance && distance <= control.spanEndM + tolerance
    && chordStart >= control.hingeChordFraction - tolerance)?.id;
}

function panelGeometry(adapter: SurfaceAdapter, spanStart: number, spanEnd: number, chordStart: number, chordEnd: number): Omit<AerodynamicPanel, 'id' | 'parentSurfaceId' | 'parentSectionId' | 'parentControlSurfaceId' | 'spanIndex' | 'chordIndex' | 'trailingEdge'> {
  const leadingSpanStart = adapter.pointAt(spanStart, chordStart); const trailingSpanStart = adapter.pointAt(spanStart, chordEnd);
  const trailingSpanEnd = adapter.pointAt(spanEnd, chordEnd); const leadingSpanEnd = adapter.pointAt(spanEnd, chordStart);
  const corners = { leadingSpanStart, trailingSpanStart, trailingSpanEnd, leadingSpanEnd };
  const winding = adapter.id === 'vertical-tail'
    ? [leadingSpanStart, leadingSpanEnd, trailingSpanEnd, trailingSpanStart]
    : [leadingSpanStart, trailingSpanStart, trailingSpanEnd, leadingSpanEnd];
  const firstCross = cross(subtract(winding[1], winding[0]), subtract(winding[2], winding[0]));
  const secondCross = cross(subtract(winding[2], winding[0]), subtract(winding[3], winding[0]));
  const firstArea = magnitude(firstCross) / 2; const secondArea = magnitude(secondCross) / 2; const areaM2 = firstArea + secondArea;
  const firstCentroid = average([winding[0], winding[1], winding[2]]); const secondCentroid = average([winding[0], winding[2], winding[3]]);
  const centroidM = areaM2 > tolerance ? scale(add(scale(firstCentroid, firstArea), scale(secondCentroid, secondArea)), 1 / areaM2) : average(winding);
  const spanMiddle = (spanStart + spanEnd) / 2;
  const localChordDirection = normalize(subtract(adapter.pointAt(spanMiddle, chordEnd), adapter.pointAt(spanMiddle, chordStart)));
  const localSpanDirection = normalize(subtract(adapter.pointAt(spanEnd, (chordStart + chordEnd) / 2), adapter.pointAt(spanStart, (chordStart + chordEnd) / 2)));
  const boundFraction = chordStart + 0.25 * (chordEnd - chordStart); const collocationFraction = chordStart + 0.75 * (chordEnd - chordStart);
  return {
    corners, centroidM, collocationPointM: adapter.pointAt(spanMiddle, collocationFraction), areaM2,
    unitNormal: normalize(add(firstCross, secondCross)), localChordDirection, localSpanDirection,
    boundVortexStartM: adapter.pointAt(spanStart, boundFraction), boundVortexEndM: adapter.pointAt(spanEnd, boundFraction),
  };
}

function configurationIssues(configuration: AnalysisMeshConfiguration): MeshValidationIssue[] {
  const issues: MeshValidationIssue[] = [];
  const error = (message: string) => issues.push({ severity: 'error', code: 'invalid-configuration', message });
  if (configuration.modelVersion !== ANALYSIS_GEOMETRY_MODEL_VERSION) error(`Unsupported analysis geometry model version ${String(configuration.modelVersion)}.`);
  if (!Number.isInteger(configuration.chordwisePanels) || configuration.chordwisePanels < 1 || configuration.chordwisePanels > 40) error('Chordwise panels must be an integer from 1 through 40.');
  if (!Number.isInteger(configuration.spanwisePanelsPerSection) || configuration.spanwisePanelsPerSection < 1 || configuration.spanwisePanelsPerSection > 80) error('Spanwise panels per engineering section must be an integer from 1 through 80.');
  if (!Number.isFinite(configuration.maximumPanelAspectRatio) || configuration.maximumPanelAspectRatio < 1) error('Maximum panel aspect ratio must be finite and at least 1.');
  if (configuration.surfaceIds.length < 1) error('Select at least one lifting surface.');
  if (new Set(configuration.surfaceIds).size !== configuration.surfaceIds.length || configuration.surfaceIds.some((id) => !surfaceOrder.includes(id))) error('Lifting-surface selection contains duplicates or unsupported identifiers.');
  return issues;
}

function parentGeometryIssues(design: AircraftDesign, surfaceIds: AnalysisSurfaceId[]): MeshValidationIssue[] {
  const checks: [AnalysisSurfaceId, { valid: boolean; errors: string[] }][] = [
    ['wing', validateWingGeometry(design.wing)],
    ['horizontal-tail', validateHorizontalTailGeometry(design.horizontalTail)],
    ['vertical-tail', validateVerticalTailGeometry(design.verticalTail)],
  ];
  const issues = checks.filter(([id]) => surfaceIds.includes(id)).flatMap(([surfaceId, validation]) => validation.errors.map((message) => ({ severity: 'error', code: 'invalid-parent-geometry', message, surfaceId }) as MeshValidationIssue));
  const controls = validateControlSurfaceModel(design);
  if (!controls.valid) issues.push(...controls.errors.map((message) => ({ severity: 'error', code: 'invalid-parent-geometry', message }) as MeshValidationIssue));
  return issues;
}

function pointKey(point: AnalysisPoint3): string { return point.map((value) => value.toFixed(9)).join(','); }
function edgeKey(from: AnalysisPoint3, to: AnalysisPoint3): string { return [pointKey(from), pointKey(to)].sort().join('|'); }

function validateGeneratedMesh(surfaces: AnalysisLiftingSurface[], panels: AerodynamicPanel[], configuration: AnalysisMeshConfiguration): MeshValidationResult {
  const errors: MeshValidationIssue[] = []; const warnings: MeshValidationIssue[] = [];
  const issue = (severity: 'error' | 'warning', code: MeshValidationIssue['code'], message: string, panel?: AerodynamicPanel) => (severity === 'error' ? errors : warnings).push({ severity, code, message, surfaceId: panel?.parentSurfaceId, panelId: panel?.id });
  const signatures = new Map<string, string>();
  panels.forEach((panel) => {
    const points = Object.values(panel.corners);
    if (![...points, panel.centroidM, panel.collocationPointM, panel.boundVortexStartM, panel.boundVortexEndM].every(finitePoint)) issue('error', 'non-finite-coordinate', `${panel.id} contains a non-finite coordinate.`, panel);
    if (!Number.isFinite(panel.areaM2) || panel.areaM2 <= tolerance) issue('error', 'degenerate-panel', `${panel.id} has zero or invalid area.`, panel);
    if (!finitePoint(panel.unitNormal) || Math.abs(magnitude(panel.unitNormal) - 1) > 1e-8) issue('error', 'invalid-normal', `${panel.id} does not have a finite unit normal.`, panel);
    const expected = panel.parentSurfaceId === 'vertical-tail' ? [0, 1, 0] as AnalysisPoint3 : [0, 0, 1] as AnalysisPoint3;
    if (finitePoint(panel.unitNormal) && dot(panel.unitNormal, expected) <= tolerance) issue('error', 'inconsistent-orientation', `${panel.id} normal is inconsistent with the declared surface orientation.`, panel);
    const chordLength = (magnitude(subtract(panel.corners.trailingSpanStart, panel.corners.leadingSpanStart)) + magnitude(subtract(panel.corners.trailingSpanEnd, panel.corners.leadingSpanEnd))) / 2;
    const spanLength = (magnitude(subtract(panel.corners.leadingSpanEnd, panel.corners.leadingSpanStart)) + magnitude(subtract(panel.corners.trailingSpanEnd, panel.corners.trailingSpanStart))) / 2;
    const aspectRatio = Math.max(chordLength, spanLength) / Math.min(chordLength, spanLength);
    if (Number.isFinite(aspectRatio) && aspectRatio > configuration.maximumPanelAspectRatio) issue('warning', 'excessive-aspect-ratio', `${panel.id} panel aspect ratio ${aspectRatio.toFixed(1)} exceeds ${configuration.maximumPanelAspectRatio.toFixed(1)}.`, panel);
    const signature = points.map(pointKey).sort().join('|'); const duplicate = signatures.get(signature);
    if (duplicate) issue('error', 'overlapping-panel', `${panel.id} duplicates panel ${duplicate}.`, panel); else signatures.set(signature, panel.id);
  });
  surfaces.forEach((surface) => {
    surface.stationBoundaryCoordinatesM.forEach((boundary) => {
      if (!surface.spanBreakCoordinatesM.some((value) => Math.abs(value - boundary) <= tolerance)) errors.push({ severity: 'error', code: 'missing-station-boundary', message: `${surface.name} station boundary ${boundary.toFixed(6)} m is absent from the mesh.`, surfaceId: surface.id });
    });
    const surfacePanels = panels.filter((panel) => panel.parentSurfaceId === surface.id);
    if (surfacePanels.length > 1) {
      const edgeOwners = new Map<string, number[]>();
      surfacePanels.forEach((panel, index) => {
        const c = panel.corners; const edges = [[c.leadingSpanStart, c.trailingSpanStart], [c.trailingSpanStart, c.trailingSpanEnd], [c.trailingSpanEnd, c.leadingSpanEnd], [c.leadingSpanEnd, c.leadingSpanStart]] as [AnalysisPoint3, AnalysisPoint3][];
        edges.forEach(([from, to]) => { const key = edgeKey(from, to); edgeOwners.set(key, [...(edgeOwners.get(key) ?? []), index]); });
      });
      const adjacency = surfacePanels.map(() => new Set<number>()); edgeOwners.forEach((owners) => { if (owners.length === 2) { adjacency[owners[0]].add(owners[1]); adjacency[owners[1]].add(owners[0]); } });
      const visited = new Set<number>([0]); const queue = [0]; while (queue.length) adjacency[queue.shift()!].forEach((neighbor) => { if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); } });
      if (visited.size !== surfacePanels.length) errors.push({ severity: 'error', code: 'disconnected-surface', message: `${surface.name} mesh has ${surfacePanels.length - visited.size} disconnected panels.`, surfaceId: surface.id });
    }
  });
  return { valid: errors.length === 0, errors, warnings };
}

function emptyMesh(design: AircraftDesign, configuration: AnalysisMeshConfiguration, issues: MeshValidationIssue[]): AerodynamicMesh {
  return {
    modelVersion: ANALYSIS_GEOMETRY_MODEL_VERSION, designSchemaVersion: 3, designRevision: design.revision, geometryState: 'neutral', configuration: structuredClone(configuration), surfaces: [], panels: [],
    validation: { valid: false, errors: issues.filter((issue) => issue.severity === 'error'), warnings: issues.filter((issue) => issue.severity === 'warning') },
    assumptions: ['Thin lifting surfaces use interpolated NACA mean-camber geometry.', 'Control-surface deflections are excluded; analysis geometry is neutral.'],
  };
}

export function generateAnalysisMesh(design: AircraftDesign, configuration: AnalysisMeshConfiguration = DEFAULT_ANALYSIS_MESH_CONFIGURATION): AerodynamicMesh {
  const selectedIds = surfaceOrder.filter((id) => configuration.surfaceIds.includes(id));
  const initialIssues = [...configurationIssues(configuration), ...parentGeometryIssues(design, selectedIds)];
  if (initialIssues.some((issue) => issue.severity === 'error')) return emptyMesh(design, configuration, initialIssues);
  const adapters = selectedIds.map((id) => adapterFor(design, id));
  const surfaceData = adapters.map((adapter) => ({ adapter, span: spanBreaks(design, adapter, configuration), chord: chordBreaks(design, adapter.id, configuration) }));
  const estimatedCount = surfaceData.reduce((sum, item) => sum + (item.span.length - 1) * (item.chord.length - 1), 0);
  if (estimatedCount > maximumPanelCount) return emptyMesh(design, configuration, [{ severity: 'error', code: 'invalid-configuration', message: `Requested mesh would create ${estimatedCount} panels; the interactive limit is ${maximumPanelCount}.` }]);
  const panels: AerodynamicPanel[] = []; const surfaces: AnalysisLiftingSurface[] = [];
  surfaceData.forEach(({ adapter, span, chord }) => {
    const panelIds: string[] = [];
    for (let spanIndex = 0; spanIndex < span.length - 1; spanIndex += 1) for (let chordIndex = 0; chordIndex < chord.length - 1; chordIndex += 1) {
      const spanStart = span[spanIndex]; const spanEnd = span[spanIndex + 1]; const chordStart = chord[chordIndex]; const chordEnd = chord[chordIndex + 1]; const spanMiddle = (spanStart + spanEnd) / 2;
      const id = `${adapter.id}:s${spanIndex}:c${chordIndex}`; panelIds.push(id);
      panels.push({
        id, parentSurfaceId: adapter.id, parentSectionId: adapter.sectionIdAt(spanMiddle), parentControlSurfaceId: controlAt(design, adapter.id, spanMiddle, chordStart),
        spanIndex, chordIndex, trailingEdge: chordIndex === chord.length - 2,
        ...panelGeometry(adapter, spanStart, spanEnd, chordStart, chordEnd),
      });
    }
    surfaces.push({ id: adapter.id, name: surfaceNames[adapter.id], geometryState: 'neutral', stationBoundaryCoordinatesM: [...adapter.stationBoundariesM], spanBreakCoordinatesM: span, chordBreakFractions: chord, panelIds });
  });
  const validation = validateGeneratedMesh(surfaces, panels, configuration);
  const deflected = design.controlSurfaces.surfaces.filter((control) => control.enabled && Math.abs(control.currentDeflectionDeg) > tolerance && selectedIds.includes(control.parentSurface));
  deflected.forEach((control) => validation.warnings.push({ severity: 'warning', code: 'unsupported-configuration', message: `${control.name} is deflected ${control.currentDeflectionDeg.toFixed(2)} deg; M5.6 analysis geometry remains neutral.`, surfaceId: control.parentSurface }));
  return {
    modelVersion: ANALYSIS_GEOMETRY_MODEL_VERSION, designSchemaVersion: 3, designRevision: design.revision, geometryState: 'neutral', configuration: structuredClone(configuration), surfaces, panels, validation,
    assumptions: [
      'Thin lifting surfaces follow the interpolated NACA mean-camber line, not the closed visualization skin.',
      'Quarter-chord bound vortices and three-quarter-chord collocation points are local to each aerodynamic panel.',
      'All control-surface hinge and span boundaries are included, but the lattice remains in the neutral configuration.',
      'The fuselage is excluded from the aerodynamic lattice.',
    ],
  };
}

export function isAnalysisMeshStale(mesh: AerodynamicMesh | undefined, design: AircraftDesign): boolean {
  return mesh !== undefined && (mesh.designSchemaVersion !== design.schemaVersion || mesh.designRevision !== design.revision);
}
