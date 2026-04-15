// Singleton AudioContext — created once on first use, reused for all chimes.
let audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContext()
    }
    return audioCtx
  } catch {
    return null
  }
}

// Debounce handle — prevents overlapping chimes from rapid-fire events.
let chimeTimer: ReturnType<typeof setTimeout> | null = null

/** Synthesize a soft two-tone chime. Debounced: rapid calls play only one chime. */
export function playChime() {
  if (chimeTimer !== null) return  // chime already queued or playing
  chimeTimer = setTimeout(() => { chimeTimer = null }, 1000)

  const ctx = getAudioCtx()
  if (!ctx) return

  // Resume suspended context (browser autoplay policy suspends until user gesture)
  const play = () => {
    const t = ctx.currentTime

    function tone(freq: number, startTime: number, duration: number, peakGain: number) {
      const osc = ctx!.createOscillator()
      const gain = ctx!.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, startTime)
      osc.connect(gain)
      gain.connect(ctx!.destination)
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
      osc.start(startTime)
      osc.stop(startTime + duration)
    }

    tone(880, t, 0.5, 0.25)          // A5
    tone(1174.66, t + 0.12, 0.5, 0.18)  // D6
  }

  if (ctx.state === 'suspended') {
    ctx.resume().then(play).catch(() => {})
  } else {
    play()
  }
}

/** Fire a browser notification + chime if permission is granted. */
export function sendNotification(title: string, body?: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  playChime()
  try {
    new Notification(title, { body, silent: true })
  } catch {
    // Notification API unavailable in this context
  }
}
