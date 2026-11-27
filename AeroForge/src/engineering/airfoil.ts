export type Naca4Definition = { canonicalId: string; maximumCamberRatio: number; maximumCamberPositionRatio: number; thicknessRatio: number };

export function parseNaca4Designation(code: string): Naca4Definition | undefined {
  const match = code.replace(/\s/g, '').toUpperCase().match(/^NACA(\d{4})$/);
  if (!match) return undefined;
  const digits = match[1];
  const maximumCamberRatio = Number(digits[0]) / 100;
  const maximumCamberPositionRatio = Number(digits[1]) / 10;
  const thicknessRatio = Number(digits.slice(2)) / 100;
  if (thicknessRatio <= 0 || (maximumCamberRatio > 0 && maximumCamberPositionRatio <= 0)) return undefined;
  return { canonicalId: `NACA ${digits}`, maximumCamberRatio, maximumCamberPositionRatio, thicknessRatio };
}

function requireNaca4(code: string): Naca4Definition {
  const definition = parseNaca4Designation(code);
  if (!definition) throw new Error('Expected a supported positive-thickness NACA four-digit designation.');
  return definition;
}

export function naca4Coordinates(code: string, points = 32): [number, number][] {
  const { maximumCamberRatio: m, maximumCamberPositionRatio: p, thicknessRatio: t } = requireNaca4(code);
  const out: [number, number][] = [];
  for (let i = 0; i <= points; i += 1) { const beta = Math.PI * i / points; const x = (1 - Math.cos(beta)) / 2; const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1015 * x ** 4); let yc = 0; let dy = 0; if (p > 0 && x < p) { yc = m / p ** 2 * (2 * p * x - x ** 2); dy = 2 * m / p ** 2 * (p - x); } else if (p > 0) { yc = m / (1 - p) ** 2 * ((1 - 2 * p) + 2 * p * x - x ** 2); dy = 2 * m / (1 - p) ** 2 * (p - x); } const theta = Math.atan(dy); out.push([x - yt * Math.sin(theta), yc + yt * Math.cos(theta)]); }
  return out;
}

/** Closed counter-clockwise section in x/z coordinates: upper TE to LE, then lower LE to TE. */
export function naca4SurfaceCoordinates(code: string, points = 32): [number, number][] {
  const { maximumCamberRatio: m, maximumCamberPositionRatio: p, thicknessRatio: t } = requireNaca4(code);
  const upper: [number, number][] = []; const lower: [number, number][] = [];
  for (let i = 0; i <= points; i += 1) {
    const beta = Math.PI * i / points; const x = (1 - Math.cos(beta)) / 2;
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1015 * x ** 4);
    let yc = 0; let dy = 0;
    if (p > 0 && x < p) { yc = m / p ** 2 * (2 * p * x - x ** 2); dy = 2 * m / p ** 2 * (p - x); }
    else if (p > 0) { yc = m / (1 - p) ** 2 * ((1 - 2 * p) + 2 * p * x - x ** 2); dy = 2 * m / (1 - p) ** 2 * (p - x); }
    const theta = Math.atan(dy);
    upper.push([x - yt * Math.sin(theta), yc + yt * Math.cos(theta)]);
    lower.push([x + yt * Math.sin(theta), yc - yt * Math.cos(theta)]);
  }
  return [...upper.reverse(), ...lower.slice(1, -1)];
}
