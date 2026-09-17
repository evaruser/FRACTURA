import Phaser from 'phaser';

/* ============================================================
   CAPA 2 — WebGL
   Shader de post-proceso: se aplica a TODO lo que renderiza la
   camara, despues de que Phaser haya dibujado la escena.
   Hace tres cosas:
     1. Desplaza bandas horizontales (el "glitch" del salto)
     2. Aberracion cromatica (separa los canales R/B)
     3. Tinte + scanlines segun la dimension activa
   ============================================================ */

const fragShader = `
precision mediump float;

uniform sampler2D uMainSampler;   // lo que ya dibujo Phaser
uniform float uIntensity;         // 0 = limpio, 1 = glitch maximo
uniform float uTime;
uniform vec2  uResolution;
uniform vec3  uTint;              // tinte de la dimension activa
uniform float uTintAmount;

varying vec2 outTexCoord;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = outTexCoord;
  float i = uIntensity;

  // --- 1. Bandas desplazadas -------------------------------
  // Partimos la pantalla en 26 franjas; cada una se mueve en X
  // una cantidad aleatoria, pero solo las que superan el umbral
  // (step) para que queden huecos y parezca senal rota.
  float banda  = floor(uv.y * 26.0);
  float ruido  = rand(vec2(banda, floor(uTime * 18.0)));
  float salto  = (ruido - 0.5) * 0.14 * i * step(0.62, ruido);
  uv.x = fract(uv.x + salto);

  // --- 2. Aberracion cromatica -----------------------------
  // Leemos la misma textura 3 veces con offsets distintos.
  // El offset va en coordenadas UV (0..1), asi que 0.001 son ~1px
  // en 960 de ancho: en reposo casi no se nota, en el glitch si.
  float ca = 0.0007 + 0.010 * i;
  float r = texture2D(uMainSampler, uv + vec2(ca, 0.0)).r;
  float g = texture2D(uMainSampler, uv).g;
  float b = texture2D(uMainSampler, uv - vec2(ca, 0.0)).b;
  vec3 col = vec3(r, g, b);

  // --- 3. Tinte de dimension + scanlines -------------------
  col = mix(col, col * uTint, uTintAmount);

  float scan = sin(uv.y * uResolution.y * 1.45 + uTime * 6.0) * 0.5 + 0.5;
  col -= scan * (0.018 + 0.16 * i);

  // Chispazos blancos puntuales durante el glitch fuerte
  float chispa = step(0.988, rand(vec2(uv.y * 90.0, floor(uTime * 40.0)))) * i;
  col += chispa * 0.45;

  // Vineta suave, siempre activa
  vec2 d = outTexCoord - 0.5;
  col *= 1.0 - dot(d, d) * 0.85;

  gl_FragColor = vec4(col, 1.0);
}
`;

export default class GlitchPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game) {
    super({ game, name: 'GlitchFX', fragShader });

    this.intensity = 0;      // pico al cambiar de dimension, decae solo
    this.tint = [1, 1, 1];
    this.tintAmount = 0;
    this._t = 0;
  }

  /** Dispara un pico de glitch. La escena solo llama a esto. */
  burst(valor = 1) {
    this.intensity = Math.min(1, this.intensity + valor);
  }

  /** Tinte persistente de la dimension (r,g,b como multiplicadores). */
  setTint(r, g, b, cantidad = 1) {
    this.tint = [r, g, b];
    this.tintAmount = cantidad;
  }

  /** Llamado por la escena en cada update con el delta en ms. */
  decay(deltaMs) {
    this._t += deltaMs / 1000;
    // Caida exponencial: rapida al principio, cola suave.
    this.intensity *= Math.pow(0.0025, deltaMs / 1000);
    if (this.intensity < 0.002) this.intensity = 0;
  }

  onPreRender() {
    this.set1f('uIntensity', this.intensity);
    this.set1f('uTime', this._t);
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
    this.set3f('uTint', this.tint[0], this.tint[1], this.tint[2]);
    this.set1f('uTintAmount', this.tintAmount);
  }
}
