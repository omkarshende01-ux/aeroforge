import { create } from 'zustand';
import type { AircraftDesign, ControlSurfaceModel, WingGeometry } from '../domain/types';
import { defaultDesign } from '../domain/types';
import { updateWingFromLegacyField, validateWingGeometry, type LegacyWingEdit } from '../engineering/wingGeometry';
import { validateControlSurfaceModel } from '../engineering/controlSurfaces';

type SelectedSizingPoint = { wingLoadingNm2: number; shaftPowerLoadingWPerN: number };
type Store = {
  design: AircraftDesign;
  wingHistory: WingGeometry[];
  selectedWingStationId?: string;
  selectedControlSurfaceId?: string;
  selectedSizingPoint?: SelectedSizingPoint;
  update: (path: string, value: number | string) => void;
  commitWingGeometry: (wing: WingGeometry, selectedStationId?: string) => string[];
  selectWingStation: (stationId: string | undefined) => void;
  undoWingGeometry: () => void;
  resetWingGeometry: () => void;
  commitControlSurfaces: (model: ControlSurfaceModel, selectedControlSurfaceId?: string) => string[];
  selectControlSurface: (controlSurfaceId: string | undefined) => void;
  selectSizingPoint: (point: SelectedSizingPoint | undefined) => void;
};
export const useDesignStore = create<Store>((set, get) => ({
  design: defaultDesign,
  wingHistory: [],
  selectedWingStationId: defaultDesign.wing.stations[0].id,
  selectedControlSurfaceId: undefined,
  selectedSizingPoint: undefined,
  selectSizingPoint: (selectedSizingPoint) => set({ selectedSizingPoint }),
  selectWingStation: (selectedWingStationId) => set({ selectedWingStationId }),
  selectControlSurface: (selectedControlSurfaceId) => set({ selectedControlSurfaceId }),
  commitWingGeometry: (wing, selectedStationId) => {
    const validation = validateWingGeometry(wing);
    if (!validation.valid) return validation.errors;
    const state = get();
    const prospective = { ...state.design, wing };
    const controls = validateControlSurfaceModel(prospective);
    if (!controls.valid) return controls.errors.map((error) => `Wing change conflicts with a control surface: ${error}`);
    set(() => ({
      design: { ...state.design, revision: state.design.revision + 1, wing },
      wingHistory: [...state.wingHistory.slice(-49), structuredClone(state.design.wing)],
      selectedWingStationId: selectedStationId ?? state.selectedWingStationId,
    }));
    return [];
  },
  commitControlSurfaces: (controlSurfaces, selectedControlSurfaceId) => {
    const state = get(); const prospective = { ...state.design, controlSurfaces };
    const validation = validateControlSurfaceModel(prospective, controlSurfaces);
    if (!validation.valid) return validation.errors;
    set({ design: { ...state.design, revision: state.design.revision + 1, controlSurfaces }, selectedControlSurfaceId });
    return [];
  },
  undoWingGeometry: () => set((state) => {
    const previous = state.wingHistory.at(-1);
    if (!previous) return state;
    if (!validateControlSurfaceModel({ ...state.design, wing: previous }).valid) return state;
    const selectedExists = previous.stations.some((station) => station.id === state.selectedWingStationId);
    return {
      design: { ...state.design, revision: state.design.revision + 1, wing: previous },
      wingHistory: state.wingHistory.slice(0, -1),
      selectedWingStationId: selectedExists ? state.selectedWingStationId : previous.stations[0].id,
    };
  }),
  resetWingGeometry: () => set((state) => {
    const wing = structuredClone(defaultDesign.wing);
    if (!validateControlSurfaceModel({ ...state.design, wing }).valid) return state;
    return {
      design: { ...state.design, revision: state.design.revision + 1, wing },
      wingHistory: [...state.wingHistory.slice(-49), structuredClone(state.design.wing)],
      selectedWingStationId: defaultDesign.wing.stations[0].id,
    };
  }),
  update: (path, value) => set((state) => {
  const [group, field] = path.split('.') as [keyof AircraftDesign, string];
  const current = state.design[group];
  const revision = state.design.revision + 1;
  if (group === 'wing') {
    const wing = updateWingFromLegacyField(state.design.wing, field as LegacyWingEdit, value);
    if (wing === state.design.wing) return state;
    const prospective = { ...state.design, wing };
    if (!validateControlSurfaceModel(prospective).valid) return state;
    return { design: { ...state.design, revision, wing }, wingHistory: [...state.wingHistory.slice(-49), structuredClone(state.design.wing)] };
  }
  if (typeof current === 'object' && current !== null) {
    const prospective = { ...state.design, revision, [group]: { ...current, [field]: value } } as AircraftDesign;
    if ((group === 'horizontalTail' || group === 'verticalTail') && !validateControlSurfaceModel(prospective).valid) return state;
    return { design: prospective };
  }
  return { design: { ...state.design, revision, [group]: value } as AircraftDesign };
  }),
}));
