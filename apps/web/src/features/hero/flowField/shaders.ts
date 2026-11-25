const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

const FIELD_COMMON = /* glsl */ `
uniform float uAspect;
uniform vec2 uStar;
uniform vec2 uPointer;
uniform float uPointerStrength;

// uv runs 0..1 with y up.
float fieldVisibility(vec2 uv) {
  float horiz = smoothstep(0.18, 0.66, uv.x);
  float vert = 0.08 + 0.92 * smoothstep(0.22, 0.60, uv.y);
  vec2 q = (uv - uStar) * vec2(uAspect, 1.0);
  float halo = exp(-dot(q, q) * 9.0);
  float baseVis = clamp(horiz * vert + halo * 0.55, 0.04, 1.0);

  vec2 dp = (uv - uPointer) * vec2(uAspect, 1.0);
  float pointerReveal = uPointerStrength * exp(-dot(dp, dp) / 0.080);

  return clamp(baseVis + pointerReveal * 0.95, 0.0, 1.0);
}
`;

const FIELD_FLOW = /* glsl */ `
uniform float uTime;

// xy = uv position, z = radius, w = circulation (sign = spin direction)
const vec4 VORTICES[16] = vec4[16](
  vec4(0.60, 0.86, 0.085,  0.0042),
  vec4(0.71, 0.94, 0.070, -0.0034),
  vec4(0.52, 0.70, 0.080, -0.0040),
  vec4(0.77, 0.58, 0.090,  0.0046),
  vec4(0.93, 0.55, 0.080, -0.0040),
  vec4(0.67, 0.45, 0.095, -0.0044),
  vec4(0.86, 0.40, 0.100,  0.0046),
  vec4(0.44, 0.88, 0.070,  0.0030),
  vec4(0.97, 0.88, 0.080,  0.0038),
  vec4(0.57, 0.34, 0.085,  0.0036),
  vec4(0.83, 0.87, 0.060, -0.0030),
  vec4(0.99, 0.28, 0.090, -0.0036),
  vec4(0.18, 0.78, 0.095,  0.0040),
  vec4(0.08, 0.50, 0.090, -0.0036),
  vec4(0.24, 0.36, 0.085,  0.0034),
  vec4(0.12, 0.20, 0.080, -0.0032)
);

float jetDistance(vec2 p, out float envelope) {
  vec2 s = uStar * vec2(uAspect, 1.0);
  float u = s.x - p.x;
  float slope = 0.15 + 0.714 * u;
  float yc = s.y - 0.15 * u - 0.357 * u * u;
  yc += 0.012 * sin(p.x * 7.0 - uTime * 0.32) + 0.006 * sin(p.x * 17.0 + uTime * 0.21);
  envelope = (1.0 - smoothstep(0.55, 0.98, u)) * smoothstep(-0.34, -0.02, u);
  return (p.y - yc) * inversesqrt(1.0 + slope * slope);
}

float streamFunction(vec2 p) {
  float t = uTime;
  // gentle up-right drift so nothing ever fully stalls
  float psi = 0.012 * (p.y * 0.90 - p.x * 0.42);

  float env;
  float d = jetDistance(p, env);
  psi += 0.110 * 0.045 * tanh(d / 0.045) * env;
  psi += 0.030 * 0.130 * tanh(d / 0.130) * env;

  for (int i = 0; i < 16; i++) {
    vec4 v = VORTICES[i];
    float fi = float(i);
    vec2 c = v.xy * vec2(uAspect, 1.0)
      + 0.028 * vec2(sin(t * 0.070 + fi * 1.7), cos(t * 0.060 + fi * 2.3));
    vec2 dd = p - c;
    psi += v.w * exp(-dot(dd, dd) / (v.z * v.z));
  }

  psi += 0.0095 * snoise(vec3(p * 2.1, t * 0.025));
  psi += 0.0030 * snoise(vec3(p * 4.6 + 3.1, t * 0.040 + 7.0));
  psi += 0.0007 * snoise(vec3(p * 10.5 - 1.7, t * 0.060 + 13.0));

  vec2 dp = p - uPointer * vec2(uAspect, 1.0);
  psi += uPointerStrength * (0.0085 * exp(-dot(dp, dp) / 0.010) + 0.0035 * exp(-dot(dp, dp) / 0.035));
  return psi;
}

// v = curl(psi) -> divergence free, particles never bunch up or thin out.
vec2 flowVelocity(vec2 p) {
  const float e = 0.0015;
  float n = streamFunction(p + vec2(0.0, e));
  float s = streamFunction(p - vec2(0.0, e));
  float east = streamFunction(p + vec2(e, 0.0));
  float west = streamFunction(p - vec2(e, 0.0));
  return vec2(n - s, west - east) / (2.0 * e);
}
`;

