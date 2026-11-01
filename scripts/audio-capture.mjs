/** Review-only taps on actual browser output; never shipped in the application. */
export const tapSource = `class Tap extends AudioWorkletProcessor {
      constructor() { super(); this.samples = new Float32Array(4096); this.position = 0; this.quantumFrames = []; this.frame = 0; }
      process(inputs) {
        const input = inputs[0]?.[0];
        this.quantumFrames.push(currentFrame);
        for (let i = 0; i < 128; i++) {
          if (this.position === 0) this.frame = currentFrame + i;
          this.samples[this.position++] = input?.[i] ?? 0;
          if (this.position === 4096) {
            this.port.postMessage({ samples: this.samples, frame: this.frame, quantumFrames: this.quantumFrames }, [this.samples.buffer]);
            this.samples = new Float32Array(4096); this.position = 0; this.quantumFrames = [];
          }
        }
        return true;
      }
    }
    registerProcessor('sammu-review-tap', Tap);`;

export async function observe(page) {
  await page.addInitScript(() => {
    window.__oscillators = [];
    window.__stops = [];
    window.__contexts = [];
    window.__worklets = new WeakMap();
    window.__buffers = 0;
    window.__bufferStops = [];
    window.__chunks = [];
    window.__take = false;
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      window.__csp.push(e.violatedDirective),
    );
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const node = create.call(this);
      window.__oscillators.push(node);
      return node;
    };
    const stop = OscillatorNode.prototype.stop;
    OscillatorNode.prototype.stop = function (time) {
      window.__stops.push({ node: window.__oscillators.indexOf(this), time });
      return stop.call(this, time);
    };
    const resume = AudioContext.prototype.resume;
    AudioContext.prototype.resume = function () {
      if (!window.__contexts.includes(this)) window.__contexts.push(this);
      const resumed = resume.call(this);
      if (!navigator.onLine) return resumed;
      if (!window.__worklets.has(this))
        window.__worklets.set(
          this,
          this.audioWorklet.addModule(new URL("live-review-tap.js", location.href)),
        );
      const result = Promise.all([resumed, window.__worklets.get(this)]);
      if (!window.__holdResume) return result;
      return result.then(
        () =>
          new Promise((resolve) => {
            window.__releaseResume = resolve;
          }),
      );
    };
    const bufferStop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.stop = function (time) {
      window.__bufferStops.push({ time: time ?? this.context.currentTime });
      return time === undefined ? bufferStop.call(this) : bufferStop.call(this, time);
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.__buffers++;
      return start.apply(this, args);
    };
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (...args) {
      const result = connect.apply(this, args);
      if (
        (this instanceof GainNode || this instanceof AudioBufferSourceNode) &&
        args[0] === this.context.destination &&
        window.__worklets.has(this.context)
      ) {
        // A review-only audio-thread tap on the actual output. Its own output
        // is silence. Messages carry render-frame indices to detect any gap.
        window.__latestTap?.disconnect();
        const recorder = new AudioWorkletNode(this.context, "sammu-review-tap");
        window.__latestTap = recorder;
        window.__captureContext = this.context;
        recorder.port.onmessage = (e) => {
          if (window.__take && window.__latestTap === recorder)
            window.__chunks.push({
              frame: e.data.frame,
              samples: Array.from(e.data.samples),
              quantumFrames: e.data.quantumFrames,
            });
        };
        connect.call(this, recorder);
        connect.call(recorder, this.context.destination);
      }
      return result;
    };
  });
}
