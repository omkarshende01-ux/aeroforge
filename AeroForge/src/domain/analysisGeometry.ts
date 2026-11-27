export const ANALYSIS_GEOMETRY_MODEL_VERSION = 1 as const;

export type AnalysisPoint3 = readonly [xM: number, yM: number, zM: number];
export type AnalysisSurfaceId = 'wing' | 'horizontal-tail' | 'vertical-tail';
export type AnalysisSpacing = 'uniform' | 'cosine';
export type AnalysisGeometryState = 'neutral';

export type AnalysisMeshConfiguration = {
  modelVersion: typeof ANALYSIS_GEOMETRY_MODEL_VERSION;
  surfaceIds: AnalysisSurfaceId[];
  chordwisePanels: number;
  spanwisePanelsPerSection: number;
  chordwiseSpacing: AnalysisSpacing;
  spanwiseSpacing: AnalysisSpacing;
  maximumPanelAspectRatio: number;
};

export type AerodynamicPanelCorners = {
  leadingSpanStart: AnalysisPoint3;
  trailingSpanStart: AnalysisPoint3;
  trailingSpanEnd: AnalysisPoint3;
  leadingSpanEnd: AnalysisPoint3;
};

export type AerodynamicPanel = {
  id: string;
  parentSurfaceId: AnalysisSurfaceId;
  parentSectionId: string;
  parentControlSurfaceId?: string;
  spanIndex: number;
  chordIndex: number;
  trailingEdge: boolean;
  corners: AerodynamicPanelCorners;
  centroidM: AnalysisPoint3;
  collocationPointM: AnalysisPoint3;
  areaM2: number;
  unitNormal: AnalysisPoint3;
  localChordDirection: AnalysisPoint3;
  localSpanDirection: AnalysisPoint3;
  boundVortexStartM: AnalysisPoint3;
  boundVortexEndM: AnalysisPoint3;
};

export type AnalysisLiftingSurface = {
  id: AnalysisSurfaceId;
  name: string;
  geometryState: AnalysisGeometryState;
  stationBoundaryCoordinatesM: number[];
  spanBreakCoordinatesM: number[];
  chordBreakFractions: number[];
  panelIds: string[];
};

export type MeshValidationIssue = {
  severity: 'error' | 'warning';
  code:
    | 'invalid-configuration'
    | 'invalid-parent-geometry'
    | 'non-finite-coordinate'
    | 'degenerate-panel'
    | 'invalid-normal'
    | 'inconsistent-orientation'
    | 'excessive-aspect-ratio'
    | 'disconnected-surface'
    | 'overlapping-panel'
    | 'missing-station-boundary'
    | 'unsupported-configuration';
  message: string;
  surfaceId?: AnalysisSurfaceId;
  panelId?: string;
};

export type MeshValidationResult = {
  valid: boolean;
  errors: MeshValidationIssue[];
  warnings: MeshValidationIssue[];
};

export type AerodynamicMesh = {
  modelVersion: typeof ANALYSIS_GEOMETRY_MODEL_VERSION;
  designSchemaVersion: 3;
  designRevision: number;
  geometryState: AnalysisGeometryState;
  configuration: AnalysisMeshConfiguration;
  surfaces: AnalysisLiftingSurface[];
  panels: AerodynamicPanel[];
  validation: MeshValidationResult;
  assumptions: string[];
};
