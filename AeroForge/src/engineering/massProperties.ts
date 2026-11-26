import type { AircraftDesign } from '../domain/types';

export type MassPropertiesResult = { accountedMassKg: number; centerOfGravityXM: number | undefined; massDifferenceKg: number; warnings: string[] };

export function calculateMassProperties(design: AircraftDesign): MassPropertiesResult {
  const model = design.massModel;
  const components = [
    [model.airframeMassKg, model.airframeXM], [model.propulsionMassKg, model.propulsionXM],
    [model.energyMassKg, model.energyXM], [model.payloadMassKg, model.payloadXM],
  ];
  const warnings: string[] = [];
  if (components.some(([mass]) => mass < 0)) warnings.push('Component masses cannot be negative.');
  if (components.some(([, x]) => !Number.isFinite(x))) warnings.push('Component stations must be finite.');
  const valid = warnings.length === 0;
  const accountedMassKg = valid ? components.reduce((sum, [mass]) => sum + mass, 0) : 0;
  const centerOfGravityXM = accountedMassKg > 0 ? components.reduce((moment, [mass, x]) => moment + mass * x, 0) / accountedMassKg : undefined;
  const massDifferenceKg = accountedMassKg - design.massKg;
  if (valid && Math.abs(massDifferenceKg) > Math.max(1, design.massKg * 0.005)) warnings.push('Component mass total does not match the authoritative takeoff mass.');
  return { accountedMassKg, centerOfGravityXM, massDifferenceKg, warnings };
}
