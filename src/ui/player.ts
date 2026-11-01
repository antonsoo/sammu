import { renderPcm, type SoundPlan } from "../core/audio";

export class Player {
  private context: AudioContext | undefined;
  private source: AudioBufferSourceNode | undefined;
  private output: GainNode | undefined;
  private generation = 0;

  constructor(private readonly report: (message: string, playing: boolean) => void) {}

  stop(message = "Stopped."): void {
    this.generation++;
    const source = this.source;
    const output = this.output;
    if (source && output && this.context) {
      const now = this.context.currentTime;
      if (this.context.state === "running") {
        output.gain.setValueAtTime(1, now);
        output.gain.linearRampToValueAtTime(0, now + 0.02);
        source.stop(now + 0.02);
      } else {
        source.stop(now);
        source.disconnect();
        output.disconnect();
      }
    }
    this.source = undefined;
    this.output = undefined;
    this.report(message, false);
  }

  async play(plan: SoundPlan): Promise<void> {
    this.stop("Preparing audio…");
    const generation = this.generation;
    try {
      if (!this.context || this.context.state === "closed") {
        this.context = new AudioContext();
        this.context.addEventListener("statechange", () => {
          if (this.source && this.context?.state !== "running")
            this.stop("Sound was interrupted. Press Play to start again.");
        });
      }
      await this.context.resume();
      if (generation !== this.generation) return;
      const pcm = renderPcm(plan, this.context.sampleRate);
      const buffer = this.context.createBuffer(1, pcm.length, this.context.sampleRate);
      buffer.copyToChannel(new Float32Array(pcm), 0);
      const source = this.context.createBufferSource();
      const output = this.context.createGain();
      source.buffer = buffer;
      source.connect(output);
      output.connect(this.context.destination);
      source.onended = () => {
        source.disconnect();
        output.disconnect();
        if (generation === this.generation) {
          this.source = undefined;
          this.output = undefined;
          this.report(`Finished: ${plan.title.toLowerCase()}.`, false);
        }
      };
      this.source = source;
      this.output = output;
      this.report(`Playing: ${plan.title.toLowerCase()}.`, true);
      source.start();
    } catch {
      if (generation === this.generation)
        this.report("Audio could not start. Try Play again or download the WAV.", false);
    }
  }
}
