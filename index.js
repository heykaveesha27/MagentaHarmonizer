var slider = document.getElementById("tempo");
  var selector = document.getElementById("selecting");

  slider.oninput = function(){
    selector.style.left = this.value + "%";
  }

  function calculateDegree(e){
  const x1 = window.innerWidth/2;
  const y1 = window.innerHeight/2;
  const x2 = e.clientX;
  const y2 = e.clientY;

  const deltaX = x1-x2;
  const deltaY=y1-y2;

  const rad = Math.atan2(deltaY,deltaX);
  let deg = rad*(180/Math.PI);

  return deg;
}

const MIN_NOTE = 48;
const MAX_NOTE = 84;

// Using the Improv RNN pretrained model from https://github.com/tensorflow/magenta/tree/master/magenta/models/improv_rnn
// Prefer ImprovRNN if available in this Magenta build, otherwise fall back
// to MusicRNN. Both accept the same checkpoint URL for the improv model.
let rnn;
const IMPROV_CHECKPOINT =
  'https://storage.googleapis.com/download.magenta.tensorflow.org/tfjs_checkpoints/music_rnn/chord_pitches_improv';
if (typeof mm !== 'undefined' && typeof mm.ImprovRNN !== 'undefined') {
  rnn = new mm.ImprovRNN(IMPROV_CHECKPOINT);
} else {
  rnn = new mm.MusicRNN(IMPROV_CHECKPOINT);
}
let temperature = 1.1;
// Harmony probability: chance to add harmony to a machine note (0..1)
let harmonyProbability = 0.3;



const melodyGain = new Tone.Gain(0.7).toDestination();
//const reverb = new Tone.Convolver('https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/hm2_000_ortf_48k.mp3').toMaster();

const reverb = new Tone.Convolver('https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/hm2_000_ortf_48k.mp3').connect(melodyGain);

// Some Tone.js builds may not expose a `wet` AudioParam on the Convolver.
// Guard the assignment to avoid a runtime TypeError in those cases.
if (reverb && reverb.wet && typeof reverb.wet.value !== 'undefined') {
  try {
    reverb.wet.value =0.1;
  } catch (e) {
    // ignore; non-critical
  }
}

let sampler = new Tone.Sampler({
  C3: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-c3.mp3',
  'D#3': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-ds3.mp3',
  'F#3': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-fs3.mp3',
  A3: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-a3.mp3',
  C4: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-c4.mp3',
  'D#4': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-ds4.mp3',
  'F#4': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-fs4.mp3',
  A4: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-a4.mp3',
  C5: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-c5.mp3',
  'D#5': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-ds5.mp3',
  'F#5': 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-fs5.mp3',
  A5: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/969699/plastic-marimba-a5.mp3'
}, {
  onload: () => {
    console.log('Sampler loaded successfully');
  },
  onerror: (error) => {
    console.warn('Error loading sampler samples:', error);
  }
}).connect(reverb);

// Set envelope parameters safely
try {
  sampler.release.value = 1;
  sampler.attack.value = 0.001;
} catch (e) {
  console.warn('Could not set sampler envelope parameters:', e);
}


const melodyGainSlider = document.getElementById('melody');

if(melodyGainSlider){
  melodyGainSlider.addEventListener('input',(e)=>{
    melodyGain.gain.rampTo(parseFloat(e.target.value),0.05);
  })
}

// Use AudioKeys if available, otherwise provide a small fallback shim that
// exposes the same `down`/`up` registration API used by the app.
let builtInKeyboard;
if (typeof AudioKeys !== 'undefined') {
  builtInKeyboard = new AudioKeys({ rows: 2 });
} else {
  builtInKeyboard = (function () {
    const downListeners = [];
    const upListeners = [];

    // Simple QWERTY -> MIDI mapping starting at C4 (60).
    const map = {
      // row 1
      'z': 48, 's': 49, 'x': 50, 'd': 51, 'c': 52, 'v': 53, 'g': 54, 'b': 55, 'h': 56, 'n': 57, 'j': 58, 'm': 59,
      // row 2 (middle row near home keys)
      'q': 60, '2': 61, 'w': 62, '3': 63, 'e': 64, 'r': 65, '5': 66, 't': 67, '6': 68, 'y': 69, '7': 70, 'u': 71,
      'i': 72, '9': 73, 'o': 74, '0': 75, 'p': 76
    };

    const active = new Set();

    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      const note = map[key];
      if (!note) return;
      if (active.has(key)) return; // ignore key repeat
      active.add(key);
      const event = { note: note };
      for (const cb of downListeners) cb(event);
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      const note = map[key];
      if (!note) return;
      active.delete(key);
      const event = { note: note };
      for (const cb of upListeners) cb(event);
    });

    return {
      down(cb) {
        downListeners.push(cb);
      },
      up(cb) {
        upListeners.push(cb);
      }
    };
  })();
}
let onScreenKeyboardContainer = document.querySelector('.keyboard');
let onScreenKeyboard = buildKeyboard(onScreenKeyboardContainer);
let machinePlayer = buildKeyboard(
  document.querySelector('.machine-bg .player')
);
let humanPlayer = buildKeyboard(document.querySelector('.human-bg .player'));

let currentSeed = [];
let stopCurrentSequenceGenerator;
// Track the current chord name detected from the seed (e.g. 'CM')
let currentChordName = 'CM';
// Track the current scale pitch-classes (0-11). Default to C major.
let currentScalePCs = [0,2,4,5,7,9,11];

let synthGain = new Tone.Gain(0.4).toDestination();
let synthFilter = new Tone.Filter(300, 'lowpass').connect(synthGain);



const synthSlider = document.getElementById('synthvol');
if(synthSlider){
  synthSlider.addEventListener('input',(e)=>{
    synthGain.gain.rampTo(parseFloat(e.target.value),0.05);
  })
  synthGain.gain.value = parseFloat(synthSlider.value);
}


let synthConfig = {
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 2, sustain: 1, release: 0.25 }
};

let synthsPlaying = {};

// Tempo (BPM) default
let tempoBPM = 120;
// Instrument/tone mode: 'string'|'piano'|'guitar'
let toneMode = 'string';

// Current play note duration notation (set per-generation)
let currentPlayNoteDuration = '8n';

// Instruments: removed tone selector instruments — use the `sampler` as the
// single playback source for both human and machine notes.

