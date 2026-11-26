export const AIRCRAFT_DESIGN_SCHEMA_VERSION = 2 as const;

export type EngineeringValidity = 'valid' | 'partial' | 'invalid';

export type EngineeringSource = {
  title: string;
  reference: string;
};

export type EngineeringResultContract = {
  schemaVersion: typeof AIRCRAFT_DESIGN_SCHEMA_VERSION;
  designRevision: number;
  modelId: string;
  modelVersion: string;
  validity: EngineeringValidity;
  assumptions: string[];
  warnings: string[];
  sources: EngineeringSource[];
};
