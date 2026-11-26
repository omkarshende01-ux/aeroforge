import { create } from 'zustand';
import type { AircraftDesign } from '../domain/types';
import { defaultDesign } from '../domain/types';

type Store = { design: AircraftDesign; update: (path: string, value: number | string) => void };
export const useDesignStore = create<Store>((set) => ({ design: defaultDesign, update: (path, value) => set((state) => {
  const [group, field] = path.split('.') as [keyof AircraftDesign, string];
  const current = state.design[group];
  const revision = state.design.revision + 1;
  if (typeof current === 'object' && current !== null) return { design: { ...state.design, revision, [group]: { ...current, [field]: value } } };
  return { design: { ...state.design, revision, [group]: value } as AircraftDesign };
}) }));
