export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type SerialLog = (line: string) => void;

const OPEN_OPTS = { baudRate: 115200, bufferSize: 8192 } as const;
const REOPEN_MS = 10000;
const POST_OPEN_WATCH_MS = 3000;
const POST_REOPEN_SETUP_MS = 3000;

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

function isAlreadyOpen(err: unknown): boolean {
  return err instanceof DOMException && err.name === "InvalidStateError";
}

function isDeviceLost(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "NetworkError") return true;
  return err instanceof Error && /device has been lost/i.test(err.message);
}

export function portConnected(port: SerialPort): boolean | undefined {
  if ("connected" in port && typeof (port as SerialPort & { connected?: boolean }).connected === "boolean") {
    return (port as SerialPort & { connected: boolean }).connected;
  }
  return undefined;
}

/**
 * BOOT+RESET makes the C6 drop off USB and come back as a new SerialPort, so the
 * port picked at Detect is dead. Finds the same board (vendor/product id) among the
 * ports this page may already use, waiting a moment for it to re-enumerate.
 */
export async function reattachPort(port: SerialPort, waitMs = 3000): Promise<SerialPort | null> {
  if (portConnected(port) !== false) return port;
  const { usbVendorId, usbProductId } = port.getInfo();
  const deadline = Date.now() + waitMs;
  for (;;) {
    const ports = await navigator.serial.getPorts();
    const match = ports.find((candidate) => {
      if (candidate === port || portConnected(candidate) === false) return false;
      const info = candidate.getInfo();
      return info.usbVendorId === usbVendorId && info.usbProductId === usbProductId;
    });
    if (match) return match;
    if (Date.now() >= deadline) return null;
    await sleep(250);
  }
}

/**
 * Exclusive Web Serial reader/writer with a leftover buffer.
 * Used for Improv packets, then ASCII HUESET on the same CDC.
 *
 * Opening Web Serial may assert DTR. We do not pulse DTR/RTS after open —
 * that sequence resets USB-Serial-JTAG. If the handle dies, wait for a new
 * USB connect / getPorts entry (when disconnect fired) and reopen streams.
 */
export class BytePort {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private pending: Promise<ReadableStreamReadResult<Uint8Array>> | null = null;
  private buffer = new Uint8Array(0);
  private closed = false;
  private lost = false;
  private lastReadDone = false;
  private disconnectFired = false;
  private dropping = false;
  private baudRate = 115200;
  private recoverPromise: Promise<void> | null = null;
  private disconnectWaiters: Array<() => void> = [];

  constructor(
    public port: SerialPort,
    private readonly onLog?: SerialLog,
  ) {
    this.port.addEventListener("disconnect", this.onDisconnect);
  }

  /** True when the USB handle is gone (disconnect, reader.done, or NetworkError). */
  get dead(): boolean {
    return this.lost || this.closed || !this.reader;
  }

  describeHandle(): string {
    const connected = portConnected(this.port);
    const conn = connected === undefined ? "?" : connected ? "true" : "false";
    return `connected=${conn} reader.done=${this.lastReadDone} buf=${this.buffer.length} hex=${this.peekHex()}`;
  }

  /** Leftover bytes as hex (capped) so partial Improv headers or ASCII logs are visible. */
  peekHex(max = 32): string {
    const head = Array.from(this.buffer.slice(0, max))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return this.buffer.length > max ? `${head}…` : head || "-";
  }

  private logHandle(label: string): void {
    this.onLog?.(`${label} ${this.describeHandle()}`);
  }

  private onDisconnect = (): void => {
    if (this.dropping) return;
    this.disconnectFired = true;
    this.lost = true;
    this.closed = true;
    this.lastReadDone = true;
    for (const wait of this.disconnectWaiters) wait();
    this.disconnectWaiters = [];
  };

