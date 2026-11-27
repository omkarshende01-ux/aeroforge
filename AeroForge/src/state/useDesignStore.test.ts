import { afterEach, describe, expect, it } from 'vitest';
import { AIRCRAFT_DESIGN_SCHEMA_VERSION } from '../domain/contracts';
import { defaultDesign } from '../domain/types';
import { legacyWingView } from '../engineering/wingGeometry';
import { addControlSurface, editControlSurface } from '../engineering/controlSurfaces';
import { useDesignStore } from './useDesignStore';

describe('versioned aircraft design state', () => {
  afterEach(() => useDesignStore.setState({ design: defaultDesign, selectedSizingPoint: undefined, wingHistory: [], selectedWingStationId: defaultDesign.wing.stations[0].id, selectedControlSurfaceId: undefined }));

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

  it('routes the existing wing inspector fields through the authoritative station model', () => {
    useDesignStore.setState({ design: defaultDesign });
    useDesignStore.getState().update('wing.spanM', 14);
    const design = useDesignStore.getState().design;
    expect(legacyWingView(design.wing).spanM).toBeCloseTo(14);
    expect(design.wing.stations.at(-1)?.spanPositionM).toBeCloseTo(7);
    expect(design.revision).toBe(defaultDesign.revision + 1);
  });

  it('rejects physically invalid legacy wing edits without changing the design revision', () => {
    useDesignStore.setState({ design: defaultDesign });
    useDesignStore.getState().update('wing.rootChordM', 0);
    expect(useDesignStore.getState().design).toBe(defaultDesign);
  });

  it('undoes and resets committed wing geometry without affecting the schema contract', () => {
    useDesignStore.setState({ design: defaultDesign, wingHistory: [], selectedWingStationId: 'wing-root' });
    const edited = structuredClone(defaultDesign.wing); edited.stations[1].chordM = 1.4;
    expect(useDesignStore.getState().commitWingGeometry(edited, 'wing-tip')).toEqual([]);
    expect(useDesignStore.getState().design.wing.stations[1].chordM).toBe(1.4);
    expect(useDesignStore.getState().wingHistory).toHaveLength(1);
    useDesignStore.getState().undoWingGeometry();
    expect(useDesignStore.getState().design.wing).toEqual(defaultDesign.wing);
    expect(useDesignStore.getState().selectedWingStationId).toBe('wing-tip');
    useDesignStore.getState().commitWingGeometry(edited, 'wing-tip');
    useDesignStore.getState().resetWingGeometry();
    expect(useDesignStore.getState().design.wing).toEqual(defaultDesign.wing);
    expect(useDesignStore.getState().design.schemaVersion).toBe(AIRCRAFT_DESIGN_SCHEMA_VERSION);
  });

  it('commits valid control edits and rejects dependent wing changes that invalidate them', () => {
    useDesignStore.setState({ design: structuredClone(defaultDesign) });
    const added = addControlSurface(useDesignStore.getState().design, 'aileron');
    expect(useDesignStore.getState().commitControlSurfaces(added.model!, added.selectedControlSurfaceId)).toEqual([]);
    const edited = editControlSurface(useDesignStore.getState().design, added.selectedControlSurfaceId!, { currentDeflectionDeg: 12 });
    expect(useDesignStore.getState().commitControlSurfaces(edited.model!, edited.selectedControlSurfaceId)).toEqual([]);
    expect(useDesignStore.getState().design.controlSurfaces.surfaces[0].currentDeflectionDeg).toBe(12);

    const shortenedWing = structuredClone(useDesignStore.getState().design.wing);
    shortenedWing.stations[1].spanPositionM = 4;
    const errors = useDesignStore.getState().commitWingGeometry(shortenedWing);
    expect(errors.join(' ')).toMatch(/conflicts with a control surface.*exceeds/i);
    expect(useDesignStore.getState().design.wing.stations[1].spanPositionM).toBe(6);
  });
});
