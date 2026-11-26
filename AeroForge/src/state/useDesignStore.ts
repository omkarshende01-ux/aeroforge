import { create } from 'zustand';
import type { AircraftDesign, WingGeometry } from '../domain/types';
import { defaultDesign } from '../domain/types';
import { updateWingFromLegacyField, validateWingGeometry, type LegacyWingEdit } from '../engineering/wingGeometry';

type SelectedSizingPoint = { wingLoadingNm2: number; shaftPowerLoadingWPerN: number };
type Store = {
  design: AircraftDesign;
  wingHistory: WingGeometry[];
  selectedWingStationId?: string;
  selectedSizingPoint?: SelectedSizingPoint;
  update: (path: string, value: number | string) => void;
  commitWingGeometry: (wing: WingGeometry, selectedStationId?: string) => string[];
  selectWingStation: (stationId: string | undefined) => void;
  undoWingGeometry: () => void;
  resetWingGeometry: () => void;
  selectSizingPoint: (point: SelectedSizingPoint | undefined) => void;
};
export const useDesignStore = create<Store>((set) => ({
  design: defaultDesign,
  wingHistory: [],
  selectedWingStationId: defaultDesign.wing.stations[0].id,
  selectedSizingPoint: undefined,
  selectSizingPoint: (selectedSizingPoint) => set({ selectedSizingPoint }),
  selectWingStation: (selectedWingStationId) => set({ selectedWingStationId }),
  commitWingGeometry: (wing, selectedStationId) => {
    const validation = validateWingGeometry(wing);
    if (!validation.valid) return validation.errors;
    set((state) => ({
      design: { ...state.design, revision: state.design.revision + 1, wing },
      wingHistory: [...state.wingHistory.slice(-49), structuredClone(state.design.wing)],
      selectedWingStationId: selectedStationId ?? state.selectedWingStationId,
    }));
    return [];
  },
  undoWingGeometry: () => set((state) => {
    const previous = state.wingHistory.at(-1);
    if (!previous) return state;
    const selectedExists = previous.stations.some((station) => station.id === state.selectedWingStationId);
    return {
      design: { ...state.design, revision: state.design.revision + 1, wing: previous },
      wingHistory: state.wingHistory.slice(0, -1),
      selectedWingStationId: selectedExists ? state.selectedWingStationId : previous.stations[0].id,
    };
  }),
  resetWingGeometry: () => set((state) => ({
    design: { ...state.design, revision: state.design.revision + 1, wing: structuredClone(defaultDesign.wing) },
    wingHistory: [...state.wingHistory.slice(-49), structuredClone(state.design.wing)],
    selectedWingStationId: defaultDesign.wing.stations[0].id,
  })),
  update: (path, value) => set((state) => {
  const [group, field] = path.split('.') as [keyof AircraftDesign, string];
  const current = state.design[group];
  const revision = state.design.revision + 1;
  if (group === 'wing') {
    const wing = updateWingFromLegacyField(state.design.wing, field as LegacyWingEdit, value);
    return wing === state.design.wing ? state : { design: { ...state.design, revision, wing }, wingHistory: [...state.wingHistory.slice(-49), structuredClone(state.design.wing)] };
  }
  if (typeof current === 'object' && current !== null) return { design: { ...state.design, revision, [group]: { ...current, [field]: value } } };
  return { design: { ...state.design, revision, [group]: value } as AircraftDesign };
  }),
}));
