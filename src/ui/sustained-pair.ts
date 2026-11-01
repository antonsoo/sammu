import { AMPLITUDE, partials, type SustainedPlan } from "../core/audio";

export const LIVE_SECONDS = 60;
export const LIVE_TRANSITION = 0.008;
const RELEASE = 0.04;

/** A phase-continuous pair. The same twelve oscillators survive every adjustment. */
export class SustainedPair {
  private readonly output: GainNode;
  private readonly voices: { oscillator: OscillatorNode; level: GainNode }[][] = [];
  private ended = false;
  private readonly started: number;

  constructor(
    private readonly context: BaseAudioContext,
    destination: AudioNode,
    plan: SustainedPlan,
    finished: () => void,
  ) {
    this.validate(plan);
    this.output = context.createGain();
    const now = context.currentTime;
    this.started = now;
    const end = now + LIVE_SECONDS;
    this.output.gain.setValueAtTime(0, now);
    this.output.gain.linearRampToValueAtTime(1, now + 0.02);
    this.output.gain.setValueAtTime(1, end - RELEASE);
    this.output.gain.linearRampToValueAtTime(0, end);
    this.output.connect(destination);

    for (let voice = 0; voice < 2; voice++) {
      const nodes = [];
      for (const { harmonic, weight } of partials("plucked")) {
        const oscillator = context.createOscillator();
        const level = context.createGain();
        oscillator.frequency.setValueAtTime((plan.fundamentals[voice] as number) * harmonic, now);
        level.gain.setValueAtTime(this.level(plan, voice, harmonic, weight), now);
        oscillator.connect(level);
        level.connect(this.output);
        oscillator.start(now);
        oscillator.stop(end);
        nodes.push({ oscillator, level });
      }
      this.voices.push(nodes);
    }
    const final = this.voices[1]?.[5];
    if (final)
      final.oscillator.onended = () => {
        this.disconnect();
        finished();
      };
  }

  private validate(plan: SustainedPlan): void {
    if (
      plan.fundamentals.length !== 2 ||
      plan.fundamentals.some(
        (hz) => !Number.isFinite(hz) || hz <= 0 || hz * 6 >= this.context.sampleRate / 2,
      ) ||
      (plan.isolated &&
        (plan.isolated.length !== 2 ||
          plan.isolated.some((n) => !Number.isInteger(n) || n < 1 || n > 6)))
    )
      throw new RangeError("The sustained pair exceeds its frequency bounds.");
  }

  private level(plan: SustainedPlan, voice: number, harmonic: number, weight: number): number {
    // Unequal levels keep equal-frequency isolated tones audible at every phase.
    // This is a teaching signal, not an instrument or ancient loudness model.
    return (
      AMPLITUDE *
      (voice === 0 ? 1 : 0.8) *
      (plan.isolated ? (plan.isolated[voice] === harmonic ? 1 : 0) : weight)
    );
  }

  update(plan: SustainedPlan): void {
    if (this.ended) return;
    this.validate(plan);
    const now = this.context.currentTime;
    const harmonics = partials("plucked");
    for (const [voice, nodes] of this.voices.entries())
      for (const [i, node] of nodes.entries()) {
        const { harmonic, weight } = harmonics[i] as { harmonic: number; weight: number };
        // Each new target starts from the preceding automation's instantaneous
        // value. No oscillator restarts or phase resets occur when the hand moves.
        node.oscillator.frequency.setTargetAtTime(
          (plan.fundamentals[voice] as number) * harmonic,
          now,
          LIVE_TRANSITION,
        );
        node.level.gain.setTargetAtTime(
          this.level(plan, voice, harmonic, weight),
          now,
          LIVE_TRANSITION,
        );
      }
  }

  stop(): void {
    if (this.ended) return;
    this.ended = true;
    const now = this.context.currentTime;
    // The scheduled attack and end-of-minute fade are both known, so this
    // avoids depending on cancelAndHoldAtTime support across audio engines.
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setValueAtTime(
      Math.max(
        0,
        Math.min(1, (now - this.started) / 0.02, (this.started + LIVE_SECONDS - now) / RELEASE),
      ),
      now,
    );
    this.output.gain.setTargetAtTime(0, now, LIVE_TRANSITION);
    for (const nodes of this.voices)
      for (const { oscillator } of nodes) oscillator.stop(now + RELEASE);
  }

  private disconnect(): void {
    this.ended = true;
    for (const nodes of this.voices)
      for (const { oscillator, level } of nodes) {
        oscillator.disconnect();
        level.disconnect();
      }
    this.output.disconnect();
  }
}
