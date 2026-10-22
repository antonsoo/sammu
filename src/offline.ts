export async function offline(status: HTMLElement): Promise<void> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    status.textContent = "Offline saving is available in the production build.";
    return;
  }
  const unavailable =
    "Offline saving was unavailable. Keep this tab open or save a standalone study.";
  let generation = 0;
  async function inspect(worker: ServiceWorker | null): Promise<void> {
    if (!worker) return;
    const request = ++generation;
    const channel = new MessageChannel();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const saved = await new Promise<{
        type?: unknown;
        edition?: unknown;
        complete?: unknown;
      } | null>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), 8000);
        channel.port1.onmessage = (event) => resolve(event.data);
        worker.postMessage({ type: "SAMMU_INSPECT" }, [channel.port2]);
      });
      // A reply from a superseded worker must not replace a newer inspection.
      if (request !== generation) return;
      status.textContent =
        saved?.type === "SAMMU_EDITION" &&
        saved.edition === __SAMMU_EDITION__ &&
        saved.complete === true
          ? "Ready offline · workshop, practice, diagrams, fonts and source notes saved. External papers still need a connection."
          : "This page’s offline edition is not ready. It will be checked when the worker changes; reload online if needed.";
    } catch {
      if (request === generation) status.textContent = unavailable;
    } finally {
      clearTimeout(timer);
      channel.port1.close();
    }
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    void inspect(navigator.serviceWorker.controller);
  });
  // Registration can wait behind an unfinished install. Check an existing
  // controller now, then re-check when the complete new edition claims this page.
  void inspect(navigator.serviceWorker.controller);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const registration = await Promise.race([
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`)
        .then(() => navigator.serviceWorker.ready),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), 10000);
      }),
    ]);
    await inspect(navigator.serviceWorker.controller ?? registration.active);
  } catch {
    if (generation === 0) status.textContent = unavailable;
  } finally {
    clearTimeout(timer);
  }
}
