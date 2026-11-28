import { create } from 'zustand';
import type { AircraftDesign, ControlSurfaceModel, FuselageGeometry, HorizontalTailGeometry, VerticalTailGeometry, WingGeometry } from '../domain/types';
import { defaultDesign } from '../domain/types';
import { updateWingFromLegacyField, validateWingGeometry, type LegacyWingEdit } from '../engineering/wingGeometry';
import { validateControlSurfaceModel } from '../engineering/controlSurfaces';
import { validateFuselageGeometry } from '../engineering/fuselageGeometry';
import { validateHorizontalTailGeometry, validateVerticalTailGeometry } from '../engineering/tailGeometry';
import type { AerodynamicMesh } from '../domain/analysisGeometry';
import type { AerodynamicPolarDataset, AirfoilLibrary, ImportedAirfoilGeometry } from '../domain/airfoilData';
import { emptyAirfoilLibrary } from '../domain/airfoilData';
import { referencedAirfoilIds, registerAirfoilGeometry, registerPolarDatasets, removeAirfoilGeometry, removePolarDataset } from '../engineering/airfoilData';

type SelectedSizingPoint = { wingLoadingNm2: number; shaftPowerLoadingWPerN: number };
type Store = {
  design: AircraftDesign;
  airfoilLibrary: AirfoilLibrary;
  wingHistory: WingGeometry[];
  fuselageHistory: FuselageGeometry[];
  horizontalTailHistory: HorizontalTailGeometry[];
  verticalTailHistory: VerticalTailGeometry[];
  selectedWingStationId?: string;
  selectedFuselageStationId?: string;
  selectedHorizontalTailStationId?: string;
  selectedVerticalTailStationId?: string;
  selectedControlSurfaceId?: string;
  analysisMesh?: AerodynamicMesh;
  selectedSizingPoint?: SelectedSizingPoint;
  update: (path: string, value: number | string) => void;
  commitWingGeometry: (wing: WingGeometry, selectedStationId?: string) => string[];
  selectWingStation: (stationId: string | undefined) => void;
  undoWingGeometry: () => void;
  resetWingGeometry: () => void;
  commitFuselageGeometry: (fuselage: FuselageGeometry, selectedStationId?: string) => string[];
  selectFuselageStation: (stationId: string | undefined) => void;
  undoFuselageGeometry: () => void;
  resetFuselageGeometry: () => void;
  commitHorizontalTailGeometry: (tail: HorizontalTailGeometry, selectedStationId?: string) => string[];
  selectHorizontalTailStation: (stationId: string | undefined) => void;
  undoHorizontalTailGeometry: () => void;
  resetHorizontalTailGeometry: () => void;
  commitVerticalTailGeometry: (tail: VerticalTailGeometry, selectedStationId?: string) => string[];
  selectVerticalTailStation: (stationId: string | undefined) => void;
  undoVerticalTailGeometry: () => void;
  resetVerticalTailGeometry: () => void;
  commitControlSurfaces: (model: ControlSurfaceModel, selectedControlSurfaceId?: string) => string[];
  selectControlSurface: (controlSurfaceId: string | undefined) => void;
  setAnalysisMesh: (analysisMesh: AerodynamicMesh | undefined) => void;
  selectSizingPoint: (point: SelectedSizingPoint | undefined) => void;
  registerAirfoilGeometry: (geometry: ImportedAirfoilGeometry) => string[];
  registerPolarDatasets: (datasets: AerodynamicPolarDataset[]) => string[];
  removeAirfoilGeometry: (airfoilId: string) => string[];
  removePolarDataset: (datasetId: string) => string[];
};
export const useDesignStore = create<Store>((set, get) => ({
  design: defaultDesign,
  airfoilLibrary: emptyAirfoilLibrary(),
  wingHistory: [],
  fuselageHistory: [], horizontalTailHistory: [], verticalTailHistory: [],
  selectedWingStationId: defaultDesign.wing.stations[0].id,
  selectedFuselageStationId: defaultDesign.fuselage.stations[0].id,
  selectedHorizontalTailStationId: defaultDesign.horizontalTail.stations[0].id,
  selectedVerticalTailStationId: defaultDesign.verticalTail.stations[0].id,
  selectedControlSurfaceId: undefined,
  analysisMesh: undefined,
  selectedSizingPoint: undefined,
  selectSizingPoint: (selectedSizingPoint) => set({ selectedSizingPoint }),
  selectWingStation: (selectedWingStationId) => set({ selectedWingStationId }),
  selectFuselageStation: (selectedFuselageStationId) => set({ selectedFuselageStationId }),
  selectHorizontalTailStation: (selectedHorizontalTailStationId) => set({ selectedHorizontalTailStationId }),
  selectVerticalTailStation: (selectedVerticalTailStationId) => set({ selectedVerticalTailStationId }),
  selectControlSurface: (selectedControlSurfaceId) => set({ selectedControlSurfaceId }),
  setAnalysisMesh: (analysisMesh) => set({ analysisMesh }),
  registerAirfoilGeometry: (geometry) => { const result = registerAirfoilGeometry(get().airfoilLibrary, geometry); if (result.value) set({ airfoilLibrary: result.value }); return result.messages.map((item) => item.message); },
  registerPolarDatasets: (datasets) => { const result = registerPolarDatasets(get().airfoilLibrary, datasets); if (result.value) set({ airfoilLibrary: result.value }); return result.messages.map((item) => item.message); },
  removeAirfoilGeometry: (airfoilId) => { const state = get(); const result = removeAirfoilGeometry(state.airfoilLibrary, airfoilId, referencedAirfoilIds(state.design)); if (result.value) set({ airfoilLibrary: result.value }); return result.messages.map((item) => item.message); },
  removePolarDataset: (datasetId) => { const result = removePolarDataset(get().airfoilLibrary, datasetId); if (result.value) set({ airfoilLibrary: result.value }); return result.messages.map((item) => item.message); },
  commitWingGeometry: (wing, selectedStationId) => {
    const validation = validateWingGeometry(wing, get().airfoilLibrary);
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
  commitFuselageGeometry: (fuselage, selectedFuselageStationId) => {
    const validation = validateFuselageGeometry(fuselage); if (!validation.valid) return validation.errors; const state = get();
    set({ design: { ...state.design, revision: state.design.revision + 1, fuselage }, fuselageHistory: [...state.fuselageHistory.slice(-49), structuredClone(state.design.fuselage)], selectedFuselageStationId: selectedFuselageStationId ?? state.selectedFuselageStationId }); return [];
  },
  undoFuselageGeometry: () => set((state) => { const previous = state.fuselageHistory.at(-1); if (!previous) return state; return { design: { ...state.design, revision: state.design.revision + 1, fuselage: previous }, fuselageHistory: state.fuselageHistory.slice(0, -1), selectedFuselageStationId: previous.stations.some((station) => station.id === state.selectedFuselageStationId) ? state.selectedFuselageStationId : previous.stations[0].id }; }),
  resetFuselageGeometry: () => set((state) => ({ design: { ...state.design, revision: state.design.revision + 1, fuselage: structuredClone(defaultDesign.fuselage) }, fuselageHistory: [...state.fuselageHistory.slice(-49), structuredClone(state.design.fuselage)], selectedFuselageStationId: defaultDesign.fuselage.stations[0].id })),
  commitHorizontalTailGeometry: (horizontalTail, selectedHorizontalTailStationId) => {
    const validation = validateHorizontalTailGeometry(horizontalTail, get().airfoilLibrary); if (!validation.valid) return validation.errors; const state = get(); const prospective = { ...state.design, horizontalTail }; const controls = validateControlSurfaceModel(prospective); if (!controls.valid) return controls.errors.map((error) => `Horizontal-tail change conflicts with a control surface: ${error}`);
    set({ design: { ...state.design, revision: state.design.revision + 1, horizontalTail }, horizontalTailHistory: [...state.horizontalTailHistory.slice(-49), structuredClone(state.design.horizontalTail)], selectedHorizontalTailStationId: selectedHorizontalTailStationId ?? state.selectedHorizontalTailStationId }); return [];
  },
  undoHorizontalTailGeometry: () => set((state) => { const previous = state.horizontalTailHistory.at(-1); if (!previous || !validateControlSurfaceModel({ ...state.design, horizontalTail: previous }).valid) return state; return { design: { ...state.design, revision: state.design.revision + 1, horizontalTail: previous }, horizontalTailHistory: state.horizontalTailHistory.slice(0, -1), selectedHorizontalTailStationId: previous.stations.some((station) => station.id === state.selectedHorizontalTailStationId) ? state.selectedHorizontalTailStationId : previous.stations[0].id }; }),
  resetHorizontalTailGeometry: () => set((state) => { const horizontalTail = structuredClone(defaultDesign.horizontalTail); if (!validateControlSurfaceModel({ ...state.design, horizontalTail }).valid) return state; return { design: { ...state.design, revision: state.design.revision + 1, horizontalTail }, horizontalTailHistory: [...state.horizontalTailHistory.slice(-49), structuredClone(state.design.horizontalTail)], selectedHorizontalTailStationId: horizontalTail.stations[0].id }; }),
  commitVerticalTailGeometry: (verticalTail, selectedVerticalTailStationId) => {
    const validation = validateVerticalTailGeometry(verticalTail, get().airfoilLibrary); if (!validation.valid) return validation.errors; const state = get(); const prospective = { ...state.design, verticalTail }; const controls = validateControlSurfaceModel(prospective); if (!controls.valid) return controls.errors.map((error) => `Vertical-tail change conflicts with a control surface: ${error}`);
    set({ design: { ...state.design, revision: state.design.revision + 1, verticalTail }, verticalTailHistory: [...state.verticalTailHistory.slice(-49), structuredClone(state.design.verticalTail)], selectedVerticalTailStationId: selectedVerticalTailStationId ?? state.selectedVerticalTailStationId }); return [];
  },
  undoVerticalTailGeometry: () => set((state) => { const previous = state.verticalTailHistory.at(-1); if (!previous || !validateControlSurfaceModel({ ...state.design, verticalTail: previous }).valid) return state; return { design: { ...state.design, revision: state.design.revision + 1, verticalTail: previous }, verticalTailHistory: state.verticalTailHistory.slice(0, -1), selectedVerticalTailStationId: previous.stations.some((station) => station.id === state.selectedVerticalTailStationId) ? state.selectedVerticalTailStationId : previous.stations[0].id }; }),
  resetVerticalTailGeometry: () => set((state) => { const verticalTail = structuredClone(defaultDesign.verticalTail); if (!validateControlSurfaceModel({ ...state.design, verticalTail }).valid) return state; return { design: { ...state.design, revision: state.design.revision + 1, verticalTail }, verticalTailHistory: [...state.verticalTailHistory.slice(-49), structuredClone(state.design.verticalTail)], selectedVerticalTailStationId: verticalTail.stations[0].id }; }),
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
