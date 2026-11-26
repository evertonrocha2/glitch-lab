// The two fragment shaders of the "Ardósia" site. Both read u_res, u_time; the arcana one also
// follows u_pointer (0..1, eased by the runner) and u_scroll (0..1 as its section leaves the screen).
// Shaders sit only behind heroes and CTA bands, never behind reading content.

const COMMON = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res;
uniform float u_time;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0., a = .5; mat2 r = mat2(.8,-.6,.6,.8);
  for (int i = 0; i < 5; i++){ v += a*noise(p); p = r*p*2.03 + vec2(1.7, 9.2); a *= .5; } return v; }
float fbm3(vec2 p){ float v = 0., a = .5; mat2 r = mat2(.8,-.6,.6,.8);
  for (int i = 0; i < 3; i++){ v += a*noise(p); p = r*p*2.03 + vec2(1.7, 9.2); a *= .5; } return v; }
`

// Névoa arcana, in Ardósia: domain-warped fog in graphite slate and steel blue, calm steel and silver
// aurora ribbons across the top, a light pool behind the hero card that leans toward the pointer, a
// soft gold glow low on the left, gold motes.
export const ARCANA = `${COMMON}
uniform vec2 u_pointer;
uniform float u_scroll;

// One aurora curtain: a bright lower edge that wanders, fading upward in vertical rays.
vec3 curtain(vec2 uv, float t, float fi, vec3 edgeCol, vec3 topCol){
  float x = uv.x * (1.25 + .35*fi) + fi*2.31 + (u_pointer.x - .5)*.35;
  // A diagonal sweep: high over the copy on the left, lower behind the hero card on the right.
  float edge = .80 + .07*fi - .16*uv.x
    + .05*sin(x*2.2 + t*.55 + fi*1.9)
    + .09*(fbm3(vec2(x*1.15, t*.11 + fi*4.)) - .5)
    + u_scroll*.12;
  float d = uv.y - edge;
  float body = smoothstep(-.016, .0, d) * exp(-max(d, 0.) * (7.5 - fi*1.8));
  float rays = mix(.25, 1., noise(vec2(x*30., t*.35 + fi*7.)));
  rays *= mix(.55, 1., noise(vec2(x*8., t*.2 - fi)));
  float sway = .55 + .45*sin(x*1.6 - t*.8 + fi*2.4);
  vec3 col = mix(edgeCol, topCol, smoothstep(0., .16, d));
  return col * body * rays * sway;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - .5*u_res) / u_res.y;
  vec2 lean = u_pointer - .5;
  p += lean * vec2(.10, .06);
  p.y -= u_scroll * .35;
  float t = u_time * .05;
  vec2 q = vec2(fbm(p*1.1 + vec2(0., t)), fbm(p*1.1 + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p*1.5 + 3.2*q + vec2(1.7, 9.2) + t*1.6), fbm(p*1.5 + 3.2*q + vec2(8.3, 2.8) - t*1.3));
  float f = fbm(p*1.25 + 2.6*r);

  // Lifted for a night lit by aurora: the darkest fog is a deep slate, never black.
  vec3 deep   = vec3(.078, .090, .115);
  vec3 slate  = vec3(.150, .185, .240);
  vec3 steel  = vec3(.300, .410, .540);
  vec3 silver = vec3(.660, .720, .800);
  vec3 sage   = vec3(.250, .350, .330);

  vec3 col = mix(deep, slate, smoothstep(.18, .70, f));
  col = mix(col, sage, .28 * smoothstep(.45, .95, q.x) * smoothstep(.3, .8, f));
  col = mix(col, steel, smoothstep(.40, .88, f + .25*length(r) - .15));
  col += silver * pow(smoothstep(.55, .98, f + .1*r.y), 2.5) * .45;

  // Light pool behind the hero card (right), leaning toward the pointer; quieter on the copy side.
  vec2 pc = vec2(.74, .50) + lean * vec2(.10, .08);
  float pool = smoothstep(1.1, .0, length((uv - pc) * vec2(1.3, 1.)));
  float pool2 = smoothstep(.9, .0, length((uv - vec2(.12, 1.05)) * vec2(1.1, 1.6)));
  col *= .95 + .6*pool + .4*pool2;
  // A soft gold glow low on the left, under the copy.
  float warm = smoothstep(.85, .0, length((uv - vec2(.18, -.12)) * vec2(.9, 1.5)));
  col += vec3(.58, .38, .12) * warm * (.35 + .65*smoothstep(.3, .8, f)) * .42;
  col = mix(col, col*1.2 + vec3(.015, .02, .03), smoothstep(.5, .9, f) * pool);

  // Aurora across the top: three calm curtains, steel blue, silver, and a faint gold one.
  float ta = u_time * .6;
  vec3 aur = curtain(uv, ta, 0., vec3(.55, .72, .88), vec3(.28, .42, .60)) * .9;
  aur += curtain(uv, ta*1.13, 1., vec3(.80, .84, .90), vec3(.42, .50, .60)) * .8;
  aur += curtain(uv, ta*.87, 2., vec3(1.0, .82, .48), vec3(.62, .48, .34)) * .6;
  // Softer at the far edges, and never down in the lower half.
  aur *= smoothstep(-.1, .3, uv.x) * smoothstep(1.15, .75, uv.x) * .8 + .2;
  aur *= smoothstep(.38, .64, uv.y);
  col += aur * (.8 + .4*f);

  // A soft sky glow from the top, then a light vignette and a touch more exposure.
  col += vec3(.06, .075, .10) * smoothstep(.3, 1., uv.y);
  col *= mix(.8, 1., smoothstep(1.25, .35, length((uv-.5)*vec2(1.2, 1.))));
  col = col * 1.08 + vec3(.010, .012, .018);

  // Gold motes drifting up.
  vec3 gold = vec3(1., .78, .32);
  float aspect = u_res.x/u_res.y;
  vec2 pp = vec2(uv.x * aspect, uv.y);
  for (int i = 0; i < 20; i++){
    float fi = float(i);
    float h1 = hash(vec2(fi, 3.7)), h2 = hash(vec2(fi, 9.1)), h3 = hash(vec2(fi, 1.3));
    float sp = .015 + .03*h2;
    float y = fract(h1 + u_time*sp - u_scroll*.2) * 1.3 - .15;
    float x = h3 + .03*sin(u_time*(.3 + h2) + fi*2.1);
    float d = length(pp - vec2(x * aspect, y));
    float sz = .0016 + .0024*h2;
    float tw = .55 + .45*sin(u_time*(1.5 + 2.*h1) + fi);
    float life = smoothstep(-.15, .1, y) * smoothstep(1.15, .8, y);
    col += gold * (smoothstep(sz*7., 0., d)*.18 + smoothstep(sz, sz*.2, d)*1.1) * tw * life;
  }

  // Film grain.
  float g = hash(gl_FragCoord.xy + fract(u_time*7.13)*vec2(97.1, 41.3)) - .5;
  col += g * .045;
  gl_FragColor = vec4(col, 1.);
}`

// Brasas: embers rising through heat shimmer, ember and gold under a slate haze.
export const EMBERS = `${COMMON}
vec3 emberLayer(vec2 p, float scale, float speed, float seed, float t){
  p *= scale;
  p.y -= t*speed;
  p.x += .35*sin(p.y*.55 + seed + t*.6);
  vec2 id = floor(p), gv = fract(p) - .5;
  float h = hash(id + seed);
  if (h < .55) return vec3(0.);
  vec2 off = (vec2(hash(id + 3.1 + seed), hash(id + 7.7 + seed)) - .5) * .55;
  vec2 dv = (gv - off) * vec2(1., .42);
  float d = length(dv);
  float sz = mix(.018, .05, hash(id + 1.3));
  float fl = .55 + .45*sin(t*(5. + 6.*h) + h*40.);
  vec3 c = mix(vec3(1., .36, .12), vec3(1., .80, .38), hash(id + 9.));
  return c * (smoothstep(sz*4.5, 0., d)*.28 + smoothstep(sz, sz*.15, d)*1.4) * fl;
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - .5*u_res) / u_res.y;
  float t = u_time;
  vec2 sh = vec2(fbm(p*3. + vec2(0., -t*.9)) - .5, fbm(p*3. + vec2(4.1, -t*1.1)) - .5) * .045;
  vec2 ps = p + sh;
  float flame = fbm(vec2(ps.x*1.8, ps.y*1.2 - t*.35));
  float flame2 = fbm(vec2(ps.x*3.2 + 7., ps.y*2.4 - t*.7));
  float heat = smoothstep(.95, -.1, uv.y + (flame - .5)*.55 + (flame2 - .5)*.25);
  vec3 night = vec3(.090, .100, .125);
  vec3 maroon = vec3(.30, .06, .08);
  vec3 ember = vec3(1., .40, .16);
  vec3 gold = vec3(1., .74, .30);
  vec3 col = mix(night, maroon, smoothstep(.0, .55, heat));
  col = mix(col, ember, smoothstep(.55, .95, heat) * .85);
  col = mix(col, gold, smoothstep(.88, 1.05, heat) * .7);
  col = mix(col, vec3(.19, .23, .29), smoothstep(.55, 1., uv.y) * .55 * (.6 + .4*fbm(p*2. + t*.05)));
  col += emberLayer(ps, 7., .55, 1., t) * (.35 + .65*(1. - uv.y));
  col += emberLayer(ps + 3.3, 4.2, .42, 7., t) * (.4 + .6*(1. - uv.y));
  col += emberLayer(ps + 9.1, 13., .85, 4., t) * .45 * (1. - uv.y);
  col *= mix(.8, 1., smoothstep(1.3, .3, abs(uv.x - .5)*2.));
  float g = hash(gl_FragCoord.xy + fract(t*7.13)*vec2(97.1, 41.3)) - .5;
  col += g * .05;
  gl_FragColor = vec4(col, 1.);
}`

// Per shader: the time of the still frame (reduced motion) and the CSS gradient shown without WebGL
// (and under the canvas while it fades in), close to what the shader paints.
export const SHADERS = {
  arcana: {
    fragment: ARCANA,
    t0: 18,
    fallback:
      'radial-gradient(70% 38% at 50% 0%, rgba(150, 180, 212, .3), transparent 70%), radial-gradient(60% 70% at 72% 42%, #3c5470 0%, transparent 60%), radial-gradient(50% 60% at 18% 88%, rgba(160, 104, 34, .38) 0%, transparent 60%), linear-gradient(180deg, #222833, #1d222b)',
  },
  embers: {
    fragment: EMBERS,
    t0: 9,
    fallback: 'radial-gradient(80% 90% at 50% 120%, #d4521f 0%, #6e1c10 35%, transparent 70%), linear-gradient(180deg, #222833, #2a1e1c)',
  },
}
