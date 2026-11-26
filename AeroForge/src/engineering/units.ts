export type MissionUnitSystem = 'si' | 'aviation';
export type MissionQuantity = 'mass' | 'distance' | 'length' | 'speed' | 'altitude' | 'climbRate';

type UnitDefinition = {
  label: string;
  fromSi: (value: number) => number;
  toSi: (value: number) => number;
  step: number;
};

const identity = (value: number) => value;
const kilogramsPerPound = 0.45359237;
const metresPerNauticalMile = 1852;
const metresPerFoot = 0.3048;
const metresPerSecondPerKnot = 0.5144444444444445;
const metresPerSecondPerFootPerMinute = metresPerFoot / 60;

const definitions: Record<MissionUnitSystem, Record<MissionQuantity, UnitDefinition>> = {
  si: {
    mass: { label: 'kg', fromSi: identity, toSi: identity, step: 1 },
    distance: { label: 'km', fromSi: (value) => value / 1000, toSi: (value) => value * 1000, step: 10 },
    length: { label: 'm', fromSi: identity, toSi: identity, step: 10 },
    speed: { label: 'm/s', fromSi: identity, toSi: identity, step: 1 },
    altitude: { label: 'm', fromSi: identity, toSi: identity, step: 100 },
    climbRate: { label: 'm/s', fromSi: identity, toSi: identity, step: 0.1 },
  },
  aviation: {
    mass: { label: 'lb', fromSi: (value) => value / kilogramsPerPound, toSi: (value) => value * kilogramsPerPound, step: 5 },
    distance: { label: 'nmi', fromSi: (value) => value / metresPerNauticalMile, toSi: (value) => value * metresPerNauticalMile, step: 10 },
    length: { label: 'ft', fromSi: (value) => value / metresPerFoot, toSi: (value) => value * metresPerFoot, step: 50 },
    speed: { label: 'kt', fromSi: (value) => value / metresPerSecondPerKnot, toSi: (value) => value * metresPerSecondPerKnot, step: 1 },
    altitude: { label: 'ft', fromSi: (value) => value / metresPerFoot, toSi: (value) => value * metresPerFoot, step: 500 },
    climbRate: { label: 'ft/min', fromSi: (value) => value / metresPerSecondPerFootPerMinute, toSi: (value) => value * metresPerSecondPerFootPerMinute, step: 50 },
  },
};

export function missionUnit(system: MissionUnitSystem, quantity: MissionQuantity): UnitDefinition {
  return definitions[system][quantity];
}

export function convertFromSi(value: number, quantity: MissionQuantity, system: MissionUnitSystem): number {
  return missionUnit(system, quantity).fromSi(value);
}

export function convertToSi(value: number, quantity: MissionQuantity, system: MissionUnitSystem): number {
  return missionUnit(system, quantity).toSi(value);
}
