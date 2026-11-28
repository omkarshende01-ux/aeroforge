export const AIRFOIL_LIBRARY_MODEL_VERSION = 1 as const;
export const AIRFOIL_GEOMETRY_MODEL_VERSION = 1 as const;
export const AERODYNAMIC_POLAR_MODEL_VERSION = 1 as const;

export type AirfoilIdentifier = string;
export type NormalizedAirfoilPoint = readonly [xOverChord: number, zOverChord: number];
export type AirfoilSurface = { ordering: 'leading-edge-to-trailing-edge'; points: NormalizedAirfoilPoint[] };
export type DataSourceKind = 'experimental' | 'computational' | 'user-supplied' | 'generated';
export type GeometryGenerationMethod = 'naca-four-digit' | 'selig-dat-import' | 'lednicer-dat-import' | 'csv-import';
export type PolarGenerationMethod = 'wind-tunnel' | 'flight-test' | 'xfoil' | 'cfd' | 'csv-import' | 'other' | 'unknown';

export type DataProvenance = {
  sourceKind: DataSourceKind;
  sourceName?: string;
  sourceUrl?: string;
  citation?: string;
  license?: string;
  importedFileName?: string;
  importedAtIso?: string;
  notes?: string;
};

export type ImportedAirfoilGeometry = {
  modelVersion: typeof AIRFOIL_GEOMETRY_MODEL_VERSION;
  airfoilId: AirfoilIdentifier;
  displayName: string;
  coordinateConvention: 'x-over-chord-z-over-chord';
  contourOrdering: 'upper-te-to-le-lower-le-to-te';
  upperSurface: AirfoilSurface;
  lowerSurface: AirfoilSurface;
  leadingEdge: NormalizedAirfoilPoint;
  trailingEdgeUpper: NormalizedAirfoilPoint;
  trailingEdgeLower: NormalizedAirfoilPoint;
  geometryMethod: GeometryGenerationMethod;
  provenance: DataProvenance;
  rawSource: string;
};

export type MomentReference = {
  chordFraction?: number;
  axis: 'airfoil-quarter-chord' | 'specified-chord-fraction' | 'unknown';
  signConvention: 'positive-nose-up' | 'positive-nose-down' | 'unknown';
};

export type PolarPoint = {
  angleOfAttackDeg: number;
  liftCoefficient?: number;
  dragCoefficient?: number;
  pitchingMomentCoefficient?: number;
  upperTransitionXOverChord?: number;
  lowerTransitionXOverChord?: number;
  converged?: boolean;
  convergenceNote?: string;
};

export type AerodynamicPolarDataset = {
  modelVersion: typeof AERODYNAMIC_POLAR_MODEL_VERSION;
  id: string;
  airfoilId: AirfoilIdentifier;
  displayName: string;
  reynoldsNumber?: number;
  machNumber?: number;
  transitionModel?: string;
  nCrit?: number;
  forcedUpperTransitionXOverChord?: number;
  forcedLowerTransitionXOverChord?: number;
  momentReference: MomentReference;
  generationMethod: PolarGenerationMethod;
  applicability?: string;
  provenance: DataProvenance;
  points: PolarPoint[];
  rawSource: string;
};

export type AirfoilLibrary = {
  modelVersion: typeof AIRFOIL_LIBRARY_MODEL_VERSION;
  revision: number;
  geometries: ImportedAirfoilGeometry[];
  polarDatasets: AerodynamicPolarDataset[];
};

export type ImportMessage = { severity: 'error' | 'warning' | 'info'; code: string; message: string; line?: number };
export type ImportResult<T> = { value?: T; messages: ImportMessage[] };

export const emptyAirfoilLibrary = (): AirfoilLibrary => ({ modelVersion: AIRFOIL_LIBRARY_MODEL_VERSION, revision: 0, geometries: [], polarDatasets: [] });
