// 转场着色器库。每个转场实现 vec4 transition(vec2 uv)，uv 为左下角原点。
// 可用：getFromColor / getToColor / progress / ratio(宽高比) / uTime

export interface TransitionDef {
  name: string
  label: string
  group: '基础' | '推拉' | '形状' | '特效' | '3D'
  glsl: string
}

const EASE = `float ease(float t){ return t < 0.5 ? 4.0*t*t*t : 1.0 - pow(-2.0*t + 2.0, 3.0) / 2.0; }`
const NOISE = `
float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash2(i), hash2(i+vec2(1,0)), u.x), mix(hash2(i+vec2(0,1)), hash2(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }`

const push = (dx: number, dy: number): string => `${EASE}
vec4 transition(vec2 uv){
  float p = ease(progress);
  vec2 d = vec2(${dx.toFixed(1)}, ${dy.toFixed(1)});
  vec2 fu = uv + d * p;
  vec2 tu = uv + d * (p - 1.0);
  if (fu.x >= 0.0 && fu.x <= 1.0 && fu.y >= 0.0 && fu.y <= 1.0) return getFromColor(fu);
  return getToColor(tu);
}`

const wipe = (axis: string, dir: number): string => `
vec4 transition(vec2 uv){
  float x = ${dir > 0 ? '' : '1.0 - '}uv.${axis};
  float e = progress * 1.2 - 0.1;
  float m = smoothstep(e - 0.1, e + 0.1, x);
  return mix(getToColor(uv), getFromColor(uv), m);
}`

