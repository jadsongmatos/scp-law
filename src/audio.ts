export class SoundEngine {
  ctx: AudioContext | null = null;
  ambientGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  voiceGain: GainNode | null = null;
  masterGain: GainNode | null = null;

  rainAudio: HTMLAudioElement | null = null;
  rainSource: MediaElementAudioSourceNode | null = null;
  jazzInterval: ReturnType<typeof setInterval> | null = null;

  volumes = {
    master: 1.0,
    ambient: 0.6,
    sfx: 0.4,
    voice: 0.8
  };

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (!this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volumes.master;
      this.masterGain.connect(this.ctx.destination);
    }

    if (!this.ambientGain) {
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = this.volumes.ambient;
      this.ambientGain.connect(this.masterGain);
    }

    if (!this.sfxGain) {
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.volumes.sfx;
      this.sfxGain.connect(this.masterGain);
    }

    if (!this.voiceGain) {
      this.voiceGain = this.ctx.createGain();
      this.voiceGain.gain.value = this.volumes.voice;
      this.voiceGain.connect(this.masterGain);
    }
  }

  setVolume(category: keyof typeof SoundEngine.prototype.volumes, value: number) {
    this.volumes[category] = value;
    if (!this.ctx) return;

    switch (category) {
      case 'master':
        if (this.masterGain) this.masterGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.1);
        break;
      case 'ambient':
        if (this.ambientGain) this.ambientGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.1);
        break;
      case 'sfx':
        if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.1);
        break;
      case 'voice':
        if (this.voiceGain) this.voiceGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.1);
        if (this.currentSpeech) this.currentSpeech.volume = value;
        break;
    }
  }

  startAmbient() {
    if (!this.ctx || !this.ambientGain) return;
    if (this.rainAudio) return;

    this.rainAudio = new window.Audio('/rainstorm.mp3');
    this.rainAudio.loop = true;

    this.rainSource = this.ctx.createMediaElementSource(this.rainAudio);
    this.rainSource.connect(this.ambientGain);

    this.rainAudio.play().catch(e => console.warn('Rain audio autoplay blocked:', e));

    this.startJazzAmbient();
  }

  startJazzAmbient() {
    this.jazzInterval = setInterval(() => {
      if (Math.random() < 0.15) {
        this.playJazzChord();
      }
    }, 8000);
  }

  playTone(freq: number, type: OscillatorType, duration: number, vol = 0.1) {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playNoise(duration: number, vol = 0.1) {
    if (!this.ctx || !this.sfxGain) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start();
  }

  playJazzChord() {
    if (!this.ctx) return;
    const notes = [220, 261.63, 329.63, 392, 440];
    const chord = notes.sort(() => Math.random() - 0.5).slice(0, 3);
    chord.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 1.5, 0.015), i * 50);
    });
  }

  playHover() {
    this.playTone(440, 'sine', 0.06, 0.015);
  }

  playPickup() {
    if (!this.ctx) return;
    this.playTone(523, 'sine', 0.1, 0.04);
    setTimeout(() => this.playTone(659, 'sine', 0.15, 0.04), 80);
    setTimeout(() => this.playTone(784, 'triangle', 0.3, 0.03), 160);
  }

  playDoor() {
    if (!this.ctx) return;
    this.playNoise(0.4, 0.15);
    this.playTone(80, 'square', 0.3, 0.04);
    setTimeout(() => this.playTone(50, 'sawtooth', 0.3, 0.02), 150);
  }

  playTerminal() {
    if (!this.ctx) return;
    let time = 0;
    for (let i = 0; i < 5; i++) {
      const offset = time;
      setTimeout(() => this.playTone(800 + Math.random() * 600, 'square', 0.04, 0.015), offset);
      time += 35 + Math.random() * 50;
    }
  }

  playDenied() {
    if (!this.ctx) return;
    this.playTone(150, 'sawtooth', 0.15, 0.04);
    setTimeout(() => this.playTone(100, 'sawtooth', 0.25, 0.04), 200);
  }

  playTypewriter() {
    this.playTone(800 + Math.random() * 400, 'square', 0.02, 0.01);
  }

  currentSpeech: HTMLAudioElement | null = null;

  speak(id: string) {
    this.stopSpeak();
    const audio = new window.Audio(`/voice/${id}.mp3`);
    audio.volume = this.volumes.voice;
    audio.play().catch(e => console.warn('Could not play voice audio:', e));
    this.currentSpeech = audio;
  }

  stopSpeak() {
    if (this.currentSpeech) {
      this.currentSpeech.pause();
      this.currentSpeech.currentTime = 0;
      this.currentSpeech = null;
    }
  }
}

export const Audio = new SoundEngine();
