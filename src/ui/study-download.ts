import { TRANSFER_TOTAL_MS } from "../core/offline-policy";
import { saveFile } from "./files";
import { type StudyFonts, studyFonts } from "./study";

/** Capture state in the caller; preparation can finish, fail, time out or cancel. */
export class StudyDownload {
  private controller: AbortController | undefined;

  constructor(
    private readonly save: HTMLButtonElement,
    private readonly cancel: HTMLButtonElement,
    private readonly status: HTMLElement,
  ) {
    cancel.addEventListener("click", () => {
      this.controller?.abort(new DOMException("Saving cancelled.", "AbortError"));
    });
  }

  async start(filename: string, compose: (fonts: StudyFonts) => string): Promise<void> {
    if (this.controller) return;
    const controller = new AbortController();
    this.controller = controller;
    this.save.disabled = true;
    this.cancel.hidden = false;
    this.status.textContent = "Embedding this experiment, audio, fonts and license notices…";
    const timer = setTimeout(
      () => controller.abort(new DOMException("Font preparation timed out.", "TimeoutError")),
      TRANSFER_TOTAL_MS,
    );
    try {
      const fonts = await studyFonts(controller.signal);
      controller.signal.throwIfAborted();
      saveFile(compose(fonts), "text/html;charset=utf-8", filename);
      this.status.textContent =
        "Saved the complete illustrated reading. Open it offline or print it to PDF.";
    } catch (error) {
      const reason = controller.signal.reason ?? error;
      this.status.textContent =
        reason?.name === "AbortError"
          ? "Saving cancelled. Your experiment is unchanged."
          : reason?.name === "TimeoutError"
            ? "The fonts did not finish loading. Try again; WAV and JSON are still available."
            : "The reading could not verify its fonts or license notices. Reconnect and repair the offline copy, then try again. WAV and JSON are still available.";
      controller.abort();
    } finally {
      clearTimeout(timer);
      this.controller = undefined;
      this.save.disabled = false;
      const wasCancelling = document.activeElement === this.cancel;
      this.cancel.hidden = true;
      if (wasCancelling) this.save.focus();
    }
  }
}
