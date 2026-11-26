export type AtmosphereResult = {
  altitudeM: number;
  temperatureK: number;
  pressurePa: number;
  densityKgM3: number;
  speedOfSoundMs: number;
  model: 'ISA-1976-troposphere';
};

const seaLevelTemperatureK = 288.15;
const seaLevelPressurePa = 101325;
const lapseRateKPerM = 0.0065;
const standardGravityMs2 = 9.80665;
const specificGasConstantJkgK = 287.05287;
const heatCapacityRatio = 1.4;

/** International Standard Atmosphere troposphere model, valid from 0 to 11,000 m. */
export function standardAtmosphere(altitudeM: number): AtmosphereResult {
  if (!Number.isFinite(altitudeM) || altitudeM < 0 || altitudeM > 11000) {
    throw new RangeError('ISA troposphere altitude must be between 0 and 11,000 m.');
  }
  const temperatureK = seaLevelTemperatureK - lapseRateKPerM * altitudeM;
  const pressurePa = seaLevelPressurePa * (temperatureK / seaLevelTemperatureK) **
    (standardGravityMs2 / (specificGasConstantJkgK * lapseRateKPerM));
  const densityKgM3 = pressurePa / (specificGasConstantJkgK * temperatureK);
  const speedOfSoundMs = Math.sqrt(heatCapacityRatio * specificGasConstantJkgK * temperatureK);
  return { altitudeM, temperatureK, pressurePa, densityKgM3, speedOfSoundMs, model: 'ISA-1976-troposphere' };
}
