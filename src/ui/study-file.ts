import { STUDY_ASSETS } from "../study-assets";

/** HTTP success is not evidence that the retained font or license was received. */
export async function studyFile(
  name: keyof typeof STUDY_ASSETS,
  signal: AbortSignal,
): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}fonts/${name}`, { signal });
    if (!response.ok) throw new Error(`Unable to read ${name}.`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const expected = STUDY_ASSETS[name];
    if (bytes.byteLength !== expected.bytes) throw new Error(`Unexpected length for ${name}.`);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const hex = Array.from(digest, (n) => n.toString(16).padStart(2, "0")).join("");
    if (hex !== expected.sha256) throw new Error(`Unexpected bytes for ${name}.`);
    signal.throwIfAborted();
    return bytes;
  } catch (error) {
    if (!signal.aborted || signal.reason?.name !== "AbortError")
      window.dispatchEvent(
        new CustomEvent("sammu-asset-failure", { detail: { path: `fonts/${name}` } }),
      );
    throw error;
  }
}
