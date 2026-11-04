interface EditionState {
  type?: string;
  edition?: string;
  instance?: string;
  sequence?: number;
  complete?: boolean;
  repairing?: boolean;
  failures?: readonly { path: string; reason: "missing" | "damaged" }[];
}

export async function offline(status: HTMLElement): Promise<void> {
  const repair = document.getElementById("offline-repair") as HTMLButtonElement | null;
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    status.textContent = "Offline saving is available in the production build.";
    return;
  }
  let generation = 0;
  let lastWorker: ServiceWorker | null = null;
  let lastInstance = "";
  let lastSequence = -1;
  let invalidating = false;
  let busy = false;
  let requestedRepair = false;
  let installation: Promise<void> | undefined;
  const unavailable = "Offline saving could not be checked. Reconnect and repair the offline copy.";

  function show(result: EditionState, worker: ServiceWorker): void {
    if (worker !== navigator.serviceWorker.controller || result.type !== "SAMMU_EDITION") return;
    if (lastWorker !== worker || lastInstance !== result.instance) {
      lastWorker = worker;
      lastInstance = result.instance ?? "legacy";
      lastSequence = -1;
    }
    const sequence = result.sequence ?? 0;
    if (sequence < lastSequence) return;
    lastSequence = sequence;
    if (result.edition !== __SAMMU_EDITION__) {
      status.textContent =
        "This page and its saved edition differ. Save your experiment or copy its link, then reload online.";
      if (repair) repair.hidden = true;
      return;
    }
    busy = result.repairing === true;
    if (repair) {
      repair.hidden = false;
      repair.disabled = busy;
      repair.textContent = result.complete ? "Check offline copy" : "Repair offline copy";
    }
    if (busy) status.textContent = "Checking and repairing the offline copy… You can keep working.";
    else if (result.complete === true) {
      status.textContent =
        "Ready offline · workshop, practice, route comparison, diagrams, fonts and source notes verified. External papers still need a connection.";
      status.dataset.checkedAt = String(Date.now());
    } else {
      const failures = result.failures ?? [];
      const missing = failures.filter((f) => f.reason === "missing").length;
      const damaged = failures.filter((f) => f.reason === "damaged").length;
      status.textContent =
        missing + damaged
          ? `Offline copy needs repair: ${missing} missing, ${damaged} damaged. Reconnect and repair it before relying on offline reading.`
          : unavailable;
    }
  }

  async function inspect(repairing = false, invalidate = false): Promise<void> {
    const worker = navigator.serviceWorker.controller;
    if (!worker) return;
    const request = ++generation;
    if (invalidate) {
      invalidating = true;
      status.textContent = "A retained file could not be verified. Checking the offline copy…";
    }
    if (repairing) {
      requestedRepair = true;
      busy = true;
      if (repair) repair.disabled = true;
      status.textContent = "Checking and repairing the offline copy… You can keep working.";
    }
    const channel = new MessageChannel();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await new Promise<EditionState>((resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Offline inspection timed out.")),
          repairing ? 18000 : 8000,
        );
        channel.port1.onmessage = (event) => resolve(event.data);
        worker.postMessage(
          {
            type: repairing ? "SAMMU_REPAIR" : "SAMMU_INSPECT",
            edition: __SAMMU_EDITION__,
            invalidate,
          },
          [channel.port2],
        );
      });
      if (request !== generation) return;
      invalidating = false;
      requestedRepair = false;
      show(result, worker);
    } catch {
      if (request === generation) {
        busy = false;
        invalidating = false;
        requestedRepair = false;
        status.textContent = unavailable;
        if (repair) {
          repair.disabled = false;
          repair.hidden = false;
        }
      }
    } finally {
      clearTimeout(timer);
      channel.port1.close();
    }
  }

  async function install(): Promise<void> {
    if (installation) return installation;
    installation = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      if (repair) {
        repair.hidden = false;
        repair.disabled = true;
      }
      status.textContent = "Saving the offline edition… You can keep working.";
      try {
        await Promise.race([
          navigator.serviceWorker
            .register(`${import.meta.env.BASE_URL}sw.js`)
            .then(() => navigator.serviceWorker.ready),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("Offline install did not finish.")), 12000);
          }),
        ]);
        await inspect();
      } catch {
        if (!navigator.serviceWorker.controller) {
          status.textContent =
            "Offline saving did not finish. Try saving it again online, or keep a standalone reading.";
          if (repair) repair.textContent = "Try saving offline again";
        }
      } finally {
        clearTimeout(timer);
        if (repair) repair.disabled = busy;
      }
    })().finally(() => {
      installation = undefined;
    });
    return installation;
  }

  repair?.addEventListener(
    "click",
    () => void (navigator.serviceWorker.controller ? inspect(true) : install()),
  );
  navigator.serviceWorker.addEventListener("controllerchange", () => void inspect());
  navigator.serviceWorker.addEventListener("message", (event: MessageEvent<EditionState>) => {
    const worker = navigator.serviceWorker.controller;
    if (
      worker &&
      event.source === worker &&
      !(invalidating && event.data?.complete) &&
      !(requestedRepair && !event.data?.repairing)
    )
      show(event.data, worker);
  });
  window.addEventListener("sammu-asset-failure", () => void inspect(false, true));
  window.addEventListener("pageshow", () => void inspect());
  window.addEventListener(
    "online",
    () => void (navigator.serviceWorker.controller ? inspect(true) : install()),
  );
  window.addEventListener("offline", () => void inspect());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void inspect();
  });
  setInterval(() => {
    if (document.visibilityState === "visible" && !busy) void inspect();
  }, 15000);
  void inspect();
  await install();
}