export const TRANSITIONS: TransitionDef[] = [
  {
    name: 'fade',
    label: '叠化',
    group: '基础',
    glsl: `vec4 transition(vec2 uv){ return mix(getFromColor(uv), getToColor(uv), smoothstep(0.0, 1.0, progress)); }`
  },
  {
    name: 'fadeWhite',
    label: '闪白',
    group: '基础',
    glsl: `vec4 transition(vec2 uv){
      float p = progress; vec4 w = vec4(1.0);
      if (p < 0.5) return mix(getFromColor(uv), w, smoothstep(0.0, 1.0, p * 2.0));
      return mix(w, getToColor(uv), smoothstep(0.0, 1.0, (p - 0.5) * 2.0)); }`
  },
  {
    name: 'fadeBlack',
    label: '闪黑',
    group: '基础',
    glsl: `vec4 transition(vec2 uv){
      float p = progress; vec4 b = vec4(0.0, 0.0, 0.0, 1.0);
      if (p < 0.5) return mix(getFromColor(uv), b, smoothstep(0.0, 1.0, p * 2.0));
      return mix(b, getToColor(uv), smoothstep(0.0, 1.0, (p - 0.5) * 2.0)); }`
  },
  { name: 'pushLeft', label: '向左推', group: '推拉', glsl: push(1, 0) },
  { name: 'pushRight', label: '向右推', group: '推拉', glsl: push(-1, 0) },
  { name: 'pushUp', label: '向上推', group: '推拉', glsl: push(0, -1) },
  { name: 'pushDown', label: '向下推', group: '推拉', glsl: push(0, 1) },
  { name: 'wipeLeft', label: '左擦除', group: '推拉', glsl: wipe('x', 1) },
  { name: 'wipeRight', label: '右擦除', group: '推拉', glsl: wipe('x', -1) },
  { name: 'wipeUp', label: '上擦除', group: '推拉', glsl: wipe('y', 1) },
  {
    name: 'circleOpen',
    label: '圆形展开',
    group: '形状',
    glsl: `vec4 transition(vec2 uv){
      vec2 q = (uv - 0.5) * vec2(ratio, 1.0);
      float r = progress * length(vec2(ratio, 1.0)) * 0.55;
      float m = smoothstep(r - 0.03, r + 0.03, length(q));
      return mix(getToColor(uv), getFromColor(uv), m); }`
  },
  {
    name: 'heart',
    label: '爱心',
    group: '形状',
    glsl: `float dot2(vec2 v){ return dot(v,v); }
    float sdHeart(vec2 p){ p.x = abs(p.x);
      if (p.y + p.x > 1.0) return sqrt(dot2(p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
      return sqrt(min(dot2(p - vec2(0.0, 1.0)), dot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y); }
    vec4 transition(vec2 uv){
      float s = 0.001 + pow(progress, 1.6) * 3.2;
      vec2 q = (uv - 0.5) * vec2(ratio, 1.0) / s + vec2(0.0, 0.55);
      float d = sdHeart(q) * s;
      float m = smoothstep(-0.015, 0.015, d);
      return mix(getToColor(uv), getFromColor(uv), m); }`
  },
  {
    name: 'diamond',
    label: '菱形',
    group: '形状',
    glsl: `vec4 transition(vec2 uv){
      vec2 q = abs(uv - 0.5) * vec2(ratio, 1.0);
      float d = q.x + q.y; float r = progress * (ratio + 1.0) * 0.55;
      return mix(getToColor(uv), getFromColor(uv), smoothstep(r - 0.03, r + 0.03, d)); }`
  },
  {
    name: 'clock',
    label: '时钟',
    group: '形状',
    glsl: `vec4 transition(vec2 uv){
      vec2 q = uv - 0.5; float a = atan(q.x, q.y) / 6.2831853 + 0.5;
      float m = smoothstep(progress - 0.02, progress + 0.02, a);
      return mix(getToColor(uv), getFromColor(uv), m); }`
  },
  {
    name: 'blinds',
    label: '百叶窗',
    group: '形状',
    glsl: `vec4 transition(vec2 uv){
      float n = 10.0; float f = fract(uv.x * n); float i = floor(uv.x * n) / n;
      float p = clamp(progress * 1.6 - i * 0.6, 0.0, 1.0);
      return f < p ? getToColor(uv) : getFromColor(uv); }`
  },
  {
    name: 'mosaic',
    label: '方块',
    group: '形状',
    glsl: `float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec4 transition(vec2 uv){
      vec2 g = floor(uv * vec2(12.0 * ratio, 12.0));
      float t = h(g) * 0.7;
      return progress > t + 0.3 * h(g + 3.1) * progress ? getToColor(uv) : getFromColor(uv); }`
  },
  {
    name: 'crossZoom',
    label: '冲击变焦',
    group: '特效',
    glsl: `${EASE}
    vec4 transition(vec2 uv){
      float p = ease(progress); float str = sin(progress * 3.14159) * 0.4;
      vec2 c = vec2(0.5); vec2 dir = c - uv; vec4 col = vec4(0.0); float tot = 0.0;
      for (float i = 0.0; i < 12.0; i++){
        float pct = (i + fract(sin(dot(uv, vec2(12.9, 78.2))) * 0.5)) / 12.0; float w = 4.0 * (pct - pct * pct);
        vec2 s = uv + dir * pct * str;
        col += mix(getFromColor(s), getToColor(s), smoothstep(0.35, 0.65, p)) * w; tot += w; }
      return col / tot; }`
  },
  {
    name: 'zoomThrough',
    label: '穿越',
    group: '特效',
    glsl: `${EASE}
    vec4 transition(vec2 uv){
      float p = ease(progress);
      vec2 fu = (uv - 0.5) / (1.0 + p * 1.5) + 0.5;
      vec2 tu = (uv - 0.5) / (1.0 + (1.0 - p) * 0.6) + 0.5;
      return mix(getFromColor(fu), getToColor(tu), smoothstep(0.3, 0.75, p)); }`
  },
  {
    name: 'dreamy',
    label: '梦幻',
    group: '特效',
    glsl: `vec4 transition(vec2 uv){
      float a = sin(progress * 3.14159);
      vec2 o1 = vec2(0.0, sin(uv.x * 20.0 + progress * 10.0) * 0.03 * a);
      vec4 c = mix(getFromColor(uv + o1), getToColor(uv - o1), smoothstep(0.2, 0.8, progress));
      return c + vec4(vec3(0.25 * a), 0.0); }`
  },
  {
    name: 'swirl',
    label: '漩涡',
    group: '特效',
    glsl: `vec4 transition(vec2 uv){
      vec2 q = (uv - 0.5) * vec2(ratio, 1.0); float r = length(q);
      float a = sin(progress * 3.14159) * 5.0 * max(0.0, 0.9 - r);
      float s = sin(a), c = cos(a); q = mat2(c, -s, s, c) * q;
      vec2 u = q / vec2(ratio, 1.0) + 0.5;
      return mix(getFromColor(u), getToColor(u), smoothstep(0.35, 0.65, progress)); }`
  },
  {
    name: 'ripple',
    label: '水波',
    group: '特效',
    glsl: `vec4 transition(vec2 uv){
      vec2 q = (uv - 0.5) * vec2(ratio, 1.0); float d = length(q);
      float a = sin(progress * 3.14159);
      vec2 off = normalize(q + 1e-5) * sin(d * 40.0 - progress * 18.0) * 0.02 * a;
      return mix(getFromColor(uv + off), getToColor(uv + off), smoothstep(0.3, 0.7, progress)); }`
  },
  {
    name: 'pixelize',
    label: '像素化',
    group: '特效',
    glsl: `vec4 transition(vec2 uv){
      float a = sin(progress * 3.14159); float n = max(1.0, a * 60.0);
      vec2 g = vec2(n * ratio, n); vec2 u = a > 0.02 ? (floor(uv * g) + 0.5) / g : uv;
      return progress < 0.5 ? getFromColor(u) : getToColor(u); }`
  },
  {
    name: 'blurFade',
    label: '模糊溶解',
    group: '特效',
    glsl: `vec4 transition(vec2 uv){
      float r = sin(progress * 3.14159) * 0.02; vec4 a = vec4(0.0), b = vec4(0.0);
      for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++){
        vec2 o = vec2(float(i), float(j)) * r / vec2(ratio, 1.0);
        a += getFromColor(uv + o); b += getToColor(uv + o); }
      return mix(a, b, smoothstep(0.2, 0.8, progress)) / 25.0; }`
  },
  {
    name: 'burn',
    label: '燃烧',
    group: '特效',
    glsl: `${NOISE}
    vec4 transition(vec2 uv){
      float n = fbm(uv * vec2(ratio, 1.0) * 4.0);
      float e = progress * 1.3 - 0.15;
      float m = smoothstep(e - 0.02, e + 0.02, n);
      float glow = smoothstep(0.12, 0.0, abs(n - e)) * (1.0 - smoothstep(0.85, 1.0, progress));
      vec4 c = mix(getToColor(uv), getFromColor(uv), m);
      return c + vec4(vec3(1.0, 0.55, 0.15) * glow * 1.4, 0.0); }`
  },
  {
    name: 'ink',
    label: '水墨',
    group: '特效',
    glsl: `${NOISE}
    vec4 transition(vec2 uv){
      vec2 q = (uv - 0.5) * vec2(ratio, 1.0);
      float n = fbm(uv * vec2(ratio, 1.0) * 3.0) * 0.6 + length(q) * 0.9;
      float e = progress * 1.4;
      float m = smoothstep(e - 0.08, e, n);
      float edge = smoothstep(0.1, 0.0, abs(n - e + 0.04)) * sin(progress * 3.14159);
      vec4 c = mix(getToColor(uv), getFromColor(uv), m);
      return mix(c, vec4(0.08, 0.07, 0.07, 1.0), edge * 0.55); }`
  },
  {
    name: 'flip',
    label: '翻转',
    group: '3D',
    glsl: `${EASE}
    vec4 transition(vec2 uv){
      float p = ease(progress); float a = p * 3.14159;
      float c = cos(a); float sx = max(abs(c), 0.001);
      float x = (uv.x - 0.5) / sx;
      float persp = 1.0 + 0.35 * sin(a) * x * sign(c);
      vec2 u = vec2(x + 0.5, (uv.y - 0.5) / persp + 0.5);
      vec4 bg = vec4(0.05, 0.05, 0.06, 1.0);
      if (u.x < 0.0 || u.x > 1.0 || u.y < 0.0 || u.y > 1.0) return bg;
      return c > 0.0 ? getFromColor(u) : getToColor(u); }`
  },
  {
    name: 'cube',
    label: '立方体',
    group: '3D',
    glsl: `${EASE}
    vec4 transition(vec2 uv){
      float p = ease(progress); vec4 bg = vec4(0.04, 0.04, 0.05, 1.0);
      float w1 = 1.0 - p, w2 = p; float pers = 0.25 * sin(p * 3.14159);
      if (uv.x < w1) {
        float x = uv.x / w1; float s = 1.0 + pers * (x);
        vec2 u = vec2(x, (uv.y - 0.5) * s + 0.5);
        return (u.y < 0.0 || u.y > 1.0) ? bg : getFromColor(u) * (1.0 - p * 0.5);
      } else {
        float x = (uv.x - w1) / w2; float s = 1.0 + pers * (1.0 - x);
        vec2 u = vec2(x, (uv.y - 0.5) * s + 0.5);
        return (u.y < 0.0 || u.y > 1.0) ? bg : getToColor(u) * (0.5 + p * 0.5);
      } }`
  },
  {
    name: 'doorway',
    label: '开门',
    group: '3D',
    glsl: `${EASE}
    vec4 transition(vec2 uv){
      float p = ease(progress);
      vec2 tu = (uv - 0.5) * (0.8 + 0.2 * p) + 0.5;
      float o = p * 0.5;
      if (uv.x < 0.5 - o) return getFromColor(vec2(uv.x + o, uv.y)) * (1.0 - p * 0.5);
      if (uv.x > 0.5 + o) return getFromColor(vec2(uv.x - o, uv.y)) * (1.0 - p * 0.5);
      return getToColor(tu); }`
  },
  {
    name: 'rotateZoom',
    label: '旋转缩放',
    group: '3D',
    glsl: `${EASE}
    vec2 rot(vec2 q, float a){ float s = sin(a), c = cos(a); return mat2(c, -s, s, c) * q; }
    vec4 transition(vec2 uv){
      float p = ease(progress); vec2 q = (uv - 0.5) * vec2(ratio, 1.0);
      vec2 fq = rot(q, p * 1.2) * (1.0 + p * 1.2);
      vec2 tq = rot(q, -(1.0 - p) * 1.2) * (1.0 + (1.0 - p) * 0.8);
      vec2 fu = fq / vec2(ratio, 1.0) + 0.5, tu = tq / vec2(ratio, 1.0) + 0.5;
      vec4 a = (fu.x < 0.0 || fu.x > 1.0 || fu.y < 0.0 || fu.y > 1.0) ? vec4(0,0,0,1) : getFromColor(fu);
      vec4 b = (tu.x < 0.0 || tu.x > 1.0 || tu.y < 0.0 || tu.y > 1.0) ? vec4(0,0,0,1) : getToColor(tu);
      return mix(a, b, smoothstep(0.3, 0.7, p)); }`
  },
  {
    name: 'flash',
    label: '光晕',
    group: '特效',
    glsl: `vec4 transition(vec2 uv){
      float a = sin(progress * 3.14159);
      vec4 c = mix(getFromColor(uv), getToColor(uv), smoothstep(0.35, 0.65, progress));
      vec2 q = (uv - vec2(0.3 + progress * 0.4, 0.6)) * vec2(ratio, 1.0);
      float g = exp(-dot(q, q) * 3.0) * a;
      return c + vec4(vec3(1.0, 0.85, 0.6) * (g * 1.2 + a * 0.35), 0.0); }`
  },
  {
    name: 'glitch',
    label: '故障',
    group: '特效',
    glsl: `float h(float n){ return fract(sin(n) * 43758.5453); }
    vec4 transition(vec2 uv){
      float a = sin(progress * 3.14159); float t = floor(progress * 18.0);
      float band = floor(uv.y * 14.0);
      float off = (h(band + t * 7.0) - 0.5) * 0.2 * a * step(0.55, h(band * 3.1 + t));
      vec2 u = vec2(uv.x + off, uv.y);
      float sh = 0.012 * a;
      bool useTo = progress > 0.5;
      vec4 r = useTo ? getToColor(u + vec2(sh, 0.0)) : getFromColor(u + vec2(sh, 0.0));
      vec4 g = useTo ? getToColor(u) : getFromColor(u);
      vec4 b = useTo ? getToColor(u - vec2(sh, 0.0)) : getFromColor(u - vec2(sh, 0.0));
      return vec4(r.r, g.g, b.b, 1.0); }`
  },
  {
    name: 'slideZoom',
    label: '缩放滑入',
    group: '推拉',
    glsl: `${EASE}
    vec4 transition(vec2 uv){
      float p = ease(progress);
      vec2 fu = (uv - 0.5) * (1.0 + p * 0.3) + 0.5 + vec2(p * 0.6, 0.0);
      vec2 tu = (uv - 0.5) * (1.0 + (1.0 - p) * 0.3) + 0.5 - vec2((1.0 - p) * 0.6, 0.0);
      vec4 a = (fu.x > 1.0) ? vec4(0,0,0,1) : getFromColor(fu);
      vec4 b = (tu.x < 0.0) ? vec4(0,0,0,1) : getToColor(tu);
      float m = smoothstep(0.2, 0.8, p);
      return mix(a, b, m); }`
  }
,
  {
    name: 'splitOpen',
    label: '中开',
    group: '推拉',
    glsl: `${EASE}
    vec4 transition(vec2 uv){
      float p = ease(progress); float half_ = p * 0.5;
      float d = abs(uv.x - 0.5);
      if (d < half_) return getToColor((uv - 0.5) * (0.85 + 0.15 * p) + 0.5);
      vec2 fu = vec2(uv.x < 0.5 ? uv.x + half_ : uv.x - half_, uv.y);
      return getFromColor(fu) * (1.0 - p * 0.4); }`
  },
  {
    name: 'diagonalWipe',
    label: '斜向擦除',
    group: '推拉',
    glsl: `vec4 transition(vec2 uv){
      float e = progress * 1.3 - 0.15; float d = (uv.x + uv.y) * 0.5;
      float m = smoothstep(e - 0.07, e + 0.07, d);
      return mix(getToColor(uv), getFromColor(uv), m); }`
  },
  {
    name: 'directionalWarp',
    label: '扭曲推进',
    group: '特效',
    glsl: `vec4 transition(vec2 uv){
      vec2 v = normalize(vec2(-1.0, 1.0)); v /= abs(v.x) + abs(v.y);
      float sm = 0.5; float d = v.x * 0.5 + v.y * 0.5;
      float m = 1.0 - smoothstep(-sm, 0.0, v.x * uv.x + v.y * uv.y - (d - 0.5 + progress * (1.0 + sm)));
      return mix(getFromColor((uv - 0.5) * (1.0 - m) + 0.5), getToColor((uv - 0.5) * m + 0.5), m); }`
  },
  {
    name: 'spinBlur',
    label: '旋转模糊',
    group: '特效',
    glsl: `vec4 transition(vec2 uv){
      float a = sin(progress * 3.14159) * 0.35; float k = smoothstep(0.4, 0.6, progress);
      vec2 q = (uv - 0.5) * vec2(ratio, 1.0); vec4 col = vec4(0.0);
      for (float i = 0.0; i < 12.0; i++) {
        float ang = (i / 11.0 - 0.5) * a + (progress - 0.5) * 0.6;
        float s = sin(ang), c = cos(ang);
        vec2 r = mat2(c, -s, s, c) * q / vec2(ratio, 1.0) + 0.5;
        col += mix(getFromColor(r), getToColor(r), k);
      }
      return col / 12.0; }`
  },
  {
    name: 'gridFlip',
    label: '方格翻转',
    group: '3D',
    glsl: `vec4 transition(vec2 uv){
      vec2 n = vec2(floor(6.0 * ratio + 0.5), 6.0);
      vec2 cell = floor(uv * n); vec2 f = fract(uv * n);
      float delay = (cell.x + cell.y) / (n.x + n.y) * 0.6;
      float q = clamp((progress - delay) / 0.4, 0.0, 1.0);
      float s = abs(cos(q * 3.14159));
      float x = (f.x - 0.5) / max(s, 0.001) + 0.5;
      if (x < 0.0 || x > 1.0) return vec4(0.06, 0.06, 0.07, 1.0);
      vec2 suv = (cell + vec2(x, f.y)) / n;
      return q > 0.5 ? getToColor(suv) : getFromColor(suv); }`
  },
  {
    name: 'polkaDots',
    label: '圆点溶解',
    group: '形状',
    glsl: `vec4 transition(vec2 uv){
      vec2 q = uv * vec2(ratio, 1.0) * 10.0; vec2 f = fract(q) - 0.5;
      float r = progress * 0.78;
      float m = smoothstep(r + 0.04, r - 0.04, length(f));
      return mix(getFromColor(uv), getToColor(uv), m); }`
  },
  {
    name: 'starOpen',
    label: '星形展开',
    group: '形状',
    glsl: `float sdStar5(vec2 p, float r, float rf){
      const vec2 k1 = vec2(0.809016994375, -0.587785252292); const vec2 k2 = vec2(-k1.x, k1.y);
      p.x = abs(p.x); p -= 2.0 * max(dot(k1, p), 0.0) * k1; p -= 2.0 * max(dot(k2, p), 0.0) * k2;
      p.x = abs(p.x); p.y -= r;
      vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
      float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
      return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y); }
    vec4 transition(vec2 uv){
      vec2 q = (uv - 0.5) * vec2(ratio, 1.0);
      float r = 0.001 + pow(progress, 1.5) * 2.4;
      float m = smoothstep(-0.012, 0.012, sdStar5(q, r, 0.45));
      return mix(getToColor(uv), getFromColor(uv), m); }`
  },
  {
    name: 'lightSweep',
    label: '扫光',
    group: '特效',
    glsl: `vec4 transition(vec2 uv){
      float band = uv.x * 0.75 + (1.0 - uv.y) * 0.25; float pos = progress * 1.5 - 0.25;
      float g = exp(-pow((band - pos) * 7.0, 2.0)) * sin(progress * 3.14159);
      float m = smoothstep(pos + 0.03, pos - 0.03, band);
      vec4 c = mix(getFromColor(uv), getToColor(uv), m);
      return c + vec4(vec3(1.0, 0.95, 0.85) * g * 0.9, 0.0); }`
  }
]

export const TRANSITION_MAP = new Map(TRANSITIONS.map((t) => [t.name, t]))

export function transitionLabel(name: string): string {
  if (name === 'cut') return '硬切'
  return TRANSITION_MAP.get(name)?.label ?? name
}

export function transitionFragment(def: TransitionDef): string {
  return `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform float progress;
uniform float ratio;
uniform float uTime;
out vec4 outColor;
vec4 getFromColor(vec2 uv){ return texture(uFrom, clamp(uv, 0.0, 1.0)); }
vec4 getToColor(vec2 uv){ return texture(uTo, clamp(uv, 0.0, 1.0)); }
${def.glsl}
void main(){ outColor = transition(vUv); }`
}
