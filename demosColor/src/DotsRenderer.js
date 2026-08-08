import * as THREE from 'three';
import dotsVertexShader from './shaders/dots/dotsVertex.glsl';
import dotsFragmentShader from './shaders/dots/dotsFragment.glsl';

const MAX_VISUAL_RADIUS = 0.5;
const TWO_PI = Math.PI * 2;
// Vertical (lightness) stretch for the HSL solid — must match HSLVolumeMath.Y_SCALE.
const HSL_Y_SCALE = 2;

// ── Color conversion helpers ──────────────────────────────────────

function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    const h6 = h * 6;
    if      (h6 < 1) { r = c; g = x; b = 0; }
    else if (h6 < 2) { r = x; g = c; b = 0; }
    else if (h6 < 3) { r = 0; g = c; b = x; }
    else if (h6 < 4) { r = 0; g = x; b = c; }
    else if (h6 < 5) { r = x; g = 0; b = c; }
    else             { r = c; g = 0; b = x; }
    return [r + m, g + m, b + m];
}

function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    const h6 = h * 6;
    if      (h6 < 1) { r = c; g = x; b = 0; }
    else if (h6 < 2) { r = x; g = c; b = 0; }
    else if (h6 < 3) { r = 0; g = c; b = x; }
    else if (h6 < 4) { r = 0; g = x; b = c; }
    else if (h6 < 5) { r = x; g = 0; b = c; }
    else             { r = c; g = 0; b = x; }
    return [r + m, g + m, b + m];
}

// Derive hue (degrees [0,360)), HSV saturation ([0,1]) and HSL lightness
// ([0,1]) from an RGB color. Used so subset filtering works uniformly across
// every color model.
function rgbToHueSatLight(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    const light = (max + min) / 2;             // HSL lightness
    const sat = max <= 1e-6 ? 0 : delta / max; // HSV saturation
    if (delta <= 1e-6) return { hue: 0, sat: 0, light };

    let hue;
    if (max === r)      hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else                hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
    return { hue, sat, light };
}

// Smallest absolute difference between two angles in degrees.
function hueDist(a, b) {
    let d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
}

// Subset thresholds derived from a unified tolerance factor t in [0, 1].
// Larger t = more permissive bands.
function satHighFor(t)  { return 1 - 0.3 * t; }   // "pure hue": sat >= this (1.0 → 0.7)
function satLowFor(t)   { return 0.3 * t; }        // "gray": sat <= this (0.0 → 0.3)
function hueTolFor(t)   { return 2 + 38 * t; }     // ± degrees for a specific hue (2° → 40°)
function lightTolFor(t) { return 0.02 + 0.23 * t; } // "pure hue": |L - 0.5| <= this (0.02 → 0.25)

// Normalize angle in radians to [0, 1]
function angleToHueNorm(rad) {
    let h = rad % TWO_PI;
    if (h < 0) h += TWO_PI;
    return h / TWO_PI;
}

// Check if a normalized hue hN is within [hMin, hMax] (wrap-around aware)
function hueInRange(hN, hMin, hMax) {
    if (hMin <= hMax) return hN >= hMin && hN <= hMax;
    // Wrap-around: e.g. 0.8 to 0.2
    return hN >= hMin || hN <= hMax;
}

// ── DotsRenderer ─────────────────────────────────────────────────

export class DotsRenderer {
    constructor(colorSpaceType, params, subset = 'all', tolerance = 0.4) {
        this._colorSpaceType = colorSpaceType;
        this._params = { dotsPerSide: 20, dotRadius: 0.012, ...params };
        this._subset = subset;      // 'all' | 'hues' | 'grays' | 'hue0'..'hue300'
        this._tolerance = tolerance; // [0,1] unified subset tolerance
        this._mesh = null;
        this._dotPositions = null;  // Float32Array N³×3: world x,y,z
        this._dotCSCoords  = null;  // Float32Array N³×3: color-space coords (h/r/c, s/g/m, l/b/y)
        this._dotInShape   = null;  // Uint8Array N³: 1 if inside shape, 0 if outside
        this._dotHue       = null;  // Float32Array N³: hue in degrees, derived from RGB
        this._dotSat       = null;  // Float32Array N³: HSV saturation, derived from RGB
        this._dotLight     = null;  // Float32Array N³: HSL lightness, derived from RGB
        this._totalDots    = 0;
        this._colorAttr    = null;  // InstancedBufferAttribute for colors
        this._parentGroup  = null;  // tracked for rebuild

        this._build();
    }