  async open(baudRate = 115200): Promise<void> {
    this.baudRate = baudRate;
    this.closed = false;
    this.lost = false;
    this.lastReadDone = false;
    this.disconnectFired = false;
    this.buffer = new Uint8Array(0);
    try {
      await this.port.open({ ...OPEN_OPTS, baudRate });
    } catch (err) {
      if (isAlreadyOpen(err)) {
        /* reuse an already-open handle */
      } else if (this.lost || isDeviceLost(err)) {
        this.onLog?.("port lost");
        await this.reopen();
        return;
      } else {
        throw err instanceof Error ? err : new Error("Could not open serial port");
      }
    }
    if (this.lost) {
      this.onLog?.("port lost");
      await this.reopen();
      return;
    }
    this.grabStreams();
    this.logHandle("open");
    const dropped = await this.watchAfterOpen();
    if (dropped) {
      this.onLog?.("port lost");
      await this.reopen();
      return;
    }
    this.logHandle("open settled");
  }

  /**
   * Close the stale handle, wait for USB re-enumeration, open streams again.
   * Safe to call more than once; overlapping calls share one attempt.
   */
  async reopen(): Promise<void> {
    if (this.recoverPromise) return this.recoverPromise;
    this.recoverPromise = this.reopenOnce().finally(() => {
      this.recoverPromise = null;
    });
    return this.recoverPromise;
  }

  private async reopenOnce(): Promise<void> {
    const preferNewHandle = this.disconnectFired;
    await this.dropStreams();
    const next = await waitForUsbReturn(
      this.port,
      this.baudRate,
      REOPEN_MS,
      preferNewHandle,
    );
    if (next !== this.port) {
      this.port.removeEventListener("disconnect", this.onDisconnect);
      this.port = next;
      this.port.addEventListener("disconnect", this.onDisconnect);
      this.onLog?.("port reopened (new USB handle)");
    } else {
      this.onLog?.("port reopened (same handle)");
    }
    this.lost = false;
    this.closed = false;
    this.disconnectFired = false;
    this.lastReadDone = false;
    this.buffer = new Uint8Array(0);
    this.pending = null;
    this.grabStreams();
    this.logHandle("reopened");
    await sleep(POST_REOPEN_SETUP_MS);
    this.logHandle("reopened settled");
  }

  private grabStreams(): void {
    if (!this.port.readable || !this.port.writable) {
      throw new Error("Serial port has no readable/writable streams");
    }
    this.reader = this.port.readable.getReader();
    this.writer = this.port.writable.getWriter();
    this.lastReadDone = false;
  }

  private async watchAfterOpen(): Promise<boolean> {
    if (this.lost || this.closed) return true;
    const eventDrop = this.watchForDrop(POST_OPEN_WATCH_MS);
    await this.fill(POST_OPEN_WATCH_MS);
    const dropped = (await eventDrop) || this.lost || this.closed;
    return dropped;
  }

