import { BytePort } from "@/lib/web-setup/serial";

async function expectHueOk(port: BytePort, kind: "token" | "url"): Promise<void> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const line = await port.readLine(Math.min(2000, deadline - Date.now()));
    if (line == null) continue;
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === `HUEOK ${kind}`) return;
    if (trimmed.startsWith("HUEERR")) {
      throw new Error(trimmed);
    }
  }
  throw new Error(`Timed out waiting for HUEOK ${kind}`);
}

export async function writeConsoleNvs(
  port: BytePort,
  token: string,
  url: string,
): Promise<void> {
  await port.writeLine(`HUESET token ${token}`);
  await expectHueOk(port, "token");
  await port.writeLine(`HUESET url ${url}`);
  await expectHueOk(port, "url");
}

export async function mintUsbDeviceToken(name: string): Promise<string> {
  const res = await fetch("/api/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const body = (await res.json()) as { token?: string; error?: string; details?: string };
  if (!res.ok || !body.token) {
    throw new Error(body.details ?? body.error ?? "Could not create a device key");
  }
  return body.token;
}
