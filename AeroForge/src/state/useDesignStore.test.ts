import { afterEach, describe, expect, it } from 'vitest';
import { AIRCRAFT_DESIGN_SCHEMA_VERSION } from '../domain/contracts';
import { defaultDesign } from '../domain/types';
import { useDesignStore } from './useDesignStore';

describe('versioned aircraft design state', () => {
  afterEach(() => useDesignStore.setState({ design: defaultDesign, selectedSizingPoint: undefined }));

  it('preserves the schema version and increments the design revision on edits', () => {
    useDesignStore.setState({ design: defaultDesign });
    useDesignStore.getState().update('mission.cruiseSpeedMs', 55);
    const design = useDesignStore.getState().design;
    expect(design.schemaVersion).toBe(AIRCRAFT_DESIGN_SCHEMA_VERSION);
    expect(design.revision).toBe(defaultDesign.revision + 1);
    expect(design.mission.cruiseSpeedMs).toBe(55);
  });

  it('shares a sizing point without mutating the aircraft design revision', () => {
    useDesignStore.setState({ design: defaultDesign, selectedSizingPoint: undefined });
    useDesignStore.getState().selectSizingPoint({ wingLoadingNm2: 720, shaftPowerLoadingWPerN: 14 });
    expect(useDesignStore.getState().selectedSizingPoint).toEqual({ wingLoadingNm2: 720, shaftPowerLoadingWPerN: 14 });
    expect(useDesignStore.getState().design.revision).toBe(defaultDesign.revision);
  });
});
