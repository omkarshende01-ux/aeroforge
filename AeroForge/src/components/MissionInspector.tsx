import { useState } from 'react';
import type { MissionRequirements } from '../domain/types';
import { missionBounds, validateMissionRequirements } from '../engineering/mission';
import { convertFromSi, convertToSi, missionUnit, type MissionQuantity, type MissionUnitSystem } from '../engineering/units';
import { useDesignStore } from '../state/useDesignStore';

type NumericMissionField = Exclude<keyof MissionRequirements, 'aircraftCategory' | 'designObjective'>;

type MissionFieldProps = {
  field: NumericMissionField;
  label: string;
  quantity: MissionQuantity;
  units: MissionUnitSystem;
};

function MissionField({ field, label, quantity, units }: MissionFieldProps) {
  const mission = useDesignStore((state) => state.design.mission);
  const update = useDesignStore((state) => state.update);
  const validation = validateMissionRequirements(mission);
  const definition = missionUnit(units, quantity);
  const bounds = missionBounds[field];
  const displayValue = Number(convertFromSi(mission[field], quantity, units).toFixed(3));
  const displayMin = convertFromSi(bounds.min, quantity, units);
  const displayMax = convertFromSi(bounds.max, quantity, units);
  return <div className="mission-field-wrap">
    <label className="field">
      <span>{label}<em>{definition.label}</em></span>
      <input
        type="number"
        value={displayValue}
        min={displayMin}
        max={displayMax}
        step={definition.step}
        aria-invalid={validation.errors[field] ? 'true' : 'false'}
        onChange={(event) => update(`mission.${field}`, convertToSi(Number(event.target.value), quantity, units))}
      />
    </label>
    {validation.errors[field] && <small className="field-error">{validation.errors[field]}</small>}
  </div>;
}

export function MissionInspector() {
  const [units, setUnits] = useState<MissionUnitSystem>('aviation');
  const mission = useDesignStore((state) => state.design.mission);
  const update = useDesignStore((state) => state.update);
  const validation = validateMissionRequirements(mission);
  return <aside className="inspector mission-inspector">
    <div className="panel-title"><span>MISSION REQUIREMENTS</span><span className={validation.valid ? 'live' : 'invalid-state'}>{validation.valid ? '● VALID' : '● CHECK INPUTS'}</span></div>
    <section>
      <h3>Mission context</h3>
      <label className="field"><span>Aircraft category<em>configuration</em></span><select value={mission.aircraftCategory} onChange={(event) => update('mission.aircraftCategory', event.target.value)}>
        <option value="light-aircraft">Light aircraft</option>
        <option value="uncrewed-aircraft">Uncrewed aircraft</option>
        <option value="glider">Glider</option>
        <option value="transport">Transport</option>
      </select></label>
      <label className="field"><span>Design objective<em>future trade study</em></span><select value={mission.designObjective} onChange={(event) => update('mission.designObjective', event.target.value)}>
        <option value="balanced">Balanced</option>
        <option value="minimum-mass">Minimum mass</option>
        <option value="maximum-range">Maximum range</option>
        <option value="minimum-energy">Minimum energy</option>
      </select></label>
      <div className="unit-toggle" role="group" aria-label="Mission input units">
        <button className={units === 'si' ? 'active' : ''} onClick={() => setUnits('si')}>SI</button>
        <button className={units === 'aviation' ? 'active' : ''} onClick={() => setUnits('aviation')}>AVIATION</button>
      </div>
    </section>
    <section>
      <h3>Payload & mission</h3>
      <MissionField field="payloadKg" label="Required payload" quantity="mass" units={units} />
      <MissionField field="requiredRangeM" label="Required range" quantity="distance" units={units} />
      <MissionField field="cruiseSpeedMs" label="Cruise speed" quantity="speed" units={units} />
      <MissionField field="cruiseAltitudeM" label="Cruise altitude" quantity="altitude" units={units} />
      <MissionField field="serviceCeilingM" label="Service ceiling" quantity="altitude" units={units} />
    </section>
    <section>
      <h3>Performance constraints</h3>
      <MissionField field="maximumStallSpeedMs" label="Maximum stall speed" quantity="speed" units={units} />
      <MissionField field="maximumTakeoffDistanceM" label="Maximum takeoff distance" quantity="length" units={units} />
      <MissionField field="minimumClimbRateMs" label="Minimum climb rate" quantity="climbRate" units={units} />
      <MissionField field="maxOperatingSpeedMs" label="Maximum operating speed" quantity="speed" units={units} />
    </section>
    <div className="input-note">Values are stored in SI. Aviation units are converted only at this input boundary. Takeoff distance and design objectives are recorded but not calculated in Phase 4A.</div>
  </aside>;
}