function isAccidental(note) {
  let pc = note % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

function buildKeyboard(container) {
  let nAccidentals = _.range(MIN_NOTE, MAX_NOTE + 1).filter(isAccidental)
    .length;
  let keyWidthPercent = 100 / (MAX_NOTE - MIN_NOTE - nAccidentals + 1);
  let keyInnerWidthPercent =
    100 / (MAX_NOTE - MIN_NOTE - nAccidentals + 1) - 0.5;
  let gapPercent = keyWidthPercent - keyInnerWidthPercent;
  let accumulatedWidth = 0;
  return _.range(MIN_NOTE, MAX_NOTE + 1).map(note => {
    let accidental = isAccidental(note);
    let key = document.createElement('div');
    key.classList.add('key');
    if (accidental) {
      key.classList.add('accidental');
      key.style.left = `${accumulatedWidth -
        gapPercent -
        (keyWidthPercent / 2 - gapPercent) / 2}%`;
      key.style.width = `${keyWidthPercent / 2}%`;
    } else {
      key.style.left = `${accumulatedWidth}%`;
      key.style.width = `${keyInnerWidthPercent}%`;
    }
    container.appendChild(key);
    if (!accidental) accumulatedWidth += keyWidthPercent;
    return key;
  });
}

function getSeedIntervals(seed) {
  let intervals = [];
  try {
    for (let i = 0; i < seed.length - 1; i++) {
      let rawInterval = seed[i + 1].time - seed[i].time;
      // Clamp interval to reasonable range (0.05s to 2s)
      rawInterval = Math.max(0.05, Math.min(2, rawInterval));
      
      let measure = _.minBy(['8n', '4n'], subdiv => {
        try {
          return Math.abs(rawInterval - Tone.Time(subdiv).toSeconds());
        } catch (e) {
          return Infinity;
        }
      });
      
      try {
        intervals.push(Tone.Time(measure).toSeconds());
      } catch (e) {
        intervals.push(0.25); // fallback to quarter second
      }
    }
  } catch (e) {
    console.warn('Error calculating seed intervals:', e);
  }
  return intervals.length > 0 ? intervals : [0.25];
}

function getSequenceLaunchWaitTime(seed) {
  if (seed.length <= 1) {
    return 0.5; // Reduced from 1 second for faster response
  }
  try {
    let intervals = getSeedIntervals(seed);
    let maxInterval = _.max(intervals);
    // Clamp wait time to reasonable range (0.25s to 2s)
    return Math.max(0.25, Math.min(2, maxInterval * 2));
  } catch (e) {
    console.warn('Error calculating launch wait time:', e);
    return 0.5;
  }
}

function getSequencePlayIntervalTime(seed) {
  try {
    if (seed.length <= 1) {
      return Tone.Time('8n').toSeconds();
    }
    let intervals = getSeedIntervals(seed).sort();
    let minInterval = _.first(intervals);
    // Ensure minimum interval for high tempos (at least 0.05s)
    return Math.max(0.05, minInterval);
  } catch (e) {
    console.warn('Error calculating play interval time:', e);
    // Fallback based on current tempo
    return Math.max(0.05, 60 / (tempoBPM * 2)); // eighth note at current tempo
  }
}

// Return a musical subdivision (like '8n' or '4n') for playback based on seed
function getSequencePlayIntervalNotation(seed) {
  try {
    if (seed.length <= 1) return '8n';
    let rawIntervals = [];
    for (let i = 0; i < seed.length - 1; i++) {
      let interval = seed[i + 1].time - seed[i].time;
      // Clamp to reasonable range
      interval = Math.max(0.05, Math.min(2, interval));
      rawIntervals.push(interval);
    }
    
    if (rawIntervals.length === 0) return '8n';
    
    // pick the smallest interval and map to nearest subdivision
    const minInterval = Math.min(...rawIntervals);
    const choices = ['16n', '8n', '4n', '2n'];
    let best = '8n';
    let bestDelta = Infinity;
    
    for (const c of choices) {
      try {
        const secs = Tone.Time(c).toSeconds();
        const delta = Math.abs(minInterval - secs);
        if (delta < bestDelta) {
          bestDelta = delta;
          best = c;
        }
      } catch (e) {
        // Skip this choice if Tone.Time fails
        continue;
      }
    }
    return best;
  } catch (e) {
    console.warn('Error determining play interval notation:', e);
    return '8n'; // safe fallback
  }
}

function detectChord(notes) {
  if (typeof Tonal === 'undefined') {
    // Tonal.js not available — return a safe default chord so the app continues.
    return ['CM'];
  }
  notes = notes.map(n => Tonal.Note.pc(Tonal.Note.fromMidi(n.note))).sort();
  return Tonal.PcSet.modes(notes)
    .map((mode, i) => {
      const tonic = Tonal.Note.name(notes[i]);
      const names = Tonal.Dictionary.chord.names(mode);
      return names.length ? tonic + names[0] : null;
    })
    .filter(x => x);
}

function buildNoteSequence(seed) {
  return mm.sequences.quantizeNoteSequence(
    {
      ticksPerQuarter: 220,
      totalTime: seed.length * 0.5,
      quantizationInfo: {
        stepsPerQuarter: 1
      },
      timeSignatures: [
        {
          time: 0,
          numerator: 4,
          denominator: 4
        }
      ],
      tempos: [
        {
          time: 0,
          qpm: 120
        }
      ],
      notes: seed.map((n, idx) => ({
        pitch: n.note,
        startTime: idx * 0.5,
        endTime: (idx + 1) * 0.5
      }))
    },
    1
  );
}

function startSequenceGenerator(seed) {
  let running = true,
    lastGenerationTask = Promise.resolve();

  // Find this section in startSequenceGenerator (around line 530)

// ...existing code...

let chords = detectChord(seed);
let chord = _.first(chords) || 'CM';
currentChordName = chord;

// === USE GENRE SCALE MODE IF SPECIFIED ===
const gc = window.genreConfig || {};
const genre = currentGenre || 'none';

if (gc.scaleMode && SCALE_MODES[gc.scaleMode]) {
  // Genre has a specific scale mode - use it!
  const tonicPC = getTonicFromChord(chord);
  currentScalePCs = getScaleForMode(gc.scaleMode, tonicPC);
  console.log(`🎵 Using ${gc.scaleMode} scale for ${genre} genre:`, currentScalePCs);
} else {
  // Auto-detect scale from seed (original behavior)
  try {
    currentScalePCs = detectScale(seed) || currentScalePCs;
    console.log('🎵 Auto-detected scale from seed:', currentScalePCs);
  } catch (e) {
    console.warn('Scale detection failed, using default');
  }
}

let seedSeq = buildNoteSequence(seed);
// ...rest of existing code...
  let generatedSequence = Math.random() < 0.7 ? _.clone(seedSeq.notes.map(n => n.pitch)) : [];
  // snap any seeded/generated pitches to the detected scale so output follows it
  if (generatedSequence && generatedSequence.length) {
    generatedSequence = generatedSequence.map(p => snapToScalePitch(p, currentScalePCs));
  }
  let launchWaitTime = getSequenceLaunchWaitTime(seed);
  // Use musical notation for playback so tempo changes affect playback
  let playIntervalNotation = getSequencePlayIntervalNotation(seed);
  let playIntervalTime;
  try {
    playIntervalTime = Tone.Time(playIntervalNotation).toSeconds();
    // Ensure minimum interval for high tempos
    playIntervalTime = Math.max(0.05, playIntervalTime);
  } catch (e) {
    console.warn('Error calculating play interval time, using fallback:', e);
    playIntervalTime = 0.25; // quarter second fallback
  }
  // set the current play duration notation so machineKeyDown knows note lengths
  currentPlayNoteDuration = playIntervalNotation;
  let generationIntervalTime = Math.max(0.1, playIntervalTime / 2);

function generateNext() {
  if (!running) return;
  
  if (generatedSequence.length < 16) {
    
    // === ARPEGGIO MODE ===
    if (generationMode === 'arpeggio') {
      // Generate arpeggio based on current chord
      const rootNote = seed[0]?.note || 60;
      const pattern = selectArpeggioPattern(genre, Math.floor(generatedSequence.length / 8));
      
      let arpeggio = generateArpeggio(chord, rootNote, pattern, 32);
      
      // Apply musical intelligence
      arpeggio = varyArpeggioRhythm(arpeggio, genre);
      arpeggio = addArpeggioOctaveVariation(arpeggio);
      arpeggio = createArpeggioSections(arpeggio, chord, rootNote);
      
      // Snap to scale
      arpeggio = arpeggio.map(n => n > 0 ? snapToScalePitch(n, currentScalePCs) : n);
      
      generatedSequence = generatedSequence.concat(arpeggio);
      
      console.log(`🎹 Generated ${arpeggio.length} arpeggio notes (${pattern} pattern)`);
      
      const timeoutMs = Math.max(50, generationIntervalTime * 1000); // Faster for arpeggios
      setTimeout(generateNext, timeoutMs);
    }
    // === MELODY MODE (RNN AI) ===
    else {
      lastGenerationTask = rnn
        .continueSequence(seedSeq, 32, temperature, [chord])
        .then(genSeq => {
          let mapped = genSeq.notes.map(n => snapToScalePitch(n.pitch, currentScalePCs));
          
          // Apply musical intelligence
          const maxLeap = gc.maxLeap || 7;
          mapped = smoothMelody(mapped, maxLeap);
          mapped = applyRhythmicPattern(mapped, genre);
          
          const phraseLength = PHRASE_LENGTHS.medium;
          mapped = applyPhrasing(mapped, phraseLength);
          mapped = emphasizeChordTones(mapped, chord);
          
          if (mapped.length >= 16) {
            mapped = applyCallAndResponse(mapped, 8);
          }
          
          mapped = smoothMelody(mapped, maxLeap);
          
          generatedSequence = generatedSequence.concat(mapped);
          
          console.log(`🎵 Generated ${mapped.length} melody notes`);
          
          const timeoutMs = Math.max(100, generationIntervalTime * 1000);
          setTimeout(generateNext, timeoutMs);
        })
        .catch(err => {
          console.warn('Error generating sequence:', err);
          setTimeout(generateNext, 1000);
        });
    }
  } else {
    const timeoutMs = Math.max(100, generationIntervalTime * 1000);
    setTimeout(generateNext, timeoutMs);
  }
}

  function consumeNext(time) {
    if (generatedSequence.length) {
      let note = generatedSequence.shift();
      if (note > 0) {
        machineKeyDown(note, time);
      }
    }
  }

  setTimeout(generateNext, launchWaitTime * 1000);
  let consumerId = Tone.Transport.scheduleRepeat(
    consumeNext,
    playIntervalNotation,
    Tone.Transport.seconds + launchWaitTime
  );

  return () => {
    running = false;
    Tone.Transport.clear(consumerId);
  };
}

// Given a chord name and a reference midi note, return up to `count` harmony
// midi pitches from the chord that are near the reference note but not equal.
function getChordHarmonyPitches(chordName, referenceMidi, count = 2) {
  const out = [];
  // Helper: get pitch class (0-11) for a named note like 'C' or 'D#'
  function pitchClassOf(noteName) {
    if (typeof Tonal !== 'undefined') {
      try {
        const m = Tonal.Note.midi(noteName + '4');
        return m % 12;
      } catch (e) {
        // fallback
      }
    }
    // basic map fallback
    const map = { C:0, 'C#':1, DB:1, D:2, 'D#':3, EB:3, E:4, F:5, 'F#':6, GB:6, G:7, 'G#':8, AB:8, A:9, 'A#':10, BB:10, B:11 };
    const key = noteName.toUpperCase().replace(/[^A-G#b]/g,'');
    return map[key] || 0;
  }

  // Get chord tone names using Tonal if possible, otherwise do simple parsing
  let chordTones = [];
  if (typeof Tonal !== 'undefined') {
    try {
      const info = Tonal.Chord.get(chordName);
      chordTones = info.notes.length ? info.notes : [chordName[0]];
    } catch (e) {
      chordTones = [chordName[0]];
    }
  } else {
    // fallback: parse like 'CM' -> tonic C major triad using a small lookup
    const tonic = (chordName && chordName[0]) ? chordName[0].toUpperCase() : 'C';
    const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const tonicIndex = NOTES.indexOf(tonic) >= 0 ? NOTES.indexOf(tonic) : 0;
    if ((chordName || '').toUpperCase().indexOf('M') >= 0) {
      // major triad: 0, +4, +7 semitones
      const third = NOTES[(tonicIndex + 4) % 12];
      const fifth = NOTES[(tonicIndex + 7) % 12];
      chordTones = [tonic, third, fifth];
    } else {
      chordTones = [tonic];
    }
  }

  // Build candidate pitches near reference for each chord tone (include +-octaves)
  const candidates = [];
  const refPc = referenceMidi % 12;
  const scalePCs = Array.isArray(currentScalePCs) && currentScalePCs.length ? currentScalePCs : [0,2,4,5,7,9,11];

  const pcs = chordTones.map(n => pitchClassOf(n));
  for (const pc of pcs) {
    // start with the candidate nearest the reference
    let base = referenceMidi - ((referenceMidi - pc + 120) % 12);
    // consider base and +-12 to allow octave choices
    const tries = [base - 12, base, base + 12];
    for (let candidate of tries) {
      // bring candidate into allowed range
      while (candidate < MIN_NOTE) candidate += 12;
      while (candidate > MAX_NOTE) candidate -= 12;
      if (candidate === referenceMidi) continue;
      if (!candidates.includes(candidate)) candidates.push(candidate);
    }
  }

  // Score candidates: prefer small intervals, prefer 3rds/5ths/octaves, prefer diatonic
  function scoreCandidate(cand) {
    const interval = Math.abs(cand - referenceMidi);
    let score = interval; // lower is better
    const pc = cand % 12;
    // penalize seconds (minor/major 2nd -> 1 or 11 semitones)
    if (interval % 12 === 1 || interval % 12 === 11) score += 8;
    // small bonus for thirds (3 or 4 semitones)
    if (interval % 12 === 3 || interval % 12 === 4) score -= 1;
    // bonus for perfect fifth
    if (interval % 12 === 7) score -= 1;
    // bonus for octave
    if (interval % 12 === 0) score -= 1.5;
    // prefer diatonic tones
    if (scalePCs.includes(pc)) score -= 0.5;
    return score;
  }

  candidates.sort((a,b) => scoreCandidate(a) - scoreCandidate(b));

  for (const c of candidates) {
    if (out.length >= count) break;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

// Detect the scale from a seed (array of {note, time}).
// Returns array of pitch classes (0-11) representing the scale.
function detectScale(seed) {
  if (!seed || seed.length === 0) return currentScalePCs;
  // Use Tonal if available
  if (typeof Tonal !== 'undefined' && Tonal.Scale && Tonal.Scale.detect) {
    try {
      const noteNames = seed.map(n => Tonal.Note.fromMidi(n.note));
      const detected = Tonal.Scale.detect(noteNames);
      if (detected && detected.length) {
        // take first detection like 'C major' or 'A minor'
        const scaleInfo = Tonal.Scale.get(detected[0]);
        if (scaleInfo && scaleInfo.notes && scaleInfo.notes.length) {
          return scaleInfo.notes.map(nn => {
            try { return Tonal.Note.midi(nn + '4') % 12; } catch (e) { return Tonal.Note.pc(nn); }
          }).map(pc => (typeof pc === 'string' ? Tonal.Note.pc(pc) : pc)).map(x => (typeof x === 'number' ? x : 0));
        }
      }
    } catch (e) {
      // fall through to heuristic
    }
  }

  // Heuristic fallback: find most common pitch class as tonic
  const pcs = seed.map(s => s.note % 12);
  const counts = {};
  pcs.forEach(p => (counts[p] = (counts[p] || 0) + 1));
  let tonic = Object.keys(counts).sort((a,b) => counts[b]-counts[a])[0];
  tonic = parseInt(tonic, 10);
  // decide major vs minor by presence of 3rd
  const hasMajor3 = pcs.includes((tonic + 4) % 12);
  const hasMinor3 = pcs.includes((tonic + 3) % 12);
  const isMajor = hasMajor3 || (!hasMinor3 && !hasMajor3);
  const MAJOR = [0,2,4,5,7,9,11];
  const NATURAL_MINOR = [0,2,3,5,7,8,10];
  const chosen = isMajor ? MAJOR : NATURAL_MINOR;
  return chosen.map(i => (tonic + i) % 12);
}

// Add after detectScale function (around line 657)

// Scale mode definitions (pitch classes 0-11)
const SCALE_MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],           // Ionian
  minor: [0, 2, 3, 5, 7, 8, 10],           // Natural minor
  dorian: [0, 2, 3, 5, 7, 9, 10],          // Dorian (jazz)
  phrygian: [0, 1, 3, 5, 7, 8, 10],        // Phrygian
  lydian: [0, 2, 4, 6, 7, 9, 11],          // Lydian
  mixolydian: [0, 2, 4, 5, 7, 9, 10],      // Mixolydian
  locrian: [0, 1, 3, 5, 6, 8, 10],         // Locrian
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],  // Harmonic minor
  melodic_minor: [0, 2, 3, 5, 7, 9, 11],   // Melodic minor
  pentatonic: [0, 2, 4, 7, 9],             // Major pentatonic
  minor_pentatonic: [0, 3, 5, 7, 10],      // Minor pentatonic
  blues: [0, 3, 5, 6, 7, 10],              // Blues scale
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

  // ============================================================================
// ARPEGGIO PATTERN GENERATOR
// ============================================================================

// Current generation mode
let generationMode = 'melody';

// Arpeggio patterns (indices into chord tone array)
const ARPEGGIO_PATTERNS = {
  ascending: [0, 1, 2, 3],           // Bottom to top (C E G C)
  descending: [3, 2, 1, 0],          // Top to bottom (C G E C)
  alternating: [0, 2, 1, 3, 2, 0],   // Up and down (C G E C E C)
  octave: [0, 1, 2, 3, 4],           // Include octave jump
  ripple: [0, 2, 0, 3, 0, 2],        // Rippling (C G C C G C)
  broken: [0, 2, 1, 3, 1, 2],        // Broken chord (C G E C E G)
  alberti: [0, 2, 1, 2],             // Alberti bass (C G E G)
  waltz: [0, 1, 2, 1, 2, 1],         // Waltz pattern (C E G E G E)
  cascade: [0, 1, 2, 3, 2, 1],       // Cascading (C E G C G E)
  bounce: [0, 3, 1, 3, 2, 3]         // Bouncing off top note
};

// Genre-specific arpeggio pattern preferences
const GENRE_ARPEGGIO_PATTERNS = {
  pop: ['ascending', 'alternating', 'broken'],
  classical: ['alberti', 'waltz', 'ascending', 'descending'],
  jazz: ['broken', 'alternating', 'ripple'],
  edm: ['ascending', 'octave', 'cascade'],
  lofi: ['ascending', 'alternating', 'alberti'],
  ambient: ['ascending', 'descending', 'ripple'],
  arpeggio: ['ascending', 'alternating', 'broken', 'cascade'], // Default for arpeggio genre
  none: ['ascending', 'alternating']
};

// Generate arpeggio from chord
function generateArpeggio(chordName, rootNote, patternName = 'ascending', length = 16) {
  const result = [];
  
  // Get chord tones
  let chordTones = getChordHarmonyPitches(chordName, rootNote, 3);
  
  // Add root if missing
  if (!chordTones.includes(rootNote)) {
    chordTones.unshift(rootNote);
  }
  
  // Sort ascending
  chordTones.sort((a, b) => a - b);
  
  // Ensure at least 3 tones (build triad if needed)
  if (chordTones.length < 3) {
    chordTones = [
      rootNote,
      snapToScalePitch(rootNote + 4, currentScalePCs), // third
      snapToScalePitch(rootNote + 7, currentScalePCs)  // fifth
    ];
  }
  
  // Add octave for richer patterns
  const octaveNote = chordTones[0] + 12;
  if (octaveNote <= MAX_NOTE && !chordTones.includes(octaveNote)) {
    chordTones.push(octaveNote);
  }
  
  // Get pattern
  const pattern = ARPEGGIO_PATTERNS[patternName] || ARPEGGIO_PATTERNS.ascending;
  
  // Generate arpeggio
  for (let i = 0; i < length; i++) {
    const patternIndex = pattern[i % pattern.length];
    const noteIndex = Math.min(patternIndex, chordTones.length - 1);
    let note = chordTones[noteIndex];
    
    // Keep in range
    note = Math.max(MIN_NOTE, Math.min(MAX_NOTE, note));
    
    result.push(note);
  }
  
  return result;
}

// Select arpeggio pattern intelligently
function selectArpeggioPattern(genre, phrasePosition = 0) {
  const patterns = GENRE_ARPEGGIO_PATTERNS[genre] || GENRE_ARPEGGIO_PATTERNS.none;
  
  // Vary pattern based on phrase position for interest
  const patternIndex = phrasePosition % patterns.length;
  return patterns[patternIndex];
}

// Add rhythmic variation to arpeggio
function varyArpeggioRhythm(arpeggio, genre) {
  if (!arpeggio || arpeggio.length === 0) return arpeggio;
  
  const result = [];
  const restProb = genre === 'jazz' ? 0.2 : genre === 'edm' ? 0.1 : 0.05;
  
  for (let i = 0; i < arpeggio.length; i++) {
    const note = arpeggio[i];
    
    // Sometimes add rests for rhythmic interest
    if (i > 0 && i % 8 === 0 && Math.random() < restProb) {
      result.push(-1); // Rest
    }
    
    result.push(note);
  }
  
  return result;
}

// Add octave jumps for variety
function addArpeggioOctaveVariation(arpeggio) {
  if (!arpeggio || arpeggio.length < 8) return arpeggio;
  
  const result = [];
  
  for (let i = 0; i < arpeggio.length; i++) {
    let note = arpeggio[i];
    
    if (note < 0) {
      result.push(note); // Keep rests
      continue;
    }
    
    // Every 8th note, potentially jump octave
    if (i > 0 && i % 8 === 0 && Math.random() < 0.3) {
      const direction = Math.random() < 0.5 ? 12 : -12;
      let newNote = note + direction;
      
      // Ensure in range
      if (newNote >= MIN_NOTE && newNote <= MAX_NOTE) {
        note = newNote;
      }
    }
    
    result.push(note);
  }
  
  return result;
}

// Create contrasting arpeggio sections
function createArpeggioSections(arpeggio, chordName, rootNote) {
  if (!arpeggio || arpeggio.length < 16) return arpeggio;
  
  const sectionLength = 8;
  const result = [];
  let phraseCount = 0;
  
  for (let i = 0; i < arpeggio.length; i += sectionLength) {
    // Select different pattern for each section
    const pattern = selectArpeggioPattern(currentGenre, phraseCount);
    const section = generateArpeggio(chordName, rootNote, pattern, sectionLength);
    
    result.push(...section);
    phraseCount++;
  }
  
  return result.slice(0, arpeggio.length); // Match original length
}

// Get scale pitch classes for a given mode and tonic
function getScaleForMode(mode, tonic = 0) {
  const scale = SCALE_MODES[mode] || SCALE_MODES.major;
  return scale.map(interval => (tonic + interval) % 12);
}

// Extract tonic pitch class from chord name
function getTonicFromChord(chordName) {
  if (!chordName || chordName.length === 0) return 0;
  
  const noteMap = {
    'C': 0, 'C#': 1, 'DB': 1, 'D': 2, 'D#': 3, 'EB': 3,
    'E': 4, 'F': 5, 'F#': 6, 'GB': 6, 'G': 7, 'G#': 8,
    'AB': 8, 'A': 9, 'A#': 10, 'BB': 10, 'B': 11
  };
  
  // Try Tonal.js first
  if (typeof Tonal !== 'undefined') {
    try {
      const info = Tonal.Chord.get(chordName);
      if (info.tonic) {
        const midiNote = Tonal.Note.midi(info.tonic + '4');
        return midiNote % 12;
      }
    } catch (e) {}
  }
  
  // Manual parsing
  const tonic = chordName.slice(0, 2).toUpperCase();
  if (noteMap[tonic] !== undefined) return noteMap[tonic];
  
  const singleChar = chordName[0].toUpperCase();
  return noteMap[singleChar] || 0;
}

// Given a MIDI note number and an array of allowed pitch-classes (0-11),
// return the nearest MIDI note within MIN_NOTE..MAX_NOTE whose pitch-class
// is in `scalePCs`.
function snapToScalePitch(midi, scalePCs) {
  if (!scalePCs || !scalePCs.length) return midi;
  // quick check
  if (scalePCs.includes(midi % 12)) return midi;
  for (let d = 1; d <= 12; d++) {
    const up = midi + d;
    const down = midi - d;
    if (up <= MAX_NOTE && scalePCs.includes(up % 12)) return up;
    if (down >= MIN_NOTE && scalePCs.includes(down % 12)) return down;
  }
  // fallback: return original
  return midi;
}

// instrument helper removed — using `sampler` for playback instead.

function updateChord({ add = null, remove = null }) {
  if (add) {
    currentSeed.push({ note: add, time: Tone.now() });
  }
  if (remove && _.some(currentSeed, { note: remove })) {
    _.remove(currentSeed, { note: remove });
  }

  if (stopCurrentSequenceGenerator) {
    stopCurrentSequenceGenerator();
    stopCurrentSequenceGenerator = null;
  }
  if (currentSeed.length && !stopCurrentSequenceGenerator) {
    resetState = true;
    stopCurrentSequenceGenerator = startSequenceGenerator(
      _.cloneDeep(currentSeed)
    );
  }
}


const padGain = new Tone.Gain(0.3).toDestination();
const padReverb = new Tone.Reverb({decay:4, wet:0.5}).connect(padGain);
const padChorus = new Tone.Chorus(4, 2.5, 0.5).connect(padReverb);

const pad = new Tone.PolySynth(Tone.FMSynth,{
  harmonicity:3.5,
  modulationIndex:10,
  oscillator: {type:'sawtooth'},
  envelope:{
    attack:2,
    decay:1,
    sustain:0.8,
    release:2
  },
  modulation:{type: 'triangle'},
  modulationEnvelope: {
    attack:0.8,
    decay: 0.3,
    sustain: 0.6,
    release: 1
  }
}).connect(padChorus);


const marimba = new Tone.Synth(synthConfig).connect(synthFilter);



let padConfig = {
  harmonicity:3.5,
  modulationIndex:10,
  oscillator: {type:'sine'},
  envelope:{
    attack:2,
    decay:1,
    sustain:0.8,
    release:4
  },
  modulation:{type: 'triangle'},
  modulationEnvelope: {
    attack:0.8,
    decay: 0.3,
    sustain: 0.6,
    release: 2
  }
};


 new Tone.PolySynth(Tone.FMSynth,{
  harmonicity:3.5,
  modulationIndex:10,
  oscillator: {type:'sine'},
  envelope:{
    attack:2,
    decay:1,
    sustain:0.8,
    release:4
  },
  modulation:{type: 'triangle'},
  modulationEnvelope: {
    attack:0.8,
    decay: 0.3,
    sustain: 0.6,
    release: 2
  }
}).connect(padChorus);


function humanKeyDown(note, velocity = 0.7) {
  if (note < MIN_NOTE || note > MAX_NOTE) return;
  let freq = Tone.Frequency(note, 'midi');
  let synth = new Tone.PolySynth(Tone.FMSynth,{padConfig}).connect(synthFilter);
  
  synthsPlaying[note] = synth;
  synth.triggerAttack(freq, Tone.now(), velocity);
  sampler.triggerAttack(freq);
  updateChord({ add: note });
  humanPlayer[note - MIN_NOTE].classList.add('down');
  animatePlay(onScreenKeyboard[note - MIN_NOTE], note, true);
}

function humanKeyUp(note) {
  if (note < MIN_NOTE || note > MAX_NOTE) return;
  if (synthsPlaying[note]) {
    let synth = synthsPlaying[note];
    synth.triggerRelease();
    setTimeout(() => synth.dispose(), 2000);
    synthsPlaying[note] = null;
  }
  updateChord({ remove: note });
  humanPlayer[note - MIN_NOTE].classList.remove('down');
}

function machineKeyDown(note, time) {
  if (note < MIN_NOTE || note > MAX_NOTE) return;
  // Play the main machine note using the sampler (single shared instrument)
  try {
    sampler.triggerAttack(Tone.Frequency(note, 'midi'), time);
  } catch (e) {
    // fallback: call without scheduled time
    try { sampler.triggerAttack(Tone.Frequency(note, 'midi')); } catch (e) {}
  }
  animatePlay(onScreenKeyboard[note - MIN_NOTE], note, false);
  animateMachine(machinePlayer[note - MIN_NOTE]);
  // Also play harmony voices based on the current chord
  try {
    // Play harmony only on random notes based on harmonyProbability
    if (Math.random() < harmonyProbability) {
      const harmonyPitches = getChordHarmonyPitches(currentChordName, note, 2);
      for (const h of harmonyPitches) {
        if (h >= MIN_NOTE && h <= MAX_NOTE) {
          try { sampler.triggerAttack(Tone.Frequency(h, 'midi'), time); } catch (e) { sampler.triggerAttack(Tone.Frequency(h, 'midi')); }
          // visual feedback for harmony notes
          const idx = h - MIN_NOTE;
          if (onScreenKeyboard[idx]) animatePlay(onScreenKeyboard[idx], h, false);
          if (machinePlayer[idx]) animateMachine(machinePlayer[idx]);
        }
      }
    }
  } catch (e) {
    // ignore harmony errors
  }
}

function animatePlay(keyEl, note, isHuman) {
  let sourceColor = isHuman ? '#1E88E5' : '#E91E63';
  let targetColor = isAccidental(note) ? 'black' : 'white';
  keyEl.animate(
    [{ backgroundColor: sourceColor }, { backgroundColor: targetColor }],
    { duration: 700, easing: 'ease-out' }
  );
}
function animateMachine(keyEl) {
  keyEl.animate([{ opacity: 0.9 }, { opacity: 0 }], {
    duration: 700,
    easing: 'ease-out'
  });
}

// Computer keyboard controls

builtInKeyboard.down(note => {
  humanKeyDown(note.note);
//  hideUI();
});
builtInKeyboard.up(note => humanKeyUp(note.note));

// MIDI Controls

if (typeof WebMidi !== 'undefined') {
  WebMidi.enable(err => {
    if (err) {
      console.error('WebMidi could not be enabled', err);
      return;
    }
    document.querySelector('.midi-not-supported').style.display = 'none';

    let withInputsMsg = document.querySelector('.midi-supported-with-inputs');
    let noInputsMsg = document.querySelector('.midi-supported-no-inputs');
    let selector = document.querySelector('#midi-inputs');
    let activeInput;

    function onInputsChange() {
      if (WebMidi.inputs.length === 0) {
        withInputsMsg.style.display = 'none';
        noInputsMsg.style.display = 'block';
        onActiveInputChange(null);
      } else {
        noInputsMsg.style.display = 'none';
        withInputsMsg.style.display = 'block';
        while (selector.firstChild) {
          selector.firstChild.remove();
        }
        for (let input of WebMidi.inputs) {
          let option = document.createElement('option');
          option.value = input.id;
          option.innerText = input.name;
          selector.appendChild(option);
        }
        onActiveInputChange(WebMidi.inputs[0].id);
      }
    }

    function onActiveInputChange(id) {
      if (activeInput) {
        activeInput.removeListener();
      }
      let input = WebMidi.getInputById(id);
      if (!input) return;
      input.addListener('noteon', 'all', e => {
        humanKeyDown(e.note.number, e.velocity);
       // hideUI();
      });
      input.addListener('noteoff', 'all', e => humanKeyUp(e.note.number));
      for (let option of Array.from(selector.children)) {
        option.selected = option.value === id;
      }
      activeInput = input;
    }

    onInputsChange();
    WebMidi.addListener('connected', onInputsChange);
    WebMidi.addListener('disconnected', onInputsChange);
    selector.addEventListener('change', evt =>
      onActiveInputChange(evt.target.value)
    );
  });
} else {
  // WebMidi not loaded; show the 'not supported' message and hide MIDI UI
  console.warn('WebMidi not available in this environment. MIDI disabled.');
  const notSupported = document.querySelector('.midi-not-supported');
  const noInputsMsg = document.querySelector('.midi-supported-no-inputs');
  const withInputsMsg = document.querySelector('.midi-supported-with-inputs');
  if (notSupported) notSupported.style.display = 'block';
  if (noInputsMsg) noInputsMsg.style.display = 'none';
  if (withInputsMsg) withInputsMsg.style.display = 'none';
}

// Mouse & touch Controls

let pointedNotes = new Set();

function updateTouchedNotes(evt) {
  let touchedNotes = new Set();
  for (let touch of Array.from(evt.touches)) {
    let element = document.elementFromPoint(touch.clientX, touch.clientY);
    let keyIndex = onScreenKeyboard.indexOf(element);
    if (keyIndex >= 0) {
      touchedNotes.add(MIN_NOTE + keyIndex);
     
        evt.preventDefault();
      
    }
  }
  for (let note of pointedNotes) {
    if (!touchedNotes.has(note)) {
      humanKeyUp(note);
      pointedNotes.delete(note);
    }
  }
  for (let note of touchedNotes) {
    if (!pointedNotes.has(note)) {
      humanKeyDown(note);
      pointedNotes.add(note);
    }
  }
}

onScreenKeyboard.forEach((noteEl, index) => {
  noteEl.addEventListener('mousedown', evt => {
    humanKeyDown(MIN_NOTE + index);
    pointedNotes.add(MIN_NOTE + index);
    evt.preventDefault();
  });
  noteEl.addEventListener('mouseover', () => {
    if (pointedNotes.size && !pointedNotes.has(MIN_NOTE + index)) {
      humanKeyDown(MIN_NOTE + index);
      pointedNotes.add(MIN_NOTE + index);
    }
  });
});
document.documentElement.addEventListener('mouseup', () => {
  pointedNotes.forEach(n => humanKeyUp(n));
  pointedNotes.clear();
});
document.documentElement.addEventListener('touchstart', updateTouchedNotes,{passive:false});
document.documentElement.addEventListener('touchmove', updateTouchedNotes,{passive:false});
document.documentElement.addEventListener('touchend', updateTouchedNotes,{passive:false});



// Temperature control: use native range input
const tempSliderEl = document.querySelector('#temperature');
if (tempSliderEl) {
  temperature = parseFloat(tempSliderEl.value);
  tempSliderEl.addEventListener('input', (e) => {
    temperature = parseFloat(e.target.value);
  });
}

// Tempo control
const tempoSliderEl = document.querySelector('#tempo');
if (tempoSliderEl) {
  tempoBPM = parseInt(tempoSliderEl.value, 10) || 120;
  try {
    if (Tone.Transport && Tone.Transport.bpm) {
      Tone.Transport.bpm.value = tempoBPM;
    }
  } catch (e) {
    console.warn('Could not set initial tempo:', e);
  }
  
  tempoSliderEl.addEventListener('input', (e) => {
    tempoBPM = parseInt(e.target.value, 10) || 120;
    try {
      if (Tone.Transport && Tone.Transport.bpm && typeof Tone.Transport.bpm.rampTo === 'function') {
        Tone.Transport.bpm.rampTo(tempoBPM, 0.1);
      }
    } catch (err) {
      console.warn('Could not change tempo:', err);
    }
  });
}

// Tone selector removed — playback uses the sampler and tempo slider only.

// Controls hiding

let container = document.querySelector('.container');

/*
function hideUI() {
  container.classList.add('ui-hidden');
}
let scheduleHideUI = _.debounce(hideUI, 5000);
container.addEventListener('mousemove', () => {
  container.classList.remove('ui-hidden');
  scheduleHideUI();
});
container.addEventListener('touchstart', () => {
  container.classList.remove('ui-hidden');
  scheduleHideUI();
});
*/
// Startup

function generateDummySequence() {
  // Generate a throwaway sequence to get the RNN loaded so it doesn't
  // cause jank later.
  return rnn.continueSequence(
    buildNoteSequence([{ note: 60, time: Tone.now() }]),
    20,
    temperature,
    ['Cm']
  );
}

// Wait for Tone's internal buffers to load, but don't block forever — use a timeout fallback.
let bufferLoadPromise = Promise.race([
  // Tone.loaded() resolves when samples/buffers are loaded
  (typeof Tone.loaded === 'function' ? Tone.loaded() : Promise.resolve()),
  new Promise((res) => setTimeout(() => {
    console.info('Buffer load timeout — proceeding (samples may still be loading in background)');
    res();
  }, 10000)) // Increased to 10 seconds to allow more time for sample loading
]);

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('rnn.initialize() timed out')), ms))
  ]);
}

