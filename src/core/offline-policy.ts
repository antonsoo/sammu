/** A progressing transfer may be slow; a silent body must not wait indefinitely. */
export const TRANSFER_IDLE_MS = 15_000;
export const TRANSFER_TOTAL_MS = 180_000;
export const OFFLINE_OPERATION_MS = TRANSFER_TOTAL_MS + 5_000;
