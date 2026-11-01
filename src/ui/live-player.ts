import type { SustainedPlan } from "../core/audio";
import { LIVE_SECONDS, SustainedPair } from "./sustained-pair";

/** Owns permission/resume races and the finite lifetime of one live pair. */
export class LivePlayer {
  private context: AudioContext | undefined;
  private pair: SustainedPair | undefined;
  private requested: SustainedPlan | undefined;
  private generation = 0;

  constructor(private readonly report: (message: string, playing: boolean) => void) {}

  get active(): boolean {
    return this.requested !== undefined;
  }

  stop(message = "Stopped."): void {
    this.generation++;
    this.requested = undefined;
    // A suspended clock must not retain a release tail that plays on resuming.
    this.pair?.stop(this.context?.state !== "running");
    this.pair = undefined;
    this.report(message, false);
  }

  update(plan: SustainedPlan): void {
    if (!this.active) return;
    // Retain changes made while resume() is pending as well as during sound.
    this.requested = plan;
    this.pair?.update(plan);
  }

  async play(plan: SustainedPlan): Promise<void> {
    this.stop();
    this.requested = plan;
    const generation = this.generation;
    this.report("Starting the sustained pair…", false);
    try {
      if (!this.context || this.context.state === "closed") {
        this.context = new AudioContext();
        this.context.addEventListener("statechange", () => {
          if (this.pair && this.context?.state !== "running")
            this.stop("Sound was interrupted. Press Listen to start again.");
        });
      }
      await this.context.resume();
      if (generation !== this.generation || !this.requested) return;
      this.pair = new SustainedPair(this.context, this.context.destination, this.requested, () => {
        if (generation !== this.generation) return;
        this.pair = undefined;
        this.requested = undefined;
        this.report("One minute ended. Press Listen to keep exploring.", false);
      });
      this.report(
        `Listening while you adjust. Sound ends after ${LIVE_SECONDS} seconds or when you stop.`,
        true,
      );
    } catch {
      if (generation === this.generation)
        this.stop("Audio could not start. Try Listen again or save the comparison WAV.");
    }
  }
}
