import { renderPcm, type SoundPlan } from "../core/audio";

export class Player {
  private context: AudioContext | undefined;
  private source: AudioBufferSourceNode | undefined;
  private generation = 0;

  constructor(private readonly report: (message: string, playing: boolean) => void) {}

  stop(message = "Stopped."): void {
    this.generation++;
    this.source?.stop();
    this.source?.disconnect();
    this.source = undefined;
    this.report(message, false);
  }

  async play(plan: SoundPlan): Promise<void> {
    this.stop("Preparing audio…");
    const generation = this.generation;
    try {
      this.context ??= new AudioContext();
      await this.context.resume();
      if (generation !== this.generation) return;
      const pcm = renderPcm(plan, this.context.sampleRate);
      const buffer = this.context.createBuffer(1, pcm.length, this.context.sampleRate);
      buffer.copyToChannel(new Float32Array(pcm), 0);
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);
      source.onended = () => {
        source.disconnect();
        if (generation === this.generation) {
          this.source = undefined;
          this.report(`Finished: ${plan.title.toLowerCase()}.`, false);
        }
      };
      this.source = source;
      this.report(`Playing: ${plan.title.toLowerCase()}.`, true);
      source.start();
    } catch {
      if (generation === this.generation)
        this.report("Audio could not start. Try Play again or download the WAV.", false);
    }
  }
}