    _build() {
        const { dotsPerSide, dotRadius } = this._params;
        const N = dotsPerSide;
        const total = N * N * N;
        this._totalDots = total;

        // Pre-allocate arrays
        const positions  = new Float32Array(total * 3);
        const csCoords   = new Float32Array(total * 3);
        const inShape    = new Uint8Array(total);
        const colors     = new Float32Array(total * 3);
        const hues       = new Float32Array(total);
        const sats       = new Float32Array(total);
        const lights     = new Float32Array(total);

        const step = N <= 1 ? 0 : 1.0 / (N - 1);

        let idx = 0;
        for (let i = 0; i < N; i++) {
            const x = -0.5 + i * step;
            for (let j = 0; j < N; j++) {
                const y = j * step;            // Y in [0, 1]
                for (let k = 0; k < N; k++) {
                    const z = -0.5 + k * step;

                    // Color-space coords / shape test use the unscaled y (= L);
                    // only the rendered position is stretched vertically for HSL.
                    const yPos = this._colorSpaceType === 'HSL' ? y * HSL_Y_SCALE : y;
                    positions[idx * 3    ] = x;
                    positions[idx * 3 + 1] = yPos;
                    positions[idx * 3 + 2] = z;

                    const { cs, inside, rgb } = this._computeDot(x, y, z);
                    csCoords[idx * 3    ] = cs[0];
                    csCoords[idx * 3 + 1] = cs[1];
                    csCoords[idx * 3 + 2] = cs[2];
                    inShape[idx] = inside ? 1 : 0;
                    colors[idx * 3    ] = rgb[0];
                    colors[idx * 3 + 1] = rgb[1];
                    colors[idx * 3 + 2] = rgb[2];

                    const { hue, sat, light } = rgbToHueSatLight(rgb[0], rgb[1], rgb[2]);
                    hues[idx] = hue;
                    sats[idx] = sat;
                    lights[idx] = light;

                    idx++;
                }
            }
        }

        this._dotPositions = positions;
        this._dotCSCoords  = csCoords;
        this._dotInShape   = inShape;
        this._dotHue       = hues;
        this._dotSat       = sats;
        this._dotLight     = lights;

        // Geometry: octahedron (8 triangles, bipyramid)
        const geo = new THREE.OctahedronGeometry(1, 0);

        // Custom per-instance color attribute
        this._colorAttr = new THREE.InstancedBufferAttribute(colors, 3);
        geo.setAttribute('aInstanceColor', this._colorAttr);

        // Material with custom shaders (no lighting)
        const mat = new THREE.ShaderMaterial({
            vertexShader: dotsVertexShader,
            fragmentShader: dotsFragmentShader,
            side: THREE.FrontSide,
        });

        this._mesh = new THREE.InstancedMesh(geo, mat, total);
        this._mesh.name = 'dotsVolume';
        this._mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        // Pre-set all matrices with position (scale=0, hidden by default)
        const dummy = new THREE.Object3D();
        dummy.scale.set(0, 0, 0);
        for (let i = 0; i < total; i++) {
            dummy.position.set(
                positions[i * 3],
                positions[i * 3 + 1],
                positions[i * 3 + 2]
            );
            dummy.updateMatrix();
            this._mesh.setMatrixAt(i, dummy.matrix);
        }
        this._mesh.instanceMatrix.needsUpdate = true;
    }

    // Compute the color-space coordinates, inside-shape flag, and RGB color for a world position.
    _computeDot(x, y, z) {
        const type = this._colorSpaceType;

        if (type === 'RGB') {
            const r = x + 0.5, g = y, b = z + 0.5;
            return { cs: [r, g, b], inside: true, rgb: [r, g, b] };
        }

        if (type === 'CMY') {
            const c = x + 0.5, m = y, yv = z + 0.5;
            return { cs: [c, m, yv], inside: true, rgb: [1 - c, 1 - m, 1 - yv] };
        }

        // Cylindrical types: HSL and HSV
        const worldR = Math.sqrt(x * x + z * z);
        const hRad = Math.atan2(z, x); // [-π, π]
        const hNorm = angleToHueNorm(hRad); // [0, 1]

        if (type === 'HSL') {
            const L = y;
            const maxR = MAX_VISUAL_RADIUS * (1 - Math.abs(2 * L - 1));
            if (maxR <= 1e-6) {
                // At tip of bicone (L=0 or L=1): only the axis point is inside
                const inside = worldR <= 1e-6;
                return { cs: [hNorm, 0, L], inside, rgb: hslToRgb(hNorm, 0, L) };
            }
            const S = worldR / maxR;
            const inside = S <= 1.0 + 1e-6;
            const Sclamp = Math.min(S, 1);
            const rgb = hslToRgb(hNorm, Sclamp, L);
            return { cs: [hNorm, Sclamp, L], inside, rgb };
        }

        if (type === 'HSV') {
            const V = y;
            const maxR = MAX_VISUAL_RADIUS * V;
            if (maxR <= 1e-6) {
                // At apex of cone (V=0): only the axis point is inside
                const inside = worldR <= 1e-6;
                return { cs: [hNorm, 0, V], inside, rgb: hsvToRgb(hNorm, 0, V) };
            }
            const S = worldR / maxR;
            const inside = S <= 1.0 + 1e-6;
            const Sclamp = Math.min(S, 1);
            const rgb = hsvToRgb(hNorm, Sclamp, V);
            return { cs: [hNorm, Sclamp, V], inside, rgb };
        }

        return { cs: [0, 0, 0], inside: false, rgb: [0, 0, 0] };
    }

