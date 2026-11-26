import { create } from 'zustand';
import type { AircraftDesign } from '../domain/types';
import { defaultDesign } from '../domain/types';
import { updateWingFromLegacyField, type LegacyWingEdit } from '../engineering/wingGeometry';

type SelectedSizingPoint = { wingLoadingNm2: number; shaftPowerLoadingWPerN: number };
type Store = {
  design: AircraftDesign;
  selectedSizingPoint?: SelectedSizingPoint;
  update: (path: string, value: number | string) => void;
  selectSizingPoint: (point: SelectedSizingPoint | undefined) => void;
};
export const useDesignStore = create<Store>((set) => ({ design: defaultDesign, selectedSizingPoint: undefined, selectSizingPoint: (selectedSizingPoint) => set({ selectedSizingPoint }), update: (path, value) => set((state) => {
  const [group, field] = path.split('.') as [keyof AircraftDesign, string];
  const current = state.design[group];
  const revision = state.design.revision + 1;
  if (group === 'wing') {
    const wing = updateWingFromLegacyField(state.design.wing, field as LegacyWingEdit, value);
    return wing === state.design.wing ? state : { design: { ...state.design, revision, wing } };
  }
  if (typeof current === 'object' && current !== null) return { design: { ...state.design, revision, [group]: { ...current, [field]: value } } };
  return { design: { ...state.design, revision, [group]: value } as AircraftDesign };
}) }));