const rnnInitPromise = withTimeout(rnn.initialize(), 10000);
Promise.all([bufferLoadPromise, rnnInitPromise])
  .then(generateDummySequence)
  .then(() => {
    Tone.Transport.start();
    if (onScreenKeyboardContainer && onScreenKeyboardContainer.classList) {
      onScreenKeyboardContainer.classList.add('loaded');
    }
    const loadingEl = document.querySelector('.loading');
    if (loadingEl && loadingEl.remove) loadingEl.remove();
  })
  .catch(err => {
    console.error('Error initializing model or buffers:', err);
    // Still unhide the UI so user can interact — show keyboard even on error
    if (onScreenKeyboardContainer && onScreenKeyboardContainer.classList) {
      onScreenKeyboardContainer.classList.add('loaded');
    }
    const loadingEl = document.querySelector('.loading');
    if (loadingEl) {
      loadingEl.innerText = 'Ready (some features may be unavailable)';
      loadingEl.style.fontSize = '20px';
      // remove after short delay so user sees message
      setTimeout(() => loadingEl.remove(), 2000);
    }
  });

// Ensure audio is started on first user gesture. Some helper libs define
// StartAudioContext but it's not always available; use Tone.start() instead.
function ensureAudioStarted() {
  async function startOnce() {
    try {
      if (typeof Tone !== 'undefined' && typeof Tone.start === 'function') {
        await Tone.start();
      } else if (Tone && Tone.context && Tone.context.resume) {
        await Tone.context.resume();
      }
    } catch (e) {
      console.warn('Audio start failed:', e);
    } finally {
      document.documentElement.removeEventListener('pointerdown', startOnce);
      document.documentElement.removeEventListener('touchstart', startOnce);
      document.documentElement.removeEventListener('click', startOnce);
    }
  }
  document.documentElement.addEventListener('pointerdown', startOnce);
  document.documentElement.addEventListener('touchstart', startOnce);
  document.documentElement.addEventListener('click', startOnce);
}
ensureAudioStarted();