export const SIM_FRAGMENT = /* glsl */ `
uniform float uDelta;
uniform float uSpeed;
${NOISE}
${FIELD_COMMON}
${FIELD_FLOW}

vec2 spawn(vec2 seed) {
  return vec2(
    mix(-0.02, 1.04, hash12(seed + 17.13)),
    mix(-0.02, 1.04, hash12(seed.yx + 31.71))
  );
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 state = texture2D(texturePosition, uv);
  vec2 pos = state.xy;
  float age = state.z;
  float life = state.w;

  vec2 p = pos * vec2(uAspect, 1.0);
  // midpoint (RK2) integration keeps tight swirls stable
  vec2 v1 = flowVelocity(p);
  vec2 v2 = flowVelocity(p + v1 * uDelta * uSpeed * 0.5);
  p += v2 * uDelta * uSpeed;
  pos = p / vec2(uAspect, 1.0);
  age += uDelta;

  bool outside = pos.x < -0.04 || pos.x > 1.04 || pos.y < -0.04 || pos.y > 1.04;
  if (age > life || outside) {
    vec2 seed = gl_FragCoord.xy + fract(uTime * 0.6180339) * 997.0 + state.zw * 13.0;
    pos = spawn(seed);
    age = 0.0;
    life = mix(3.0, 8.0, hash12(seed.yx + 3.7));
  }

  gl_FragColor = vec4(pos, age, life);
}
`;

export const LINE_VERTEX = /* glsl */ `
uniform sampler2D uPrev;
uniform sampler2D uCurr;
uniform float uDelta;
uniform float uIntensity;
${FIELD_COMMON}

varying vec3 vColor;

void main() {
  vec4 a = texture2D(uPrev, position.xy);
  vec4 b = texture2D(uCurr, position.xy);
  bool respawned = b.z < a.z;
  vec4 s = (position.z > 0.5 || respawned) ? b : a;

  float speed = length((b.xy - a.xy) * vec2(uAspect, 1.0)) / max(uDelta, 1e-4);
  float hot = smoothstep(0.045, 0.125, speed);
  float lifeFade = smoothstep(0.0, 0.9, b.z) * (1.0 - smoothstep(b.w - 1.4, b.w, b.z));

  vec2 q = (b.xy - uStar) * vec2(uAspect, 1.0);
  float starBoost = 1.0 + 0.65 * exp(-dot(q, q) * 60.0);

  vec2 dp = (b.xy - uPointer) * vec2(uAspect, 1.0);
  float pointerBoost = 1.0 + 0.55 * uPointerStrength * exp(-dot(dp, dp) / 0.040);

  vec3 deep = vec3(0.04, 0.28, 0.98);
  vec3 bright = vec3(0.16, 0.72, 1.0);
  vec3 whiteCore = vec3(0.92, 0.98, 1.0);

  vec3 color = mix(deep, bright, hot);
  color = mix(color, whiteCore, pow(hot, 3.2) * 0.70);

  vColor = respawned ? vec3(0.0)
    : color * (0.65 + 0.65 * hot) * fieldVisibility(b.xy) * lifeFade * starBoost * pointerBoost * uIntensity;
  gl_Position = vec4(s.xy * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const LINE_FRAGMENT = /* glsl */ `
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 1.0);
}
`;

export const QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const FADE_FRAGMENT = /* glsl */ `
uniform sampler2D uTrail;
uniform vec3 uFade;
uniform float uBias;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(uTrail, vUv).rgb * uFade - uBias;
  gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
}
`;

export const COMPOSITE_FRAGMENT = /* glsl */ `
uniform sampler2D uTrail;
uniform vec2 uResolution;
uniform float uDpr;
uniform float uReveal;
uniform float uClock;
uniform float uTheme;
${NOISE}
${FIELD_COMMON}

varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec2 q = (uv - uStar) * vec2(uAspect, 1.0);

  vec3 darkBase = mix(vec3(0.043, 0.090, 0.176), vec3(0.065, 0.135, 0.265),
    smoothstep(0.1, 1.1, uv.x * 0.65 + uv.y * 0.45));
  darkBase += vec3(0.035, 0.095, 0.220) * exp(-dot(q, q) * 2.4) * 0.85;
  darkBase += vec3(0.018, 0.055, 0.130) * exp(-dot(q, q) * 26.0);

  vec3 lightBase = mix(vec3(0.950, 0.965, 0.975), vec3(0.920, 0.945, 0.965),
    smoothstep(0.1, 1.1, uv.x * 0.65 + uv.y * 0.45));
  lightBase = mix(lightBase, vec3(0.880, 0.930, 0.975), exp(-dot(q, q) * 2.4) * 0.35);

  vec3 baseCol = mix(darkBase, lightBase, uTheme);

  vec2 dp = (uv - uPointer) * vec2(uAspect, 1.0);
  float pointerDist2 = dot(dp, dp);
  float pointerGlow = uPointerStrength * exp(-pointerDist2 / 0.080);
  vec3 darkPointerGlow = vec3(0.045, 0.125, 0.280) * pointerGlow * uReveal;
  vec3 lightPointerWash = mix(baseCol, vec3(0.820, 0.900, 0.980), pointerGlow * 0.40 * uReveal);
  baseCol = mix(baseCol + darkPointerGlow, lightPointerWash, uTheme);

  vec3 trail = texture2D(uTrail, uv).rgb;
  float energy = max(trail.b, max(trail.r, trail.g));
  float mappedEnergy = 1.0 - exp(-energy * 1.30);

  vec3 deepBlue = mix(vec3(0.03, 0.26, 0.98), vec3(0.12, 0.55, 0.96), uTheme);
  vec3 electricBlue = mix(vec3(0.08, 0.52, 1.0), vec3(0.04, 0.40, 0.88), uTheme);
  vec3 cyan = mix(vec3(0.20, 0.82, 1.0), vec3(0.02, 0.25, 0.65), uTheme);
  vec3 coreColor = mix(vec3(0.96, 0.99, 1.0), vec3(0.02, 0.04, 0.08), uTheme);

  vec3 streamCol = mix(deepBlue, electricBlue, smoothstep(0.005, 0.25, mappedEnergy));
  streamCol = mix(streamCol, cyan, smoothstep(0.25, 0.68, mappedEnergy));
  streamCol = mix(streamCol, coreColor, smoothstep(0.68, 0.95, mappedEnergy) * 0.72);

  float localBoost = 1.0 + 0.45 * pointerGlow;
  float lineVisibility = pow(mappedEnergy, 0.74) * localBoost;

  vec3 darkComposited = baseCol + streamCol * lineVisibility * uReveal;
  float lineAlpha = clamp(lineVisibility * 1.15, 0.0, 1.0) * uReveal;
  vec3 lightComposited = mix(baseCol, streamCol, lineAlpha);

  vec3 col = mix(darkComposited, lightComposited, uTheme);

  float cellSize = 11.0 * uDpr;
  vec2 g = gl_FragCoord.xy / cellSize;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float r = hash12(id);
  vec2 cellUv = (id + 0.5) * cellSize / uResolution;

  vec2 dqRight = (cellUv - uStar - vec2(-0.075, -0.035)) * vec2(uAspect, 1.0) * vec2(1.0, 1.5);
  float regionRight = exp(-dot(dqRight, dqRight) * 42.0);

  vec2 dqLeft = (cellUv - vec2(0.18, 0.60)) * vec2(uAspect, 1.0) * vec2(0.95, 1.15);
  float regionLeft = exp(-dot(dqLeft, dqLeft) * 16.0) * 0.48;
  regionLeft += pointerGlow * 0.20 * exp(-dot(dqLeft, dqLeft) * 9.0);

  float region = max(regionRight, regionLeft);
  float twinkle = 0.45 + 0.55 * sin(uClock * (0.7 + r * 1.8) + r * 60.0);
  float dotShape = 1.0 - smoothstep(0.06, 0.15, length(f));
  float dotMask = dotShape * step(0.42, r) * region * twinkle * 0.85 * uReveal;

  col += vec3(0.38, 0.75, 1.0) * dotMask * (1.0 - uTheme);
  col = mix(col, vec3(0.00, 0.42, 0.68), dotMask * uTheme * 0.60);

  float d = length(q);
  float starGlow = 0.0009 / (d * d + 0.0009) * 0.35 * uReveal;
  col += vec3(0.55, 0.82, 1.0) * starGlow * (1.0 - uTheme);
  col = mix(col, vec3(0.00, 0.42, 0.68), clamp(starGlow * 0.60, 0.0, 0.50) * uTheme);

  float vignetteDark = 1.0 - 0.18 * smoothstep(0.55, 1.35, length((uv - vec2(0.64, 0.62)) * vec2(uAspect, 1.0)));
  float vignetteLight = 1.0 - 0.04 * smoothstep(0.55, 1.35, length((uv - vec2(0.64, 0.62)) * vec2(uAspect, 1.0)));
  col *= mix(vignetteDark, vignetteLight, uTheme);

  // Fine grain to prevent banding
  col += (hash12(gl_FragCoord.xy + fract(uClock * 7.13) * 431.0) - 0.5) * (2.2 / 255.0);

  gl_FragColor = vec4(col, 1.0);
}
`;
