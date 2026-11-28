import type { WingGeometry, WingSection, WingStation, WingSymmetry } from '../domain/types';
import { physicalWingStations, validateWingGeometry } from './wingGeometry';

export type WingStationNumericField = 'spanPositionM' | 'chordM' | 'leadingEdgeXM' | 'geometricTwistDeg';
export type WingEditResult = { wing?: WingGeometry; errors: string[]; selectedStationId?: string };

function accepted(wing: WingGeometry, selectedStationId?: string): WingEditResult {
  const validation = validateWingGeometry(wing, undefined, true);
  return validation.valid ? { wing, errors: [], selectedStationId } : { errors: validation.errors };
}

function rejected(message: string): WingEditResult { return { errors: [message] }; }

function uniqueId(wing: WingGeometry, prefix: 'station' | 'section'): string {
  const existing = new Set(prefix === 'station' ? wing.stations.map((item) => item.id) : wing.sections.map((item) => item.id));
  let index = 1;
  while (existing.has(`wing-${prefix}-${index}`)) index += 1;
  return `wing-${prefix}-${index}`;
}

function stationAtFraction(from: WingStation, to: WingStation, fraction: number, id: string): WingStation {
  const interpolate = (a: number, b: number) => a + fraction * (b - a);
  return {
    id,
    spanPositionM: interpolate(from.spanPositionM, to.spanPositionM),
    chordM: interpolate(from.chordM, to.chordM),
    leadingEdgeXM: interpolate(from.leadingEdgeXM, to.leadingEdgeXM),
    geometricTwistDeg: interpolate(from.geometricTwistDeg, to.geometricTwistDeg),
    airfoilId: fraction < 0.5 ? from.airfoilId : to.airfoilId,
  };
}

export function editWingStation(wing: WingGeometry, stationId: string, patch: Partial<Omit<WingStation, 'id'>>): WingEditResult {
  const index = wing.stations.findIndex((station) => station.id === stationId);
  if (index < 0) return rejected(`Wing station "${stationId}" was not found.`);
  if (patch.spanPositionM !== undefined && Math.abs(wing.stations[index].spanPositionM) <= 1e-9 && Math.abs(patch.spanPositionM) > 1e-9) return rejected('The root station is fixed at y = 0 m. Edit another station or change symmetry first.');
  const stations = wing.stations.map((station, stationIndex) => stationIndex === index ? { ...station, ...patch } : { ...station });
  return accepted({ ...wing, stations, sections: wing.sections.map((section) => ({ ...section })) }, stationId);
}

export function editWingSection(wing: WingGeometry, sectionId: string, patch: Partial<Pick<WingSection, 'dihedralDeg'>>): WingEditResult {
  const index = wing.sections.findIndex((section) => section.id === sectionId);
  if (index < 0) return rejected(`Wing section "${sectionId}" was not found.`);
  const sections = wing.sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : { ...section });
  return accepted({ ...wing, stations: wing.stations.map((station) => ({ ...station })), sections }, wing.sections[index].fromStationId);
}

export function editWingSectionSweep(wing: WingGeometry, sectionId: string, leadingEdgeSweepDeg: number): WingEditResult {
  const sectionIndex = wing.sections.findIndex((section) => section.id === sectionId);
  if (sectionIndex < 0) return rejected(`Wing section "${sectionId}" was not found.`);
  if (!Number.isFinite(leadingEdgeSweepDeg) || Math.abs(leadingEdgeSweepDeg) >= 89) return rejected('Leading-edge sweep must be finite and within (-89, 89) deg.');
  const from = wing.stations[sectionIndex]; const to = wing.stations[sectionIndex + 1];
  const dy = to.spanPositionM - from.spanPositionM;
  return editWingStation(wing, to.id, { leadingEdgeXM: from.leadingEdgeXM + dy * Math.tan(leadingEdgeSweepDeg * Math.PI / 180) });
}

export function insertWingStationAfter(wing: WingGeometry, stationId: string): WingEditResult {
  const index = wing.stations.findIndex((station) => station.id === stationId);
  if (index < 0) return rejected(`Wing station "${stationId}" was not found.`);
  if (index >= wing.stations.length - 1) return rejected('Select a station with an outboard neighbor to insert between stations.');
  const newStation = stationAtFraction(wing.stations[index], wing.stations[index + 1], 0.5, uniqueId(wing, 'station'));
  const sourceSection = wing.sections[index];
  const firstSection: WingSection = { ...sourceSection, id: uniqueId(wing, 'section'), toStationId: newStation.id };
  const secondSection: WingSection = { ...sourceSection, fromStationId: newStation.id };
  const stations = [...wing.stations.slice(0, index + 1), newStation, ...wing.stations.slice(index + 1)].map((station) => ({ ...station }));
  const sections = [...wing.sections.slice(0, index), firstSection, secondSection, ...wing.sections.slice(index + 1)].map((section) => ({ ...section }));
  return accepted({ ...wing, stations, sections }, newStation.id);
}