// --- Genre presets --------------------------------------------------------
const GENRE_PRESETS = {
  none: {
    tempo: 120,
    temperature: 1.1,
    harmonyProbability: 0.3,
    playIntervalNotation: null, // auto from seed
    playDuration: null,
    maxLeap: null,
    scaleMode: null
  },
  pop: {
    tempo: 100,
    temperature: 1.0,
    harmonyProbability: 0.35,
    playIntervalNotation: '8n',
    playDuration: '8n',
    maxLeap: 12,
    scaleMode: 'major'
  },
  classical: {
    tempo: 80,
    temperature: 0.6,
    harmonyProbability: 0.25,
    playIntervalNotation: '4n',
    playDuration: '4n',
    maxLeap: 7,
    scaleMode: 'major'
  },
  jazz: {
    tempo: 140,
    temperature: 1.3,
    harmonyProbability: 0.45,
    playIntervalNotation: '8n',
    playDuration: '16n',
    maxLeap: 14,
    scaleMode: 'dorian'
  },
  edm: {
    tempo: 128,
    temperature: 1.4,
    harmonyProbability: 0.2,
    playIntervalNotation: '8n',
    playDuration: '8n',
    maxLeap: 24,
    scaleMode: 'minor'
  },
  lofi: {
    tempo: 70,
    temperature: 0.8,
    harmonyProbability: 0.15,
    playIntervalNotation: '8n',
    playDuration: '8n',
    maxLeap: 10,
    scaleMode: 'pentatonic'
  },
  ambient: {
    tempo: 60,
    temperature: 0.6,
    harmonyProbability: 0.1,
    playIntervalNotation: '4n',
    playDuration: '2n',
    maxLeap: 36,
    scaleMode: 'major'
  },
  arpeggio:{
         tempo: 110,
    temperature: 0.8,
    harmonyProbability: 0.0, // No harmony for clean arpeggios
    playIntervalNotation: '16n', // Fast notes
    playDuration: '16n',
    maxLeap: 12, // Allow octave jumps
    scaleMode: 'major',
    generationMode: 'arpeggio', // ← Special mode
    arpeggioPattern: 'auto', // Will select pattern based on context
    arpeggioSpeed: 1.0
  }
};


