# MIDI Drum Mapping Guide

## Overview
Your MIDI keyboard can now trigger drum samples using the **2nd octave** (C2-B2)! Play drums with your left hand while playing melodies with your right hand.

## MIDI Note Mapping

### Drum Triggers (2nd Octave: C2-B2)

| MIDI Note | Note Name | Drum Sample | Description |
|-----------|-----------|-------------|-------------|
| **36** | C2 | 🥁 **Kick** | Bass drum / Kick drum |
| **37** | C#2 | 🥁 **Snare** | Snare drum |
| **38** | D2 | 🎩 **Closed Hat** | Closed hi-hat |
| **39** | D#2 | 👏 **Clap** | Hand clap |
| **40** | E2 | 🪘 **Conga** | Conga drum |
| **41** | F2 | 🥁 **Tom** | Tom drum |
| **42** | F#2 | 🔔 **Tamb** | Tambourine |
| **43** | G2 | 🎩 **Open Hat** | Open hi-hat |
| 44-47 | G#2-B2 | _(reserved)_ | Future drum sounds |

### Melodic Notes (3rd octave and above)

| MIDI Range | Octave | Usage |
|------------|--------|-------|
| **48-84** | C3-C7 | 🎹 **Melody & Harmony** (visible on keyboard) |
| **85+** | C7+ | 🎹 **Melody** (playable but outside visual range) |

## How to Use

### 1. **Play Drums with Left Hand**
```
┌────────────────────────────────┐
│  2nd Octave (C2-B2)            │
│  [C] [C#] [D] [D#] [E] [F]...  │
│  Kick Snr Hat Clap Cng Tom...  │
└────────────────────────────────┘
```
- Press keys in the 2nd octave (C2-G2) to trigger drum samples
- Drums are **velocity-sensitive** - hit harder for louder sounds
- Drums are **one-shot samples** - no need to release the key

### 2. **Play Melodies with Right Hand**
```
┌────────────────────────────────┐
│  3rd-7th Octaves (C3-C7)       │
│  [C] [D] [E] [F] [G] [A] [B]   │
│   Regular melodic notes        │
└────────────────────────────────┘
```
- Play melodic notes as usual
- AI harmony generation continues to work
- Visual keyboard shows your notes

### 3. **Two-Handed Playing**
```
Left Hand:  Drums (C2-G2)    │  Right Hand: Melody (C3+)
────────────────────────────────────────────────────
[C2] [D2] [E2]               │  [C4] [E4] [G4]
Kick  Hat  Conga             │   C Major Chord
```

## Velocity Sensitivity

All drum samples respond to **velocity** (how hard you hit the key):

- **Soft** (velocity 0-50): Quiet, subtle hits
- **Medium** (velocity 51-100): Normal playing
- **Hard** (velocity 101-127): Loud, accented hits

## Example Patterns

### Basic Rock Beat
```
Beat:  1   +   2   +   3   +   4   +
Kick:  X       X       X       X
Snare:     X       X       X       X
Hat:   X   X   X   X   X   X   X   X

MIDI:  C2  D2  C#2 D2  C2  D2  C#2 D2
```

### Four on the Floor (EDM)
```
Beat:  1   2   3   4
Kick:  X   X   X   X
Hat:   X   X   X   X

MIDI:  C2+D2, C2+D2, C2+D2, C2+D2
(Play both keys together)
```

### Latin Groove
```
Beat:  1   +   2   +   3   +   4   +
Conga: X       X   X       X   X   X
Clap:      X       X       X
Tamb:  X   X   X   X   X   X   X   X

MIDI:  E2  F#2 D#2 F#2 E2  E2  D#2 E2
```

## Tips & Tricks

### 🎵 Performance Tips
1. **Start Simple**: Practice one drum at a time before combining
2. **Use Both Hands**: Drums on left, melody on right
3. **Feel the Beat**: Drums work best with the tempo (adjust BPM)
4. **Layer Sounds**: Combine multiple drums for richer patterns

### 🎚️ Volume Control
- Use the **Drums Gain** slider on the sequencer to adjust overall drum volume
- Individual drum sliders control each drum's relative volume
- MIDI velocity adds dynamic expression on top

### 🎹 Keyboard Layout Reference
Most MIDI keyboards label octaves. Look for:
- **C2** is typically in the lower-left area (2nd octave)
- **C3-C7** is the middle-to-upper range (melody area)
- Some keyboards start from C-1 or C0, adjust accordingly

### ⚡ Latency
- Drums are **one-shot samples** with minimal latency
- If you experience delay, check your audio interface buffer size
- Lower buffer = lower latency (but may cause crackles)

## Troubleshooting

### "Drum sample not loaded yet"
- Wait a few seconds after page load for samples to download
- Check browser console for loading errors
- Ensure you have internet connection (samples load from CDN)

### Drums not triggering
1. Make sure you're playing in the correct octave (C2-G2)
2. Check the MIDI device connection status
3. Verify the Drums Gain slider is not at zero
4. Open browser console (F12) to see MIDI messages

### Wrong drum sounds
- Double-check you're playing the correct MIDI note number
- Some keyboards have octave shift buttons - reset to default
- Consult your keyboard's manual for octave settings

## Technical Details

### Sample Format
- **Format**: MP3
- **Sample Rate**: 48kHz
- **Bit Depth**: 16-bit
- **Channels**: Mono

### MIDI Implementation
- **Channel**: Responds to all MIDI channels
- **Note Range**: 36-47 (C2-B2) for drums
- **Velocity**: Full range 0-127
- **Note Off**: Ignored for drums (one-shot)

### Audio Routing
```
MIDI Keyboard
    ↓
MIDI Note 36-47
    ↓
triggerDrumFromMIDI()
    ↓
Tone.Player (sample)
    ↓
Individual Drum Gain
    ↓
Master Drum Gain
    ↓
Audio Output
```

---

**Enjoy drumming with your MIDI keyboard!** 🥁🎹🎵

*Tip: Try the "EDM" genre preset and play drums along with the AI-generated melodies for an instant electronic music jam session!*
