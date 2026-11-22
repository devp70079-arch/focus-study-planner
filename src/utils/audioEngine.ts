/**
 * Web Audio API Sound Generator for Ambient Focus and Anti-Distraction Alerts
 * Zero external audio file dependencies - runs 100% reliably in browser.
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private currentSourceNode: AudioNode | null = null;
  private gainNode: GainNode | null = null;
  private currentTrack: string | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.5;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getCurrentTrack(): string | null {
    return this.currentTrack;
  }

  public stopAmbient() {
    if (this.currentSourceNode) {
      try {
        (this.currentSourceNode as any).stop?.();
        this.currentSourceNode.disconnect();
      } catch {
        // ignore
      }
      this.currentSourceNode = null;
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {
        // ignore
      }
      this.gainNode = null;
    }
    this.currentTrack = null;
  }

  public playAmbient(type: 'brown_noise' | 'white_noise' | 'rain' | 'binaural_40hz' | 'lofi_drone') {
    this.initContext();
    if (!this.ctx) return;

    this.stopAmbient();
    this.currentTrack = type;

    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    this.gainNode.connect(this.ctx.destination);

    switch (type) {
      case 'brown_noise':
        this.playBrownNoise();
        break;
      case 'white_noise':
        this.playWhiteNoise();
        break;
      case 'rain':
        this.playRainNoise();
        break;
      case 'binaural_40hz':
        this.playBinaural40Hz();
        break;
      case 'lofi_drone':
        this.playLofiDrone();
        break;
    }
  }

  private playBrownNoise() {
    if (!this.ctx || !this.gainNode) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // boost level
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Filter to warm it up
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(this.gainNode);
    whiteNoise.start(0);
    this.currentSourceNode = whiteNoise;
  }

  private playWhiteNoise() {
    if (!this.ctx || !this.gainNode) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.15;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.0, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(this.gainNode);
    noise.start(0);
    this.currentSourceNode = noise;
  }

  private playRainNoise() {
    if (!this.ctx || !this.gainNode) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
    const left = noiseBuffer.getChannelData(0);
    const right = noiseBuffer.getChannelData(1);

    for (let i = 0; i < bufferSize; i++) {
      left[i] = (Math.random() * 2 - 1) * 0.2;
      right[i] = (Math.random() * 2 - 1) * 0.2;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Rain high-cut & low-cut
    const lowPass = this.ctx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.setValueAtTime(1200, this.ctx.currentTime);

    const highPass = this.ctx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.setValueAtTime(200, this.ctx.currentTime);

    noise.connect(highPass);
    highPass.connect(lowPass);
    lowPass.connect(this.gainNode);
    noise.start(0);
    this.currentSourceNode = noise;
  }

  private playBinaural40Hz() {
    if (!this.ctx || !this.gainNode) return;

    // 200 Hz Carrier in Left, 240 Hz in Right -> 40 Hz Gamma difference for intense focus
    const merger = this.ctx.createChannelMerger(2);

    const oscL = this.ctx.createOscillator();
    oscL.type = 'sine';
    oscL.frequency.setValueAtTime(200, this.ctx.currentTime);

    const oscR = this.ctx.createOscillator();
    oscR.type = 'sine';
    oscR.frequency.setValueAtTime(240, this.ctx.currentTime);

    const gainL = this.ctx.createGain();
    gainL.gain.setValueAtTime(0.12, this.ctx.currentTime);
    const gainR = this.ctx.createGain();
    gainR.gain.setValueAtTime(0.12, this.ctx.currentTime);

    oscL.connect(gainL);
    gainL.connect(merger, 0, 0);

    oscR.connect(gainR);
    gainR.connect(merger, 0, 1);

    merger.connect(this.gainNode);

    oscL.start();
    oscR.start();

    this.currentSourceNode = {
      stop: () => {
        oscL.stop();
        oscR.stop();
      },
      disconnect: () => {
        merger.disconnect();
      },
    } as any;
  }

  private playLofiDrone() {
    if (!this.ctx || !this.gainNode) return;

    // Rich soothing pad chords (C Major 7 / A minor warm frequencies)
    const freqs = [130.81, 164.81, 196.00, 246.94]; // C3, E3, G3, B3
    const oscs: OscillatorNode[] = [];

    const padGain = this.ctx.createGain();
    padGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, this.ctx.currentTime);

    freqs.forEach((f, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, this.ctx.currentTime);
      osc.connect(filter);
      osc.start();
      oscs.push(osc);
    });

    filter.connect(padGain);
    padGain.connect(this.gainNode);

    this.currentSourceNode = {
      stop: () => {
        oscs.forEach((o) => {
          try {
            o.stop();
          } catch (e) {}
        });
      },
      disconnect: () => {
        filter.disconnect();
        padGain.disconnect();
      },
    } as any;
  }

  /**
   * Anti-distraction alarm beep triggered when student tries to switch tabs or open distractions
   */
  public playDistractionWarning() {
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      osc.frequency.setValueAtTime(440, now + 0.2);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  /**
   * Crisp celebratory chime upon completing a session or key task
   */
  public playVictoryChime() {
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0.2, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.6);
      });
    } catch (e) {
      console.warn('Victory chime failed', e);
    }
  }
}

export const audioEngine = new AudioEngine();