  private watchForDrop(ms: number): Promise<boolean> {
    if (this.lost || this.closed) return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.disconnectWaiters = this.disconnectWaiters.filter((w) => w !== notify);
        resolve(this.lost || this.closed);
      }, ms);
      const notify = () => {
        clearTimeout(timer);
        resolve(true);
      };
      this.disconnectWaiters.push(notify);
    });
  }

  private async dropStreams(): Promise<void> {
    this.dropping = true;
    this.closed = true;
    try {
      try {
        await this.reader?.cancel();
      } catch {
        /* already gone */
      }
      if (this.pending) {
        try {
          await this.pending;
        } catch {
          /* cancelled */
        }
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
      this.pending = null;
      try {
        await this.port.close();
      } catch {
        /* already closed */
      }
    } finally {
      this.dropping = false;
    }
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

  /** With needMore, wait for bytes beyond what is already buffered. */
  async fill(timeoutMs: number, needMore = false): Promise<boolean> {
    const baseLen = needMore ? this.buffer.length : 0;
    if (this.buffer.length > baseLen) return true;
    if (this.closed || this.lost) return false;
    if (!this.reader) throw new Error("Serial port is not open");
    const start = Date.now();
    while (!this.closed && !this.lost && Date.now() - start < timeoutMs) {
      if (!this.pending) {
        this.pending = this.reader
          .read()
          .then(
            (result) => {
              if (result.value && result.value.length > 0) {
                const next = new Uint8Array(this.buffer.length + result.value.length);
                next.set(this.buffer, 0);
                next.set(result.value, this.buffer.length);
                this.buffer = next;
              }
              if (result.done) {
                this.lastReadDone = true;
                this.closed = true;
                this.lost = true;
              }
              return result;
            },
            (err: unknown) => {
              this.lastReadDone = true;
              this.closed = true;
              this.lost = true;
              if (isDeviceLost(err)) {
                /* USB re-enumerated under the reader */
              }
              return { value: undefined, done: true as const };
            },
          )
          .finally(() => {
            this.pending = null;
          });
      }
      const remain = Math.max(1, timeoutMs - (Date.now() - start));
      const pending = this.pending;
      if (!pending) continue;
      const outcome = await Promise.race([
        pending.then(() => "data" as const),
        sleep(remain).then(() => "timeout" as const),
      ]);
      if (this.buffer.length > baseLen) return true;
      if (this.lost || this.closed) return false;
      if (outcome === "timeout") return false;
    }
    return this.buffer.length > baseLen;
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
      if (!got && (this.closed || this.lost)) return null;
    }
    return null;
  }

  async close(): Promise<void> {
    this.port.removeEventListener("disconnect", this.onDisconnect);
    await this.dropStreams();
  }
}

async function waitForUsbReturn(
  previous: SerialPort,
  baudRate: number,
  timeoutMs: number,
  preferNewHandle: boolean,
): Promise<SerialPort> {
  const deadline = Date.now() + timeoutMs;
  const info = previous.getInfo();

  const tryOpen = async (port: SerialPort): Promise<boolean> => {
    const connected = portConnected(port);
    if (connected === false) return false;
    try {
      await port.open({ ...OPEN_OPTS, baudRate });
      return true;
    } catch (err) {
      if (isAlreadyOpen(err)) {
        if (port.readable && port.writable) return true;
        try {
          await port.close();
        } catch {
          /* retry */
        }
      }
      return false;
    }
  };

  const sameDevice = (port: SerialPort): boolean => {
    const i = port.getInfo();
    return i.usbVendorId === info.usbVendorId && i.usbProductId === info.usbProductId;
  };

  if (!preferNewHandle && (await tryOpen(previous))) return previous;

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      finish();
      reject(new Error("USB device did not come back after reset"));
    }, Math.max(1, deadline - Date.now()));

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      navigator.serial.removeEventListener("connect", onConnect);
    };

    const onConnect = (ev: Event) => {
      const next = (ev as Event & { port?: SerialPort }).port;
      if (!next) return;
      void (async () => {
        if (settled) return;
        if (await tryOpen(next)) {
          if (settled) {
            try {
              await next.close();
            } catch {
              /* lost the race */
            }
            return;
          }
          finish();
          resolve(next);
        }
      })();
    };
    navigator.serial.addEventListener("connect", onConnect);

    const adopt = async (port: SerialPort): Promise<boolean> => {
      if (settled) return false;
      if (!(await tryOpen(port))) return false;
      if (settled) {
        try {
          await port.close();
        } catch {
          /* lost the race */
        }
        return false;
      }
      finish();
      resolve(port);
      return true;
    };

    void (async () => {
      while (!settled && Date.now() < deadline) {
        await sleep(200);
        if (settled) return;
        let ports: SerialPort[] = [];
        try {
          ports = await navigator.serial.getPorts();
        } catch {
          continue;
        }
        const fresh = ports.find((p) => p !== previous && sameDevice(p));
        if (fresh && (await adopt(fresh))) return;
        const allowPrevious = !preferNewHandle || Date.now() > deadline - 1500;
        if (allowPrevious && (await adopt(previous))) return;
        const match = ports.find((p) => p === previous || sameDevice(p));
        if (allowPrevious && match && match !== previous && (await adopt(match))) {
          return;
        }
      }
    })();
  });
}
