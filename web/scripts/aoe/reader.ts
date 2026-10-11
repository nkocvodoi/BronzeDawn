// Little-endian cursor over a byte buffer, used by the AoE file readers.

export class Reader {
  pos = 0;
  private view: DataView;

  constructor(readonly buf: Uint8Array, start = 0) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    this.pos = start;
  }

  get left(): number {
    return this.buf.length - this.pos;
  }

  private need(n: number): void {
    if (this.pos + n > this.buf.length) {
      throw new Error(`read past end at ${this.pos} (+${n} of ${this.buf.length})`);
    }
  }

  u8(): number {
    this.need(1);
    return this.view.getUint8(this.pos++);
  }

  i8(): number {
    this.need(1);
    return this.view.getInt8(this.pos++);
  }

  u16(): number {
    this.need(2);
    const v = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }

  i16(): number {
    this.need(2);
    const v = this.view.getInt16(this.pos, true);
    this.pos += 2;
    return v;
  }

  u32(): number {
    this.need(4);
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }

  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }

  /** float32, rounded to 6 significant digits so 0.1 stays 0.1 in JSON. */
  f32(): number {
    this.need(4);
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return Number.isFinite(v) ? Number(v.toPrecision(6)) : v;
  }

  /** Fixed-size NUL-padded Latin-1 string. */
  str(n: number): string {
    this.need(n);
    const bytes = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    const end = bytes.indexOf(0);
    return Buffer.from(end < 0 ? bytes : bytes.subarray(0, end)).toString("latin1");
  }

  skip(n: number): void {
    this.need(n);
    this.pos += n;
  }

  times<T>(n: number, f: () => T): T[] {
    const out: T[] = [];
    for (let i = 0; i < n; i++) out.push(f());
    return out;
  }
}