    // Update which dots are visible based on the current limits.
    update(limits) {
        if (!this._mesh) return;

        const type = this._colorSpaceType;
        const { dotRadius } = this._params;
        const total = this._totalDots;
        const pos = this._dotPositions;
        const cs  = this._dotCSCoords;
        const shape = this._dotInShape;

        const dummy = new THREE.Object3D();

        for (let i = 0; i < total; i++) {
            let visible = shape[i] === 1;

            if (visible) {
                visible = this._inLimits(type, cs, i, limits);
            }

            if (visible) {
                visible = this._inSubset(i);
            }

            dummy.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
            const s = visible ? dotRadius : 0;
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            this._mesh.setMatrixAt(i, dummy.matrix);
        }

        this._mesh.instanceMatrix.needsUpdate = true;
    }

    _inLimits(type, cs, i, limits) {
        const a = cs[i * 3], b = cs[i * 3 + 1], c = cs[i * 3 + 2];

        if (type === 'RGB') {
            const { r, g, b: bl } = limits;
            return a >= r.min && a <= r.max &&
                   b >= g.min && b <= g.max &&
                   c >= bl.min && c <= bl.max;
        }
        if (type === 'CMY') {
            const { c: cl, m, y } = limits;
            return a >= cl.min && a <= cl.max &&
                   b >= m.min  && b <= m.max  &&
                   c >= y.min  && c <= y.max;
        }
        if (type === 'HSL') {
            const { h, s, l } = limits;
            return hueInRange(a, h.min, h.max) &&
                   b >= s.min && b <= s.max &&
                   c >= l.min && c <= l.max;
        }
        if (type === 'HSV') {
            const { h, s, v } = limits;
            return hueInRange(a, h.min, h.max) &&
                   b >= s.min && b <= s.max &&
                   c >= v.min && c <= v.max;
        }
        return false;
    }

    // Subset filter based on RGB-derived hue/saturation, so it works in any model.
    _inSubset(i) {
        const subset = this._subset;
        if (subset === 'all') return true;

        const hue = this._dotHue[i];
        const sat = this._dotSat[i];
        const light = this._dotLight[i];
        const t = this._tolerance;

        if (subset === 'grays') return sat <= satLowFor(t);
        // "Pure hues": maximum saturation AND lightness ≈ 0.5.
        if (subset === 'hues')  return sat >= satHighFor(t) && Math.abs(light - 0.5) <= lightTolFor(t);

        if (subset.startsWith('hue')) {
            const target = parseInt(subset.slice(3), 10);
            // Achromatic dots have no meaningful hue — exclude them.
            return sat >= satLowFor(t) && hueDist(hue, target) <= hueTolFor(t);
        }
        return true;
    }

    setSubset(subset) {
        this._subset = subset;
    }

    setTolerance(tolerance) {
        this._tolerance = tolerance;
    }

    // Rebuild with new params; re-attaches to the same parent group if already added.
    rebuild(colorSpaceType, params) {
        const group = this._parentGroup;
        if (group && this._mesh) group.remove(this._mesh);
        this._disposeGeometry();
        this._colorSpaceType = colorSpaceType;
        this._params = { ...this._params, ...params };
        this._build();
        if (group && this._mesh) group.add(this._mesh);
    }

    addToGroup(group) {
        this._parentGroup = group;
        if (this._mesh) group.add(this._mesh);
    }

    removeFromGroup(group) {
        if (this._mesh) group.remove(this._mesh);
        this._parentGroup = null;
    }

    _disposeGeometry() {
        if (this._mesh) {
            this._mesh.geometry?.dispose();
            this._mesh.material?.dispose();
            this._mesh = null;
        }
    }

    dispose() {
        if (this._parentGroup && this._mesh) this._parentGroup.remove(this._mesh);
        this._disposeGeometry();
        this._parentGroup = null;
    }
}