// Add this after the GENRE_PRESETS definition (around line 890)

// Current selected genre (default to 'none' for auto-detection)
let currentGenre = 'none';

// Genre button handling
document.addEventListener('DOMContentLoaded', () => {
  const genreButtons = document.querySelectorAll('.genre-btn');
  
genreButtons.forEach(button => {
  button.addEventListener('click', (e) => {
    const selectedGenre = e.target.dataset.value;
    if (!selectedGenre) return;
    
    // Update active state
    genreButtons.forEach(btn => {
      if (btn.dataset.value) {
        btn.classList.remove('active');
      }
    });
    e.target.classList.add('active');
    
    // Set current genre
    currentGenre = selectedGenre;
    console.log('🎼 Genre changed to:', selectedGenre);
    
    // Apply preset
    const preset = GENRE_PRESETS[selectedGenre];
    if (preset) {
      // Update tempo
      if (preset.tempo) {
        tempoBPM = preset.tempo;
        const tempoSlider = document.getElementById('tempo');
        if (tempoSlider) {
          tempoSlider.value = preset.tempo;
          try {
            if (Tone.Transport && Tone.Transport.bpm && typeof Tone.Transport.bpm.rampTo === 'function') {
              Tone.Transport.bpm.rampTo(preset.tempo, 0.5);
            }
          } catch (err) {
            console.warn('Could not change tempo:', err);
          }
        }
      }
      
      // Update temperature
      if (preset.temperature !== undefined) {
        temperature = preset.temperature;
        const tempSlider = document.getElementById('temperature');
        if (tempSlider) {
          tempSlider.value = preset.temperature;
        }
      }
      
      // Update harmony probability
      if (preset.harmonyProbability !== undefined) {
        harmonyProbability = preset.harmonyProbability;
      }
      
      // ✨ Set generation mode from preset
      if (preset.generationMode) {
        generationMode = preset.generationMode;
      }
      
      // Store genre config
      window.genreConfig = {
        playIntervalNotation: preset.playIntervalNotation,
        playDuration: preset.playDuration,
        maxLeap: preset.maxLeap,
        scaleMode: preset.scaleMode,
        rhythmStyle: preset.rhythmStyle,
        phraseLength: preset.phraseLength,
        articulation: preset.articulation,
        generationMode: preset.generationMode // ← Add this
      };
      
      console.log(`✨ Applied ${selectedGenre} preset:`, {
        tempo: preset.tempo,
        temperature: preset.temperature,
        harmonyProb: preset.harmonyProbability,
        maxLeap: preset.maxLeap,
        mode: preset.generationMode
      });
      
      // Log mode info
      if (preset.generationMode === 'arpeggio') {
        console.log('🎹 ARPEGGIO MODE: Broken chord patterns, no AI generation');
      } else {
        console.log('🎵 MELODY MODE: AI-generated melodic lines');
      }
      
      // Restart generator with new mode if currently playing
      if (stopCurrentSequenceGenerator && currentSeed.length) {
        console.log('🔄 Restarting generator with new settings...');
        stopCurrentSequenceGenerator();
        stopCurrentSequenceGenerator = null;
        
        stopCurrentSequenceGenerator = startSequenceGenerator(
          _.cloneDeep(currentSeed)
        );
      }
    }
  });
});
  
  // Initialize with default genre (Auto)
  const defaultBtn = document.querySelector('.genre-btn.active');
  if (defaultBtn && defaultBtn.dataset.value) {
    currentGenre = defaultBtn.dataset.value;
    window.genreConfig = GENRE_PRESETS[currentGenre] || {};
  } else {
    window.genreConfig = {};
  }
});

