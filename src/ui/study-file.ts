import { TRANSFER_IDLE_MS, TRANSFER_TOTAL_MS } from "../core/offline-policy";
import { STUDY_ASSETS } from "../study-assets";

/** Bound byte counts and body inactivity before trusting a retained study asset. */
export async function studyFile(
  name: keyof typeof STUDY_ASSETS,
  signal: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });
  let idle: ReturnType<typeof setTimeout> | undefined;
  const progress = () => {
    clearTimeout(idle);
    idle = setTimeout(
      () => controller.abort(new DOMException("Study asset stopped arriving.", "TimeoutError")),
      TRANSFER_IDLE_MS,
    );
  };
  const total = setTimeout(
    () =>
      controller.abort(
        new DOMException("Study asset exceeded its transfer window.", "TimeoutError"),
      ),
    TRANSFER_TOTAL_MS,
  );
  let reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>> | undefined;
  try {
    progress();
    const response = await fetch(`${import.meta.env.BASE_URL}fonts/${name}`, {
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error(`Unable to read ${name}.`);
    const expected = STUDY_ASSETS[name];
    reader = response.body.getReader();
    const bytes = new Uint8Array(expected.bytes);
    let offset = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value.length) continue;
      if (offset + value.length > expected.bytes)
        throw new Error(`Oversized study asset: ${name}.`);
      bytes.set(value, offset);
      offset += value.length;
      progress();
    }
    if (offset !== expected.bytes) throw new Error(`Unexpected length for ${name}.`);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const hex = Array.from(digest, (n) => n.toString(16).padStart(2, "0")).join("");
    if (hex !== expected.sha256) throw new Error(`Unexpected bytes for ${name}.`);
    controller.signal.throwIfAborted();
    return bytes;
  } catch (error) {
    if (!signal.aborted || signal.reason?.name !== "AbortError")
      window.dispatchEvent(
        new CustomEvent("sammu-asset-failure", { detail: { path: `fonts/${name}` } }),
      );
    throw controller.signal.aborted ? controller.signal.reason : error;
  } finally {
    clearTimeout(idle);
    clearTimeout(total);
    signal.removeEventListener("abort", abort);
    controller.abort();
    if (reader) {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
}