export function addOutboardWingStation(wing: WingGeometry): WingEditResult {
  const last = wing.stations.at(-1); const previous = wing.stations.at(-2);
  if (!last || !previous) return rejected('At least two stations are required before adding an outboard station.');
  const spacing = last.spanPositionM - previous.spanPositionM;
  const newStation: WingStation = { ...last, id: uniqueId(wing, 'station'), spanPositionM: last.spanPositionM + spacing, leadingEdgeXM: last.leadingEdgeXM + (last.leadingEdgeXM - previous.leadingEdgeXM) };
  const sourceSection = wing.sections.at(-1)!;
  const newSection: WingSection = { ...sourceSection, id: uniqueId(wing, 'section'), fromStationId: last.id, toStationId: newStation.id };
  return accepted({ ...wing, stations: [...wing.stations.map((station) => ({ ...station })), newStation], sections: [...wing.sections.map((section) => ({ ...section })), newSection] }, newStation.id);
}

export function duplicateWingStation(wing: WingGeometry, stationId: string): WingEditResult {
  const index = wing.stations.findIndex((station) => station.id === stationId);
  if (index < 0) return rejected(`Wing station "${stationId}" was not found.`);
  if (index < wing.stations.length - 1) {
    const inserted = insertWingStationAfter(wing, stationId);
    if (!inserted.wing || !inserted.selectedStationId) return inserted;
    return editWingStation(inserted.wing, inserted.selectedStationId, {
      chordM: wing.stations[index].chordM,
      leadingEdgeXM: wing.stations[index].leadingEdgeXM,
      geometricTwistDeg: wing.stations[index].geometricTwistDeg,
      airfoilId: wing.stations[index].airfoilId,
    });
  }
  const added = addOutboardWingStation(wing);
  if (!added.wing || !added.selectedStationId) return added;
  return editWingStation(added.wing, added.selectedStationId, {
    chordM: wing.stations[index].chordM,
    leadingEdgeXM: wing.stations[index].leadingEdgeXM,
    geometricTwistDeg: wing.stations[index].geometricTwistDeg,
    airfoilId: wing.stations[index].airfoilId,
  });
}

export function removeWingStation(wing: WingGeometry, stationId: string): WingEditResult {
  const index = wing.stations.findIndex((station) => station.id === stationId);
  if (index < 0) return rejected(`Wing station "${stationId}" was not found.`);
  if (Math.abs(wing.stations[index].spanPositionM) <= 1e-9) return rejected('The y = 0 m root station cannot be removed.');
  if (wing.symmetry === 'symmetric' && wing.stations.length <= 2) return rejected('A symmetric wing requires at least root and tip stations.');
  if (wing.symmetry === 'asymmetric' && wing.stations.length <= 3) return rejected('An asymmetric wing requires port tip, root, and starboard tip stations.');
  const stations = wing.stations.filter((_, stationIndex) => stationIndex !== index).map((station) => ({ ...station }));
  const sections = wing.sections.map((section) => ({ ...section }));
  if (index === wing.stations.length - 1) sections.splice(index - 1, 1);
  else if (index === 0) sections.splice(0, 1);
  else {
    const merged = { ...sections[index - 1], toStationId: stations[index].id };
    sections.splice(index - 1, 2, merged);
  }
  const selected = stations[Math.min(index, stations.length - 1)].id;
  return accepted({ ...wing, stations, sections }, selected);
}

export function changeWingSymmetry(wing: WingGeometry, symmetry: WingSymmetry): WingEditResult {
  if (wing.symmetry === symmetry) return accepted(wing, wing.stations[0]?.id);
  if (symmetry === 'asymmetric') {
    const physical = physicalWingStations(wing, undefined, true);
    const stations: WingStation[] = physical.map(({ verticalPositionM: _verticalPositionM, ...station }) => ({ ...station }));
    const sections: WingSection[] = stations.slice(0, -1).map((station, index) => {
      const sourceIndex = index < wing.stations.length - 1 ? wing.stations.length - 2 - index : index - (wing.stations.length - 1);
      const source = wing.sections[sourceIndex];
      return { id: index < wing.stations.length - 1 ? `${source.id}-mirrored` : source.id, fromStationId: station.id, toStationId: stations[index + 1].id, dihedralDeg: index < wing.stations.length - 1 ? -source.dihedralDeg : source.dihedralDeg };
    });
    return accepted({ ...wing, symmetry, stations, sections }, wing.stations[0].id);
  }
  const rootIndex = wing.stations.findIndex((station) => Math.abs(station.spanPositionM) <= 1e-9);
  const stations = wing.stations.slice(rootIndex).map((station) => ({ ...station, id: station.id.replace(/-mirrored$/, '') }));
  const sections = wing.sections.slice(rootIndex).map((section, index) => ({ ...section, id: section.id.replace(/-mirrored$/, ''), fromStationId: stations[index].id, toStationId: stations[index + 1].id }));
  return accepted({ ...wing, symmetry, stations, sections }, stations[0].id);
}

export function sectionSweepDeg(wing: WingGeometry, sectionIndex: number): number {
  const from = wing.stations[sectionIndex]; const to = wing.stations[sectionIndex + 1];
  return Math.atan2(to.leadingEdgeXM - from.leadingEdgeXM, to.spanPositionM - from.spanPositionM) * 180 / Math.PI;
}
