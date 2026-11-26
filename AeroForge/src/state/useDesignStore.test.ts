import { afterEach, describe, expect, it } from 'vitest';
import { AIRCRAFT_DESIGN_SCHEMA_VERSION } from '../domain/contracts';
import { defaultDesign } from '../domain/types';
import { useDesignStore } from './useDesignStore';

describe('versioned aircraft design state', () => {
  afterEach(() => useDesignStore.setState({ design: defaultDesign }));

  it('preserves the schema version and increments the design revision on edits', () => {
    useDesignStore.setState({ design: defaultDesign });
    useDesignStore.getState().update('mission.cruiseSpeedMs', 55);
    const design = useDesignStore.getState().design;
    expect(design.schemaVersion).toBe(AIRCRAFT_DESIGN_SCHEMA_VERSION);
    expect(design.revision).toBe(defaultDesign.revision + 1);
    expect(design.mission.cruiseSpeedMs).toBe(55);
  });
});
