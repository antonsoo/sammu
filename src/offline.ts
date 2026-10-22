export async function offline(status: HTMLElement): Promise<void> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    status.textContent = "Offline saving is available in the production build.";
    return;
  }
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000)),
    ]);
    const channel = new MessageChannel();
    const response = new Promise<{ edition: string; complete: boolean }>((resolve, reject) => {
      const timer = setTimeout(() => {
        channel.port1.close();
        reject(new Error("timeout"));
      }, 8000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        channel.port1.close();
        resolve(event.data);
      };
    });
    registration.active?.postMessage({ type: "SAMMU_INSPECT" }, [channel.port2]);
    const saved = await response;
    status.textContent =
      saved.edition === __SAMMU_EDITION__ && saved.complete
        ? "Ready offline · workshop, diagrams, fonts and source notes saved. External papers still need a connection."
        : "Offline edition is updating. Reload online to finish.";
  } catch {
    status.textContent =
      "Offline saving was unavailable. Keep this tab open or save a standalone study.";
  }
}