// ============================================================================
// MUSICAL INTELLIGENCE - Enhanced Melody Generation
// ============================================================================

// Rhythm patterns library for different genres
const RHYTHM_PATTERNS = {
  pop: [
    [1, 0, 1, 0, 1, 0, 1, 0],      // Steady eighth notes
    [1, 0, 0, 1, 0, 1, 0, 0],      // Syncopated
    [1, 1, 0, 1, 0, 1, 1, 0]       // Mixed
  ],
  classical: [
    [1, 1, 1, 1, 1, 1, 1, 1],      // Quarter notes
    [1, 0, 1, 0, 1, 0, 1, 0],      // Eighth notes
    [1, 1, 1, 0, 1, 1, 1, 0]       // Dotted rhythm
  ],
  jazz: [
    [1, 0, 0, 1, 1, 0, 0, 1],      // Swing feel
    [1, 0, 1, 0, 0, 1, 0, 1],      // Off-beat
    [1, 1, 0, 1, 0, 0, 1, 0]       // Complex
  ],
  edm: [
    [1, 0, 1, 0, 1, 0, 1, 0],      // Four-on-floor feel
    [1, 0, 0, 0, 1, 0, 0, 0],      // Sparse
    [1, 1, 1, 1, 0, 0, 0, 0]       // Buildup
  ],
  lofi: [
    [1, 0, 0, 1, 0, 0, 1, 0],      // Laid back
    [1, 0, 1, 0, 0, 0, 1, 0],      // Chill
    [1, 0, 0, 0, 1, 0, 0, 1]       // Relaxed
  ],
  ambient: [
    [1, 0, 0, 0, 0, 0, 0, 0],      // Very sparse
    [1, 0, 0, 0, 1, 0, 0, 0],      // Long notes
    [1, 0, 0, 1, 0, 0, 0, 0]       // Minimal
  ]
};

// Melodic contour shapes for natural phrases
const MELODIC_CONTOURS = {
  arch: [0, 2, 4, 3, 1, -1],          // Rise and fall (classic)
  ascend: [0, 1, 2, 3, 4, 5],         // Upward motion
  descend: [0, -1, -2, -3, -4, -5],   // Downward motion
  wave: [0, 2, 1, 3, 2, 0],           // Wave motion
  leap_return: [0, 5, 4, 3, 2, 1]     // Leap up, step down
};

// Note duration probabilities for different rhythmic feels
const NOTE_DURATIONS = {
  legato: { '2n': 0.3, '4n': 0.4, '8n': 0.2, '16n': 0.1 },
  staccato: { '16n': 0.5, '8n': 0.3, '4n': 0.2, '2n': 0.0 },
  mixed: { '2n': 0.1, '4n': 0.3, '8n': 0.4, '16n': 0.2 },
  sustained: { '2n': 0.5, '4n': 0.3, '8n': 0.15, '16n': 0.05 }
};

// Phrase structure (measures before natural pause/breath)
const PHRASE_LENGTHS = {
  short: 2,   // 2 measures
  medium: 4,  // 4 measures (standard)
  long: 8     // 8 measures
};

// Musical phrase analyzer
function analyzePhrase(seed) {
  if (!seed || seed.length < 2) return null;
  
  const intervals = [];
  const rhythms = [];
  
  for (let i = 0; i < seed.length - 1; i++) {
    // Melodic intervals
    const interval = seed[i + 1].note - seed[i].note;
    intervals.push(interval);
    
    // Rhythmic intervals
    const rhythm = seed[i + 1].time - seed[i].time;
    rhythms.push(rhythm);
  }
  
  // Determine melodic direction tendency
  const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const direction = avgInterval > 1 ? 'ascending' : avgInterval < -1 ? 'descending' : 'static';
  
  // Determine rhythmic consistency
  const rhythmVariance = Math.max(...rhythms) - Math.min(...rhythms);
  const rhythmStyle = rhythmVariance < 0.1 ? 'steady' : 'varied';
  
  return {
    direction,
    avgInterval,
    rhythmStyle,
    intervals,
    rhythms
  };
}

// Apply musical phrasing (add rests, breathing points)
function applyPhrasing(sequence, phraseLength = 4) {
  if (!sequence || sequence.length === 0) return sequence;
  
  const result = [];
  const beatsPerMeasure = 4;
  const notesPerPhrase = phraseLength * beatsPerMeasure;
  
  for (let i = 0; i < sequence.length; i++) {
    result.push(sequence[i]);
    
    // Add rest at phrase boundaries (every N notes)
    if ((i + 1) % notesPerPhrase === 0 && i < sequence.length - 1) {
      // Don't add actual rest, just create a longer gap by skipping
      // This is handled in the generation loop
      result.push(-1); // -1 signals a rest/silence
    }
  }
  
  return result;
}

// Smooth melodic motion (avoid awkward leaps)
function smoothMelody(sequence, maxLeap = 7) {
  if (!sequence || sequence.length < 2) return sequence;
  
  const result = [sequence[0]];
  
  for (let i = 1; i < sequence.length; i++) {
    let current = sequence[i];
    const prev = result[result.length - 1];
    
    if (current < 0) {
      result.push(current); // Keep rests
      continue;
    }
    
    let interval = Math.abs(current - prev);
    
    // If leap is too large, move by step instead
    if (interval > maxLeap) {
      const direction = current > prev ? 1 : -1;
      // Move by step (2-3 semitones) in the intended direction
      current = prev + direction * (Math.random() < 0.5 ? 2 : 3);
      // Ensure it's in scale
      current = snapToScalePitch(current, currentScalePCs);
    }
    
    // After a large leap, tend to move in opposite direction (melodic compensation)
    if (i > 1 && interval > 4) {
      const prevInterval = result[result.length - 1] - result[result.length - 2];
      if ((prevInterval > 0 && current > prev) || (prevInterval < 0 && current < prev)) {
        // Same direction after leap - reverse it sometimes
        if (Math.random() < 0.6) {
          current = prev - Math.sign(current - prev) * 2;
          current = snapToScalePitch(current, currentScalePCs);
        }
      }
    }
    
    result.push(current);
  }
  
  return result;
}

// Add rhythmic variety based on genre
function applyRhythmicPattern(sequence, genre = 'none') {
  if (!sequence || sequence.length === 0) return sequence;
  
  const patterns = RHYTHM_PATTERNS[genre] || RHYTHM_PATTERNS.pop;
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];
  
  const result = [];
  let patternIndex = 0;
  
  for (let note of sequence) {
    const shouldPlay = pattern[patternIndex % pattern.length];
    
    if (shouldPlay === 1) {
      result.push(note);
    } else if (Math.random() < 0.3) {
      // Sometimes skip notes for rhythmic interest
      result.push(-1); // Rest
    } else {
      result.push(note);
    }
    
    patternIndex++;
  }
  
  return result;
}

// Create call-and-response patterns
function applyCallAndResponse(sequence, phraseLength = 8) {
  if (!sequence || sequence.length < phraseLength * 2) return sequence;
  
  const result = [];
  
  for (let i = 0; i < sequence.length; i += phraseLength * 2) {
    // Call phrase (original)
    for (let j = 0; j < phraseLength && i + j < sequence.length; j++) {
      result.push(sequence[i + j]);
    }
    
    // Response phrase (variation: transposed or inverted)
    for (let j = 0; j < phraseLength && i + phraseLength + j < sequence.length; j++) {
      let note = sequence[i + phraseLength + j];
      
      if (note > 0) {
        // Sometimes transpose response
        if (Math.random() < 0.5) {
          note = snapToScalePitch(note + (Math.random() < 0.5 ? 3 : -3), currentScalePCs);
        }
      }
      
      result.push(note);
    }
  }
  
  return result;
}

