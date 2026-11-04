import { OFFLINE_OPERATION_MS, TRANSFER_IDLE_MS } from "./core/offline-policy";

interface EditionState {
  type?: string;
  edition?: string;
  instance?: string;
  sequence?: number;
  complete?: boolean;
  entries?: readonly string[];
  repairing?: boolean;
  failures?: readonly { path: string; reason: "missing" | "damaged" }[];
}

/** serviceWorker.ready never rejects when a first installation fails. */
function activated(registration: ServiceWorkerRegistration, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);
  if (registration.active?.state === "activated") return Promise.resolve();
  const worker = registration.installing ?? registration.waiting ?? registration.active;
  if (!worker) return Promise.reject(new Error("No installing offline edition."));
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener("statechange", check);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    const check = () => {
      if (worker.state === "activated") {
        cleanup();
        resolve();
      } else if (worker.state === "redundant") {
        cleanup();
        reject(new Error("Offline installation failed."));
      }
    };
    worker.addEventListener("statechange", check);
    signal.addEventListener("abort", abort, { once: true });
    check();
  });
}

/** A navigation can outlive activate's claim snapshot, notably in Firefox. */
function connect(registration: ServiceWorkerRegistration, signal: AbortSignal): Promise<void> {
  if (navigator.serviceWorker.controller) return Promise.resolve();
  const worker = registration.active;
  if (!worker) return Promise.reject(new Error("No active offline edition."));
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const cleanup = () => {
      clearTimeout(timer);
      channel.port1.close();
      navigator.serviceWorker.removeEventListener("controllerchange", check);
      signal.removeEventListener("abort", abort);
    };
    const check = () => {
      if (navigator.serviceWorker.controller) {
        cleanup();
        resolve();
      }
    };
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Offline worker did not connect."));
    }, 8000);
    channel.port1.onmessage = (event: MessageEvent<EditionState>) => {
      check();
      // Legacy workers answer inspection but cannot perform this handshake.
      if (!navigator.serviceWorker.controller && !event.data.entries) {
        cleanup();
        reject(new Error("Reload to connect the saved worker."));
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", check);
    signal.addEventListener("abort", abort, { once: true });
    try {
      worker.postMessage({ type: "SAMMU_INSPECT", edition: __SAMMU_EDITION__, claim: true }, [
        channel.port2,
      ]);
    } catch (error) {
      cleanup();
      reject(error);
    }

    if (signal.aborted) abort();
    else check();
  });
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
  let reloadEdition = false;
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
    const entry =
      location.pathname === import.meta.env.BASE_URL
        ? `${import.meta.env.BASE_URL}index.html`
        : location.pathname;
    reloadEdition =
      result.edition !== __SAMMU_EDITION__ &&
      result.complete === true &&
      result.entries?.includes(entry) === true;
    if (result.edition !== __SAMMU_EDITION__) {
      status.textContent = reloadEdition
        ? "A different saved edition is ready. Reload it to keep your linked experiment and use its verified files."
        : "This page and its saved edition differ. Keep a standalone reading or copy your experiment link, then reconnect and reload.";
      if (repair) {
        repair.hidden = !reloadEdition;
        repair.disabled = false;
        repair.textContent = "Reload saved edition";
      }
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
          repairing ? OFFLINE_OPERATION_MS : 8000,
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
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new Error("Offline install did not finish.")),
        OFFLINE_OPERATION_MS,
      );
      let registrationTimer: ReturnType<typeof setTimeout> | undefined;
      let registration: ServiceWorkerRegistration | undefined;
      if (repair) {
        repair.hidden = false;
        repair.disabled = true;
      }
      status.textContent = "Saving the offline edition… You can keep working.";
      try {
        registration = await Promise.race([
          navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
            updateViaCache: "none",
          }),
          new Promise<never>((_, reject) => {
            registrationTimer = setTimeout(
              () => reject(new Error("Offline worker did not arrive.")),
              TRANSFER_IDLE_MS,
            );
          }),
        ]);
        clearTimeout(registrationTimer);
        await activated(registration, controller.signal);
        await connect(registration, controller.signal);
        await inspect();
      } catch {
        if (!navigator.serviceWorker.controller) {
          reloadEdition = !!registration?.active;
          status.textContent = reloadEdition
            ? "An offline worker is active but has not connected to this page. Keep a reading or your experiment link, then reload online."
            : "Offline saving did not finish. Try saving it again online, or keep a standalone reading.";
          if (repair)
            repair.textContent = reloadEdition ? "Reload page" : "Try saving offline again";
        }
      } finally {
        clearTimeout(timer);
        clearTimeout(registrationTimer);
        controller.abort();
        if (repair) repair.disabled = busy;
      }
    })().finally(() => {
      installation = undefined;
    });
    return installation;
  }

  repair?.addEventListener("click", () => {
    if (reloadEdition) location.reload();
    else void (navigator.serviceWorker.controller ? inspect(true) : install());
  });
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
