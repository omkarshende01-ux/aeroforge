import type { AircraftDesign, DesignMetrics } from '../domain/types';
import { standardAtmosphere } from './atmosphere';
import { calculateWingReferenceProperties, validateWingGeometry } from './wingGeometry';

const g = 9.80665;
const msToKt = 1.943844492;

export function calculateMetrics(design: AircraftDesign): DesignMetrics {
  const geometryValidation = validateWingGeometry(design.wing);
  const geometry = geometryValidation.valid ? calculateWingReferenceProperties(design.wing) : undefined;
  const area = geometry?.projectedAreaM2 ?? 0;
  const ar = geometry?.aspectRatio ?? 0;
  const mac = geometry?.meanAerodynamicChordM ?? 0;
  const ct = geometry?.tipChordM ?? 0;
  const wingLoading = area > 0 ? design.massKg * g / area : 0;
  const warnings: string[] = [...geometryValidation.errors];
  let rho = design.flightCondition.densityKgM3;
  if (design.flightCondition.densitySource === 'isa') {
    try { rho = standardAtmosphere(design.flightCondition.altitudeM).densityKgM3; }
    catch { rho = 0; }
  }
  const { clMax } = design.flightCondition;
  const valid = design.massKg > 0 && area > 0 && rho > 0 && clMax > 0;
  if (design.massKg <= 0) warnings.push('Mass must be positive.');
  if (area <= 0) warnings.push('Wing area requires positive span and chord.');
  if (rho <= 0) warnings.push('Density must be positive for a stall estimate.');
  if (clMax <= 0) warnings.push('CLmax must be positive for a stall estimate.');
  const stall = valid ? Math.sqrt((2 * design.massKg * g) / (rho * area * clMax)) : undefined;
  return { wingAreaM2: area, aspectRatio: ar, macM: mac, tipChordM: ct, wingLoadingNm2: wingLoading, stallSpeedMs: stall, stallSpeedKt: stall === undefined ? undefined : stall * msToKt, warnings };
}