// Add chord tones on strong beats for harmonic clarity
function emphasizeChordTones(sequence, chordName) {
  if (!sequence || sequence.length === 0) return sequence;
  
  const chordPitches = getChordHarmonyPitches(chordName, 60, 3);
  const chordPCs = chordPitches.map(p => p % 12);
  
  const result = [];
  const beatsPerMeasure = 4;
  
  for (let i = 0; i < sequence.length; i++) {
    let note = sequence[i];
    
    // On strong beats (1 and 3 of measure), prefer chord tones
    const beatPosition = i % beatsPerMeasure;
    if ((beatPosition === 0 || beatPosition === 2) && note > 0) {
      const pc = note % 12;
      
      // If not a chord tone, find nearest chord tone
      if (!chordPCs.includes(pc)) {
        let nearest = chordPitches[0];
        let minDist = Math.abs(note - nearest);
        
        for (let cp of chordPitches) {
          // Find chord tone in same register
          let candidate = cp;
          while (candidate < note - 6) candidate += 12;
          while (candidate > note + 6) candidate -= 12;
          
          const dist = Math.abs(note - candidate);
          if (dist < minDist) {
            minDist = dist;
            nearest = candidate;
          }
        }
        
        // Replace with chord tone 60% of the time
        if (Math.random() < 0.6) {
          note = snapToScalePitch(nearest, currentScalePCs);
        }
      }
    }
    
    result.push(note);
  }
  
  return result;
}

// Add dynamics and expression (via velocity variation in future)
function addMusicalExpression(sequence) {
  if (!sequence || sequence.length === 0) return sequence;
  
  // For future: store velocity with notes
  // For now, just mark climax points
  const climaxPoint = Math.floor(sequence.length * 0.618); // Golden ratio
  
  return sequence; // Placeholder - velocity handled elsewhere
}

// ============================================================================
// ENHANCED startSequenceGenerator with Musical Intelligence
// ============================================================================

// Store original function before overriding again
const original_startSequenceGenerator_v2 = startSequenceGenerator;

startSequenceGenerator = function(seed) {
  let running = true;
  let lastGenerationTask = Promise.resolve();

  // Analyze the seed phrase to understand musical intent
  const phraseAnalysis = analyzePhrase(seed);
  
  let chords = detectChord(seed);
  let chord = _.first(chords) || 'CM';
  currentChordName = chord;
  
  try {
    currentScalePCs = detectScale(seed) || currentScalePCs;
  } catch (e) {}

  let seedSeq = buildNoteSequence(seed);
  let generatedSequence = Math.random() < 0.7 ? _.clone(seedSeq.notes.map(n => n.pitch)) : [];
  
  if (generatedSequence && generatedSequence.length) {
    generatedSequence = generatedSequence.map(p => snapToScalePitch(p, currentScalePCs));
  }

  const gc = window.genreConfig || {};
  const genre = currentGenre || 'none';
  
  let launchWaitTime = getSequenceLaunchWaitTime(seed);
  let playIntervalNotation = gc.playIntervalNotation || getSequencePlayIntervalNotation(seed);
  
  let playIntervalTime;
  try {
    playIntervalTime = Tone.Time(playIntervalNotation).toSeconds();
    playIntervalTime = Math.max(0.05, playIntervalTime);
  } catch (e) {
    playIntervalTime = 0.25;
  }
  
  currentPlayNoteDuration = gc.playDuration || playIntervalNotation;
  let generationIntervalTime = Math.max(0.1, playIntervalTime / 2);

  function generateNext() {
    if (!running) return;
    
    if (generatedSequence.length < 16) { // Keep more notes buffered
      lastGenerationTask = rnn
        .continueSequence(seedSeq, 32, temperature, [chord]) // Generate more at once
        .then(genSeq => {
          let mapped = genSeq.notes.map(n => snapToScalePitch(n.pitch, currentScalePCs));
          
          // === APPLY MUSICAL INTELLIGENCE ===
          
          // 1. Smooth melodic motion
          const maxLeap = gc.maxLeap || 7;
          mapped = smoothMelody(mapped, maxLeap);
          
          // 2. Apply rhythmic patterns
          mapped = applyRhythmicPattern(mapped, genre);
          
          // 3. Add phrasing (rests at phrase boundaries)
          const phraseLength = PHRASE_LENGTHS.medium;
          mapped = applyPhrasing(mapped, phraseLength);
          
          // 4. Emphasize chord tones on strong beats
          mapped = emphasizeChordTones(mapped, chord);
          
          // 5. Create call-and-response structure
          if (mapped.length >= 16) {
            mapped = applyCallAndResponse(mapped, 8);
          }
          
          // 6. Final smoothing pass
          mapped = smoothMelody(mapped, maxLeap);
          
          generatedSequence = generatedSequence.concat(mapped);
          
          const timeoutMs = Math.max(100, generationIntervalTime * 1000);
          setTimeout(generateNext, timeoutMs);
        })
        .catch(err => {
          console.warn('Error generating sequence:', err);
          setTimeout(generateNext, 1000);
        });
    } else {
      const timeoutMs = Math.max(100, generationIntervalTime * 1000);
      setTimeout(generateNext, timeoutMs);
    }
  }

  function consumeNext(time) {
    if (generatedSequence.length) {
      let note = generatedSequence.shift();
      
      // Skip rests (marked as -1)
      if (note > 0) {
        machineKeyDown(note, time);
      }
    }
  }

  setTimeout(generateNext, launchWaitTime * 1000);
  let consumerId = Tone.Transport.scheduleRepeat(
    consumeNext,
    playIntervalNotation,
    Tone.Transport.seconds + launchWaitTime
  );

  return () => {
    running = false;
    Tone.Transport.clear(consumerId);
  };
};

// Update GENRE_PRESETS with musical characteristics
GENRE_PRESETS.pop.rhythmStyle = 'mixed';
GENRE_PRESETS.pop.phraseLength = 'medium';
GENRE_PRESETS.pop.articulation = 'mixed';

GENRE_PRESETS.classical.rhythmStyle = 'legato';
GENRE_PRESETS.classical.phraseLength = 'long';
GENRE_PRESETS.classical.articulation = 'legato';

GENRE_PRESETS.jazz.rhythmStyle = 'mixed';
GENRE_PRESETS.jazz.phraseLength = 'medium';
GENRE_PRESETS.jazz.articulation = 'staccato';

GENRE_PRESETS.edm.rhythmStyle = 'mixed';
GENRE_PRESETS.edm.phraseLength = 'short';
GENRE_PRESETS.edm.articulation = 'staccato';

GENRE_PRESETS.lofi.rhythmStyle = 'legato';
GENRE_PRESETS.lofi.phraseLength = 'long';
GENRE_PRESETS.lofi.articulation = 'legato';

GENRE_PRESETS.ambient.rhythmStyle = 'sustained';
GENRE_PRESETS.ambient.phraseLength = 'long';
GENRE_PRESETS.ambient.articulation = 'legato';

// Constrain melodic leaps in a sequence of MIDI pitches.
// - seq: array of MIDI pitches (numbers)
// - maxLeap: maximum allowed semitone leap between successive notes (number)
// Returns a new array (does not mutate input). If maxLeap is falsy, returns a shallow copy.
function constrainMaxLeap(seq, maxLeap) {
  if (!Array.isArray(seq)) return [];
  if (!maxLeap) return seq.slice();

  const out = [];
  let prev = null;

  for (let i = 0; i < seq.length; i++) {
    let n = Math.round(seq[i]);

    // ensure candidate in allowed MIDI range
    n = Math.max(MIN_NOTE, Math.min(MAX_NOTE, n));

    if (prev === null) {
      out.push(n);
      prev = n;
      continue;
    }

    // shift n by octaves so it's closest to prev
    const octaveShift = Math.round((prev - n) / 12);
    const candidates = [
      n + octaveShift * 12,
      n + (octaveShift + 1) * 12,
      n + (octaveShift - 1) * 12
    ].map(x => Math.max(MIN_NOTE, Math.min(MAX_NOTE, Math.round(x))));

    // pick candidate closest to prev
    let best = candidates[0];
    for (let c of candidates) {
      if (Math.abs(c - prev) < Math.abs(best - prev)) best = c;
    }

    const diff = best - prev;
    if (Math.abs(diff) > maxLeap) {
      // clamp toward prev
      best = prev + Math.sign(diff) * maxLeap;
      best = Math.max(MIN_NOTE, Math.min(MAX_NOTE, Math.round(best)));
    }

    out.push(best);
    prev = best;
  }

  return out;
}
(function attachDrumThumbLabel(){
  const slider = document.getElementById('tempo');
  const label = document.getElementById('SelectValue');
  if (!slider || !label) return;

  // approximate visible thumb width in px (adjust to match your CSS ::-webkit-slider-thumb size)
  const thumbWidth = 48;

  function update() {
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const val = Math.min(max, Math.max(min, parseFloat(slider.value)));
    const ratio = (val - min) / (max - min || 1);

    const sliderRect = slider.getBoundingClientRect();
    const parent = slider.offsetParent || slider.parentElement || document.body;
    const parentRect = parent.getBoundingClientRect();

    // thumb center X relative to parent
    const thumbCenterX = (sliderRect.left - parentRect.left) + ratio * sliderRect.width;

    // position label centered at thumb center
    const left = Math.round(thumbCenterX);
    // vertical position: above the thumb (tweak gap)
    const top = Math.round((sliderRect.top - parentRect.top) - (label.offsetHeight / 0.8));

    label.style.left = `${left}px`;
    label.style.top = `${top}px`;
    label.textContent = slider.value;
  }

  slider.addEventListener('input', update, { passive: true });
  window.addEventListener('resize', update);
  // init
  requestAnimationFrame(update);
})();


