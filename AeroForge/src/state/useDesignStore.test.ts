import { afterEach, describe, expect, it } from 'vitest';
import { AIRCRAFT_DESIGN_SCHEMA_VERSION } from '../domain/contracts';
import { defaultDesign } from '../domain/types';
import { legacyWingView } from '../engineering/wingGeometry';
import { addControlSurface, editControlSurface } from '../engineering/controlSurfaces';
import { useDesignStore } from './useDesignStore';

describe('versioned aircraft design state', () => {
  afterEach(() => useDesignStore.setState({
    design: defaultDesign, selectedSizingPoint: undefined, wingHistory: [], fuselageHistory: [], horizontalTailHistory: [], verticalTailHistory: [],
    selectedWingStationId: defaultDesign.wing.stations[0].id, selectedFuselageStationId: defaultDesign.fuselage.stations[0].id,
    selectedHorizontalTailStationId: defaultDesign.horizontalTail.stations[0].id, selectedVerticalTailStationId: defaultDesign.verticalTail.stations[0].id,
    selectedControlSurfaceId: undefined,
  }));

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

  it('undoes and resets fuselage station geometry and rejects invalid commits', () => {
    useDesignStore.setState({ design: structuredClone(defaultDesign), fuselageHistory: [] });
    const edited = structuredClone(defaultDesign.fuselage); edited.stations[2].widthM = 1.6; edited.stations[2].heightM = 1.6;
    expect(useDesignStore.getState().commitFuselageGeometry(edited, edited.stations[2].id)).toEqual([]);
    expect(useDesignStore.getState().design.fuselage.stations[2].widthM).toBe(1.6);
    useDesignStore.getState().undoFuselageGeometry();
    expect(useDesignStore.getState().design.fuselage).toEqual(defaultDesign.fuselage);
    const invalid = structuredClone(defaultDesign.fuselage); invalid.stations[2].widthM = -1;
    expect(useDesignStore.getState().commitFuselageGeometry(invalid).join(' ')).toMatch(/nonnegative/);
    useDesignStore.getState().commitFuselageGeometry(edited); useDesignStore.getState().resetFuselageGeometry();
    expect(useDesignStore.getState().design.fuselage).toEqual(defaultDesign.fuselage);
  });

  it('preserves attached elevators and rudders when tail edits remain compatible and blocks incompatible edits', () => {
    const design = structuredClone(defaultDesign);
    const elevator = addControlSurface(design, 'elevator');
    design.controlSurfaces = elevator.model!;
    const rudder = addControlSurface(design, 'rudder');
    design.controlSurfaces = rudder.model!;
    useDesignStore.setState({ design, horizontalTailHistory: [], verticalTailHistory: [] });

    const horizontal = structuredClone(design.horizontalTail); horizontal.stations[1].chordM *= 0.9;
    expect(useDesignStore.getState().commitHorizontalTailGeometry(horizontal)).toEqual([]);
    expect(useDesignStore.getState().design.controlSurfaces.surfaces.some((surface) => surface.kind === 'elevator')).toBe(true);
    useDesignStore.getState().undoHorizontalTailGeometry();
    expect(useDesignStore.getState().design.horizontalTail).toEqual(design.horizontalTail);

    const vertical = structuredClone(design.verticalTail); vertical.stations[1].spanPositionM = 0.5;
    expect(useDesignStore.getState().commitVerticalTailGeometry(vertical).join(' ')).toMatch(/conflicts.*(exceeds|crosses)/i);
    expect(useDesignStore.getState().design.verticalTail).toEqual(design.verticalTail);
  });
});
