// The fog of war as the original drew it: solid black where nobody has looked, a stipple of black
// pixels over ground you have seen but cannot see now, and a crisp, wavy edge between them.
//
// The fog texture holds one pixel a tile (unexplored 255, explored 110, visible 0) and is drawn
// stretched with smooth filtering. This filter turns that smooth field into hard levels on the GPU,
// so the edges are sharp at any zoom and cost nothing per frame on the CPU. The stipple and the
// wobble are anchored to the world, so they do not crawl when the camera moves.
import { Filter, GlProgram } from "pixi.js";
import { HALF_H, HALF_W } from "./iso";

const vertex = `in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}`;

const fragment = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec2 uLayer;
uniform float uScale;
uniform float uRes;
uniform float uViewH;
void main(void) {
  float f = texture(uTexture, vTextureCoord).a;
  // Back from the screen to the world: CSS pixels, then world units, then tiles.
  vec2 css = vec2(gl_FragCoord.x, uViewH - gl_FragCoord.y) / uRes;
  vec2 s = (css - uLayer) / uScale;
  vec2 t = vec2(s.x / ${HALF_W.toFixed(1)} + s.y / ${HALF_H.toFixed(1)}, s.y / ${HALF_H.toFixed(1)} - s.x / ${HALF_W.toFixed(1)}) * 0.5;
  // A gentle wobble, so the edge waves like the original's instead of following the tiles.
  f += (sin(t.x * 2.7 + t.y * 1.3) + sin(t.y * 3.1 - t.x * 1.9)) * 0.04;
  // The stipple is a checker of whole screen pixels (two at high zoom), counted from the world's corner
  // so it keeps still while scrolling; at 1.5x a world-unit checker would come out uneven.
  float cell = max(1.0, floor(uScale + 0.5));
  vec2 q = floor((css - uLayer) / cell);
  float checker = mod(q.x + q.y, 2.0);
  float a = f > 0.72 ? 1.0 : (f > 0.21 ? checker : 0.0);
  finalColor = vec4(0.0, 0.0, 0.0, a);
}`;

export class FogFilter {
  readonly filter: Filter;
  private u: { uLayer: Float32Array; uScale: number; uRes: number; uViewH: number };

  constructor(resolution: number) {
    this.filter = new Filter({
      glProgram: GlProgram.from({ vertex, fragment, name: "fog-of-war" }),
      resources: {
        fogUniforms: {
          uLayer: { value: new Float32Array(2), type: "vec2<f32>" },
          uScale: { value: 1, type: "f32" },
          uRes: { value: resolution, type: "f32" },
          uViewH: { value: 1, type: "f32" },
        },
      },
      resolution,
      antialias: "off",
    });
    this.u = (this.filter.resources.fogUniforms as unknown as { uniforms: FogFilter["u"] }).uniforms;
  }

  /** Where the world layer sits on screen this frame, and how big the canvas is in device pixels. */
  update(layerX: number, layerY: number, scale: number, canvasPixelHeight: number) {
    this.u.uLayer[0] = layerX;
    this.u.uLayer[1] = layerY;
    this.u.uScale = scale;
    this.u.uViewH = canvasPixelHeight;
  }
}