// ============================================================================
// MIDI Keyboard Handler
// ============================================================================

let midiInput = null;
let connectedDevices = [];

// Initialize MIDI when the page loads
function initMIDI() {
  const midiDeviceName = document.getElementById('midi-device-name');
  
  // Check if Web MIDI API is supported
  if (navigator.requestMIDIAccess) {
    console.log('Initializing MIDI...');
    navigator.requestMIDIAccess()
      .then(onMIDISuccess, onMIDIFailure);
  } else {
    console.error('Web MIDI API not supported in this browser');
    if (midiDeviceName) {
      midiDeviceName.textContent = 'Web MIDI API not supported';
      midiDeviceName.style.color = '#ff6b6b';
    }
  }
}

function onMIDISuccess(midiAccess) {
  console.log('MIDI Access granted');
  const midiDeviceName = document.getElementById('midi-device-name');
  const inputs = midiAccess.inputs;
  
  if (inputs.size === 0) {
    console.log('No MIDI devices found');
    if (midiDeviceName) {
      midiDeviceName.textContent = 'No MIDI device connected';
      midiDeviceName.style.color = '#888';
    }
  } else {
    // Connect to all available MIDI inputs
    connectedDevices = [];
    inputs.forEach((input) => {
      console.log('MIDI device found:', input.name);
      connectedDevices.push(input.name);
      
      // Listen for MIDI messages from this input
      input.onmidimessage = handleMIDIMessage;
    });
    
    // Update UI with connected device name(s)
    if (midiDeviceName) {
      if (connectedDevices.length === 1) {
        midiDeviceName.textContent = `Connected: ${connectedDevices[0]}`;
      } else {
        midiDeviceName.textContent = `Connected: ${connectedDevices.length} devices`;
      }
      midiDeviceName.style.color = '#4CAF50';
    }
  }

  // Listen for device connection/disconnection changes
  midiAccess.onstatechange = (e) => {
    console.log('MIDI state change:', e.port.state, e.port.name);
    
    if (e.port.type === 'input') {
      if (e.port.state === 'connected') {
        if (!connectedDevices.includes(e.port.name)) {
          connectedDevices.push(e.port.name);
        }
        e.port.onmidimessage = handleMIDIMessage;
        
        if (midiDeviceName) {
          if (connectedDevices.length === 1) {
            midiDeviceName.textContent = `Connected: ${connectedDevices[0]}`;
          } else {
            midiDeviceName.textContent = `Connected: ${connectedDevices.length} devices`;
          }
          midiDeviceName.style.color = '#4CAF50';
        }
        console.log('MIDI device connected:', e.port.name);
      } else if (e.port.state === 'disconnected') {
        connectedDevices = connectedDevices.filter(name => name !== e.port.name);
        
        if (midiDeviceName) {
          if (connectedDevices.length === 0) {
            midiDeviceName.textContent = 'No MIDI device connected';
            midiDeviceName.style.color = '#888';
          } else if (connectedDevices.length === 1) {
            midiDeviceName.textContent = `Connected: ${connectedDevices[0]}`;
          } else {
            midiDeviceName.textContent = `Connected: ${connectedDevices.length} devices`;
          }
        }
        console.log('MIDI device disconnected:', e.port.name);
      }
    }
  };
}

function onMIDIFailure(error) {
  console.error('Failed to access MIDI devices:', error);
  const midiDeviceName = document.getElementById('midi-device-name');
  if (midiDeviceName) {
    midiDeviceName.textContent = 'Failed to access MIDI';
    midiDeviceName.style.color = '#ff6b6b';
  }
}

// Handle incoming MIDI messages
function handleMIDIMessage(message) {
  const [status, note, velocity] = message.data;
  
  // Extract the command (high nibble) and channel (low nibble)
  const command = status >> 4;
  const channel = status & 0xf;
  
  // Note On (command 9, or command 8 in some older devices)
  if (command === 9 && velocity > 0) {
    const noteName = midiNoteToNoteName(note);
    console.log('MIDI Note ON:', noteName, 'velocity:', velocity);
    
    // Check if note is in 2nd octave range (C2-B2: MIDI 36-47) for drums
    if (note >= 36 && note <= 47) {
      triggerDrumFromMIDI(note, velocity / 127);
    } else {
      // Regular melodic notes
      playMIDINote(noteName, velocity / 127, note);
      // Visual feedback on virtual keyboard
      highlightMIDIKey(note, true);
    }
  }
  // Note Off (command 8, or command 9 with velocity 0)
  else if (command === 8 || (command === 9 && velocity === 0)) {
    const noteName = midiNoteToNoteName(note);
    console.log('MIDI Note OFF:', noteName);
    
    // Only stop melodic notes (drums are one-shot samples)
    if (note < 36 || note > 47) {
      stopMIDINote(noteName, note);
      // Remove visual feedback
      highlightMIDIKey(note, false);
    }
  }
  // Control Change messages (knobs, sliders, pedals)
  else if (command === 11) {
    console.log('MIDI Control Change:', note, 'value:', velocity);
    // You can add control change handling here (e.g., sustain pedal)
  }
}

// Trigger drum samples from MIDI keyboard (2nd octave: C2-B2, MIDI 36-47)
// MIDI Note Mapping:
// 36 (C2)  -> Kick
// 37 (C#2) -> Snare
// 38 (D2)  -> Closed Hat
// 39 (D#2) -> Clap
// 40 (E2)  -> Conga
// 41 (F2)  -> Tom
// 42 (F#2) -> Tamb
// 43 (G2)  -> Open Hat
// 44-47    -> (reserved for future drums)
function triggerDrumFromMIDI(midiNote, velocity = 1) {
  // Map MIDI notes to drum samples
  const drumMap = {
    36: 'kick',    // C2
    37: 'snare',   // C#2
    38: 'hat',     // D2
    39: 'clap',    // D#2
    40: 'conga',   // E2
    41: 'tom',     // F2
    42: 'tamb',    // F#2
    43: 'open_hat' // G2
  };
  
  const drumName = drumMap[midiNote];
  
  if (drumName && typeof window.players !== 'undefined' && window.players[drumName]) {
    try {
      // Trigger the drum sample with velocity
      const player = window.players[drumName];
      player.volume.value = 20 * Math.log10(Math.max(0.01, velocity)); // Convert velocity to dB
      player.start();
      console.log(`🥁 Drum triggered: ${drumName} (MIDI ${midiNote}) velocity: ${velocity.toFixed(2)}`);
    } catch (error) {
      console.warn(`Could not trigger drum ${drumName}:`, error);
    }
  } else if (drumName) {
    console.warn(`Drum sample "${drumName}" not loaded yet`);
  }
}

// Convert MIDI note number to note name with octave (e.g., 60 -> C4)
function midiNoteToNoteName(midiNote) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteName = noteNames[midiNote % 12];
  return noteName + octave;
}

// Play note function - integrates with existing humanKeyDown for full harmony generation
function playMIDINote(noteName, velocity = 1, midiNote) {
  // Use humanKeyDown to trigger the full melody generation pipeline
  // This will handle:
  // - Playing the sampler
  // - Triggering synth
  // - Updating chord/seed for AI harmony
  // - Visual feedback on human player
  // - Starting sequence generator
  if (midiNote >= MIN_NOTE && midiNote <= MAX_NOTE) {
    try {
      // Call the existing humanKeyDown function with velocity
      humanKeyDown(midiNote, velocity * 0.8);
    } catch (error) {
      console.error('Error playing MIDI note via humanKeyDown:', error);
    }
  }
}

// Stop note function - uses humanKeyUp for proper cleanup
function stopMIDINote(noteName, midiNote) {
  // Use humanKeyUp to properly stop the note and update state
  // This will handle:
  // - Stopping synth
  // - Updating chord/seed
  // - Removing visual feedback
  if (midiNote >= MIN_NOTE && midiNote <= MAX_NOTE) {
    try {
      humanKeyUp(midiNote);
    } catch (error) {
      console.error('Error stopping MIDI note via humanKeyUp:', error);
    }
  }
}

// Highlight virtual keyboard key based on MIDI note number
function highlightMIDIKey(midiNote, isActive) {
  // Calculate the key index relative to MIN_NOTE
  if (midiNote < MIN_NOTE || midiNote > MAX_NOTE) {
    return; // Note is outside the visual keyboard range
  }
  
  const keyIndex = midiNote - MIN_NOTE;
  const keyboardContainer = document.querySelector('.keyboard');
  
  if (keyboardContainer) {
    const keys = keyboardContainer.querySelectorAll('.key');
    if (keys[keyIndex]) {
      if (isActive) {
        keys[keyIndex].classList.add('active');
      } else {
        keys[keyIndex].classList.remove('active');
      }
    }
  }
}

// Initialize MIDI when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMIDI);
} else {
  // DOM is already loaded
  initMIDI();
}

// Export MIDI functions for potential use elsewhere
window.midiHandler = {
  init: initMIDI,
  playNote: playMIDINote,
  stopNote: stopMIDINote,
  getConnectedDevices: () => connectedDevices
};

// Add after temperature slider setup
console.log(`🎵 Musical Intelligence Active:
  - Melodic smoothing (max leap: ${GENRE_PRESETS[currentGenre]?.maxLeap || 7} semitones)
  - Rhythmic patterns (${currentGenre} style)
  - Phrase structure (${PHRASE_LENGTHS.medium} measures)
  - Chord tone emphasis on strong beats
  - Call-and-response patterns
`);

