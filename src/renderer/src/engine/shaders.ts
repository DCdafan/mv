// 所有图层共用一个顶点着色器：单位四边形 → 像素坐标（左上角原点）→ 裁剪空间
export const LAYER_VS = `#version 300 es
layout(location=0) in vec2 aPos;          // -0.5..0.5，y 向下
uniform vec2 uRes;                          // 画布像素
uniform vec2 uCenter;                       // 像素
uniform vec2 uQuad;                         // 四边形像素尺寸
uniform vec2 uScale;
uniform float uRot;                         // 弧度
out vec2 vUv;                               // 0..1，左上角原点
void main() {
  vUv = aPos + 0.5;
  vec2 p = aPos * uQuad * uScale;
  float c = cos(uRot), s = sin(uRot);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + uCenter;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`

const SDF = `
float dot2(vec2 v){ return dot(v,v); }
float sdRoundRect(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r; }
float sdEllipse(vec2 p, vec2 ab){ float k0 = length(p/ab); float k1 = length(p/(ab*ab)); return k1 < 1e-5 ? -min(ab.x,ab.y) : k0*(k0-1.0)/k1; }
float sdHeartUnit(vec2 p){
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return sqrt(dot2(p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
  return sqrt(min(dot2(p - vec2(0.0, 1.0)), dot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
}
float sdHexagon(vec2 p, float r){
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p.yx);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}
float sdRhombus(vec2 p, vec2 b){
  p = abs(p);
  float h = clamp((-2.0 * (p.x*b.x - p.y*b.y) + (b.x*b.x - b.y*b.y)) / dot(b,b), -1.0, 1.0);
  float d = length(p - 0.5 * b * vec2(1.0 - h, 1.0 + h));
  return d * sign(p.x * b.y + p.y * b.x - b.x * b.y);
}
// p：以形状中心为原点的像素坐标（y 向下）；hs：半尺寸
float shapeSdf(int mask, vec2 p, vec2 hs, float r){
  if (mask == 1) return sdRoundRect(p, hs, min(r, min(hs.x, hs.y)));
  if (mask == 2) return sdEllipse(p, hs);
  if (mask == 7) return length(p) - min(hs.x, hs.y);
  if (mask == 3) {
    float s = min(hs.x * 2.0 / 1.208, hs.y * 2.0 / 1.104);
    vec2 q = vec2(p.x, -p.y) / s + vec2(0.0, 0.552);
    return sdHeartUnit(q) * s;
  }
  if (mask == 4) {
    float rr = hs.x;
    vec2 c = vec2(0.0, -hs.y + rr);
    float dc = length(p - c) - rr;
    float hb = (hs.y * 2.0 - rr) * 0.5;
    float db = sdRoundRect(p - vec2(0.0, hs.y - hb), vec2(hs.x, hb), 0.0);
    return p.y < c.y ? dc : min(dc, db);
  }
  if (mask == 5) return sdRhombus(p, hs);
  if (mask == 6) return sdHexagon(p, min(hs.x, hs.y * 1.1547) * 0.866);
  return sdRoundRect(p, hs, 0.0);
}
`

