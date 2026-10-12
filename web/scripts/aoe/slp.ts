// Decoder for Genie SLP sprites (version 2.0N, used by AoE and Rise of Rome).
//
// Each frame has an outline table (left/right transparent padding per row) and a command table (offset of
// each row's draw commands). Pixels are palette indexes; player-colour pixels are stored as the colour's
// shade (0-7) and drawn as palette index shade + 16 * (player + 1).

export interface SlpFrame {
  width: number;
  height: number;
  hotspotX: number;
  hotspotY: number;
  /** Palette index per pixel, -1 where transparent. */
  pixels: Int16Array;
  /** Player-colour shade (0-7) per pixel, -1 elsewhere. */
  player: Int8Array;
  /** 1 where the pixel is a shadow, 0 elsewhere. */
  shadow: Uint8Array;
  /** 1 where the pixel is an outline (shown when the unit is behind a building). */
  outline: Uint8Array;
}

export function readSlp(bytes: Uint8Array): SlpFrame[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = Buffer.from(bytes.subarray(0, 4)).toString("latin1");
  if (!version.startsWith("2.0")) throw new Error(`unsupported SLP version "${version}"`);
  const count = view.getInt32(4, true);
  const frames: SlpFrame[] = [];
  for (let f = 0; f < count; f++) {
    const info = 32 + f * 32;
    const cmdTable = view.getUint32(info, true);
    const outlineTable = view.getUint32(info + 4, true);
    const width = view.getInt32(info + 16, true);
    const height = view.getInt32(info + 20, true);
    const hotspotX = view.getInt32(info + 24, true);
    const hotspotY = view.getInt32(info + 28, true);
    const n = width * height;
    const frame: SlpFrame = {
      width, height, hotspotX, hotspotY,
      pixels: new Int16Array(n).fill(-1),
      player: new Int8Array(n).fill(-1),
      shadow: new Uint8Array(n),
      outline: new Uint8Array(n),
    };
    for (let y = 0; y < height; y++) {
      const left = view.getUint16(outlineTable + y * 4, true);
      const right = view.getUint16(outlineTable + y * 4 + 2, true);
      if (left === 0x8000 || right === 0x8000) continue;
      let p = view.getUint32(cmdTable + y * 4, true);
      let x = left;
      const row = y * width;
      const put = (i: number, k: "pixels" | "player" | "shadow" | "outline", v: number): void => {
        if (x < width) {
          if (k === "pixels") frame.pixels[row + x] = v;
          else if (k === "player") frame.player[row + x] = v;
          else frame[k][row + x] = v;
        }
        x++;
        void i;
      };
      for (;;) {
        const cmd = bytes[p++];
        const low2 = cmd & 0x03;
        const low4 = cmd & 0x0f;
        if (low2 === 0x00) {
          const len = cmd >> 2;
          for (let i = 0; i < len; i++) put(i, "pixels", bytes[p++]);
        } else if (low2 === 0x01) {
          x += cmd >> 2;
        } else if (low4 === 0x02) {
          const len = ((cmd & 0xf0) << 4) + bytes[p++];
          for (let i = 0; i < len; i++) put(i, "pixels", bytes[p++]);
        } else if (low4 === 0x03) {
          x += ((cmd & 0xf0) << 4) + bytes[p++];
        } else if (low4 === 0x0f) {
          break;
        } else {
          let len = cmd >> 4;
          const ext = low4 === 0x0e;
          if (!ext && len === 0) len = bytes[p++];
          if (low4 === 0x06) {
            for (let i = 0; i < len; i++) {
              const v = bytes[p++];
              if (x < width) {
                frame.pixels[row + x] = v;
                frame.player[row + x] = v & 0x0f;
              }
              x++;
            }
          } else if (low4 === 0x07) {
            const v = bytes[p++];
            for (let i = 0; i < len; i++) put(i, "pixels", v);
          } else if (low4 === 0x0a) {
            const v = bytes[p++];
            for (let i = 0; i < len; i++) {
              if (x < width) {
                frame.pixels[row + x] = v;
                frame.player[row + x] = v & 0x0f;
              }
              x++;
            }
          } else if (low4 === 0x0b) {
            for (let i = 0; i < len; i++) put(i, "shadow", 1);
          } else if (ext) {
            const sub = cmd >> 4;
            if (sub === 4 || sub === 6) put(0, "outline", 1);
            else if (sub === 5 || sub === 7) {
              const k = bytes[p++];
              for (let i = 0; i < k; i++) put(i, "outline", 1);
            }
            // 0-3: mirroring and colour-table hints, no pixels.
          } else {
            throw new Error(`SLP frame ${f} row ${y}: unknown command 0x${cmd.toString(16)}`);
          }
        }
      }
    }
    frames.push(frame);
  }
  return frames;
}
