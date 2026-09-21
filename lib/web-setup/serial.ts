export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestSerialPort(): Promise<SerialPort> {
  if (!("serial" in navigator)) {
    throw new Error("Use Chrome or Edge on a computer");
  }
  try {
    return await navigator.serial.requestPort();
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotFoundError") {
      throw new Error("No serial port selected");
    }
    throw err instanceof Error ? err : new Error("Could not open a serial port");
  }
}

/**
 * Exclusive Web Serial reader/writer with a leftover buffer.
 * Used for Improv packets, then ASCII HUESET on the same CDC.
 */
export class BytePort {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private pending: Promise<ReadableStreamReadResult<Uint8Array>> | null = null;
  private buffer = new Uint8Array(0);
  private closed = false;

  constructor(readonly port: SerialPort) {}

  async open(baudRate = 115200): Promise<void> {
    await this.port.open({ baudRate });
    if (!this.port.readable || !this.port.writable) {
      throw new Error("Serial port has no readable/writable streams");
    }
    this.reader = this.port.readable.getReader();
    this.writer = this.port.writable.getWriter();
  }

  peek(): Uint8Array {
    return this.buffer;
  }

  consume(n: number): Uint8Array {
    const slice = this.buffer.slice(0, n);
    this.buffer = this.buffer.slice(n);
    return slice;
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.writer) throw new Error("Serial port is not open");
    await this.writer.write(data);
  }

  async writeLine(line: string): Promise<void> {
    const payload = line.endsWith("\n") ? line : `${line}\n`;
    await this.write(new TextEncoder().encode(payload));
  }

  async fill(timeoutMs: number): Promise<boolean> {
    if (this.buffer.length > 0) return true;
    if (this.closed) return false;
    if (!this.reader) throw new Error("Serial port is not open");
    const start = Date.now();
    while (!this.closed && Date.now() - start < timeoutMs) {
      if (!this.pending) {
        this.pending = this.reader
          .read()
          .then((result) => {
            if (result.value && result.value.length > 0) {
              const next = new Uint8Array(this.buffer.length + result.value.length);
              next.set(this.buffer, 0);
              next.set(result.value, this.buffer.length);
              this.buffer = next;
            }
            if (result.done) this.closed = true;
            return result;
          })
          .finally(() => {
            this.pending = null;
          });
      }
      const remain = Math.max(1, timeoutMs - (Date.now() - start));
      const outcome = await Promise.race([
        this.pending.then(() => "data" as const),
        sleep(remain).then(() => "timeout" as const),
      ]);
      if (this.buffer.length > 0) return true;
      if (outcome === "timeout") return false;
    }
    return this.buffer.length > 0;
  }

  async readLine(timeoutMs: number): Promise<string | null> {
    const decoder = new TextDecoder();
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const text = decoder.decode(this.buffer);
      const match = text.match(/^(.*?)(\r\n|\n)/);
      if (match) {
        const bytes = new TextEncoder().encode(match[0]);
        this.consume(bytes.length);
        return match[1];
      }
      const got = await this.fill(Math.max(1, timeoutMs - (Date.now() - start)));
      if (!got && this.closed) return null;
    }
    return null;
  }

  async close(): Promise<void> {
    this.closed = true;
    try {
      await this.reader?.cancel();
    } catch {
      /* already gone */
    }
    try {
      this.reader?.releaseLock();
    } catch {
      /* already released */
    }
    try {
      this.writer?.releaseLock();
    } catch {
      /* already released */
    }
    this.reader = null;
    this.writer = null;
    try {
      await this.port.close();
    } catch {
      /* already closed */
    }
  }
}