export const LAYER_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform int uMode;            // 0 贴图 1 纯色/渐变 2 阴影 3 径向渐变 4 图案
uniform sampler2D uTex;
uniform vec4 uUvRect;         // 内容映射：xy 偏移，zw 缩放
uniform vec2 uQuad;           // 四边形像素尺寸
uniform vec2 uSize;           // 形状像素尺寸
uniform int uMask;
uniform float uRadius;
uniform float uBorder;
uniform vec4 uBorderColor;
uniform vec4 uColor;
uniform vec4 uColor2;
uniform float uGradAngle;
uniform float uStroke;
uniform float uOpacity;
uniform float uSoft;
uniform float uReveal;        // 文字逐渐显现 0..1
uniform int uPattern;
uniform float uTime;
uniform int uGrade;
uniform vec4 uG1;             // exposure, contrast, saturation, warmth
uniform vec4 uG2;             // tint, fade, mono, splitAmount
uniform vec3 uSplitS;
uniform vec3 uSplitH;
out vec4 outColor;
${SDF}
vec3 grade(vec3 c){
  c *= exp2(uG1.x);
  c.r *= 1.0 + uG1.w * 0.12; c.b *= 1.0 - uG1.w * 0.12;
  c.g *= 1.0 - uG2.x * 0.08;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uG1.z);
  c = (c - 0.5) * uG1.y + 0.5;
  float m = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, vec3(m), uG2.z);
  float lum = clamp(dot(c, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
  c += (mix(uSplitS, uSplitH, smoothstep(0.0, 1.0, lum)) - 0.5) * uG2.w;
  c = uG2.y + c * (1.0 - uG2.y);
  return clamp(c, 0.0, 1.0);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 p = (vUv - 0.5) * uQuad;
  vec2 hs = uSize * 0.5;
  float d = shapeSdf(uMask, p, hs, uRadius);
  float aa = 0.8;
  if (uMode == 2) {
    float a = 1.0 - smoothstep(-uSoft, uSoft, d);
    outColor = vec4(uColor.rgb, 1.0) * uColor.a * a * uOpacity;
    return;
  }
  float alpha = clamp(0.5 - d / aa, 0.0, 1.0);
  vec4 col;
  if (uMode == 0) {
    vec2 uv = uUvRect.xy + vUv * uUvRect.zw;
    col = texture(uTex, uv);
    if (uGrade == 1 && col.a > 0.0) { col.rgb = grade(col.rgb / col.a) * col.a; }
    if (uReveal < 1.0) {
      float edge = uReveal * 1.15 - 0.075;
      col *= 1.0 - smoothstep(edge - 0.06, edge + 0.06, vUv.x);
    }
  } else if (uMode == 1) {
    vec2 dir = vec2(cos(uGradAngle), sin(uGradAngle));
    float t = clamp(dot(vUv - 0.5, dir) + 0.5, 0.0, 1.0);
    vec4 c = mix(uColor, uColor2, t);
    col = vec4(c.rgb * c.a, c.a);
  } else if (uMode == 3) {
    float t = clamp(length((vUv - 0.5) * vec2(uQuad.x / max(uQuad.x, uQuad.y), uQuad.y / max(uQuad.x, uQuad.y))) * 1.6, 0.0, 1.0);
    vec4 c = mix(uColor, uColor2, smoothstep(0.0, 1.0, t));
    col = vec4(c.rgb * c.a, c.a);
  } else {
    vec2 px = vUv * uQuad;
    float k = 0.0;
    if (uPattern == 0) { k = hash(floor(px / 2.0)) * 0.5 + hash(floor(px / 9.0)) * 0.5; k = smoothstep(0.2, 1.0, k) * 0.5; }
    else if (uPattern == 1) { vec2 g = mod(px, 26.0) - 13.0; k = 1.0 - smoothstep(2.0, 3.2, length(g)); }
    else if (uPattern == 2) { vec2 g = abs(mod(px, 40.0) - 20.0); k = step(19.0, max(g.x, g.y)); }
    else if (uPattern == 3) { k = step(0.5, fract((px.x + px.y) / 28.0)) * 0.6; }
    else {
      // 胶片：uColor 片基，uColor2 片孔
      float m = uQuad.y * 0.11; float per = m * 1.5;
      float y = px.y; float yy = y < m ? y : y - (uQuad.y - m);
      float edge = step(y, m) + step(uQuad.y - m, y);
      vec2 h = vec2(abs(mod(px.x, per) - per * 0.5), abs(yy - m * 0.5));
      k = edge * (1.0 - smoothstep(-1.0, 1.0, sdRoundRect(vec2(h.x, h.y), vec2(per * 0.24, m * 0.26), m * 0.08)));
    }
    vec4 c = mix(uColor, uColor2, k);
    col = vec4(c.rgb * c.a, c.a);
  }
  if (uStroke > 0.0) {
    alpha *= clamp(0.5 + (d + uStroke) / aa, 0.0, 1.0);
  }
  if (uBorder > 0.0) {
    float t = clamp(0.5 - (d + uBorder) / aa, 0.0, 1.0);
    vec4 bc = vec4(uBorderColor.rgb * uBorderColor.a, uBorderColor.a);
    col = mix(bc, col, t);
  }
  outColor = col * alpha * uOpacity;
}`

// 全屏四边形（左下角原点的 uv）
export const FULL_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos + 0.5; gl_Position = vec4(aPos * 2.0, 0.0, 1.0); }`

export const POST_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime;
uniform float uVignette;
uniform float uGrain;
uniform float uLeak;
uniform float uFade;
out vec4 outColor;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec3 c = texture(uTex, vUv).rgb;
  if (uLeak > 0.0) {
    float t = uTime * 0.15;
    vec2 a = vec2(0.15 + 0.25 * sin(t * 1.3), 0.8 + 0.15 * cos(t * 0.9));
    vec2 b = vec2(0.9 + 0.1 * cos(t * 0.7), 0.25 + 0.2 * sin(t * 1.1));
    vec2 asp = vec2(uRes.x / uRes.y, 1.0);
    float la = exp(-dot((vUv - a) * asp, (vUv - a) * asp) * 3.5);
    float lb = exp(-dot((vUv - b) * asp, (vUv - b) * asp) * 4.5);
    float pulse = 0.6 + 0.4 * sin(uTime * 0.8);
    c += (vec3(1.0, 0.55, 0.25) * la + vec3(1.0, 0.35, 0.45) * lb) * uLeak * pulse;
  }
  if (uVignette > 0.0) {
    vec2 q = (vUv - 0.5) * vec2(uRes.x / max(uRes.x, uRes.y), uRes.y / max(uRes.x, uRes.y)) * 1.5;
    c *= 1.0 - uVignette * smoothstep(0.35, 1.05, length(q));
  }
  if (uGrain > 0.0) {
    float n = hash(floor(vUv * uRes) + fract(uTime * 7.31) * 100.0) - 0.5;
    c += n * uGrain;
  }
  c *= 1.0 - uFade;
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`

export const COPY_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
out vec4 outColor;
void main(){ outColor = texture(uTex, vUv); }`

export const PARTICLE_VS = `#version 300 es
layout(location=0) in vec2 aPos;
layout(location=1) in vec4 iPos;     // x, y, 尺寸, 旋转
layout(location=2) in vec4 iColor;   // 预乘颜色
layout(location=3) in vec2 iCell;    // 图集格子, x 方向缩放（彩纸翻转）
uniform vec2 uRes;
out vec2 vUv;
out vec4 vColor;
void main(){
  float cell = iCell.x;
  vec2 cellXY = vec2(mod(cell, 4.0), floor(cell / 4.0));
  vUv = (cellXY + (aPos + 0.5)) / 4.0;
  vColor = iColor;
  vec2 p = aPos * iPos.z * vec2(iCell.y, 1.0);
  float c = cos(iPos.w), s = sin(iPos.w);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + iPos.xy;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`

export const PARTICLE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in vec4 vColor;
uniform sampler2D uTex;
out vec4 outColor;
void main(){ float a = texture(uTex, vUv).a; outColor = vColor * a; }`
