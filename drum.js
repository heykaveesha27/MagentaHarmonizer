window.onload = async function () {
  // Basic config
  
  const canvas = document.getElementById('mycanvas');
  const ctx = canvas.getContext('2d');
  const cellWidth = 60;
  const cellHeight = 40
  const rows = canvas.height / cellHeight;
  const cols = canvas.width / cellWidth;

  const groupSize = 4;
  const gapWidth = 10;

  function screenXForCol(col){
    const groupsBefore = Math.floor(col/groupSize);
    return col*cellWidth+groupsBefore* gapWidth;
  }

  const totalUsedWidth = cols*cellWidth+Math.floor(cols/groupSize)*gapWidth;

  // UI
  //const startStopBtn = document.getElementById('drum-startstop');
  const tempoInput = document.getElementById('tempo');
  const statusSpan = document.getElementById('status');

  // Row labels (optional, used for synth notes)
  const rowSounds = ['kick', 'snare', 'hat', 'clap','conga','tom','tamb','open_hat'];

  // grid state: columns x rows
  const cellStates = Array.from({ length: cols }, () =>
    Array.from({ length: rows }, () => false)
  );

  // visual playhead column index
  let playhead = -1;

  // Tone objects
  let players = {};
  const synths = {};
  let samplesLoaded = false;
  
  // ========== DRUMS RNN INTEGRATION START ==========
  let drumsRNN = null;
  let drumsRNNReady = false;
  let isGeneratingPattern = false;

  // Initialize DrumsRNN model
  async function initDrumsRNN() {
    try {
      console.log('🥁 Loading DrumsRNN model...');
      drumsRNN = new mm.MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/drum_kit_rnn');
      await drumsRNN.initialize();
      drumsRNNReady = true;
      console.log('✅ DrumsRNN ready!');
      
      // Enable generate button if exists
      const genBtn = document.getElementById('generate-drums');
      if (genBtn) {
        genBtn.disabled = false;
        genBtn.textContent = 'Generate AI Drums';
      }
    } catch (err) {
      console.error('❌ DrumsRNN initialization failed:', err);
      drumsRNNReady = false;
    }
  }

  // Convert DrumsRNN output to grid format
  // DrumsRNN uses MIDI drum mapping:
  // 36=kick, 38=snare, 42=closed_hat, 46=open_hat, etc.
  function drumsRNNToGrid(sequence) {
    // Clear existing pattern
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        cellStates[x][y] = false;
      }
    }

    if (!sequence || !sequence.notes) return;

    // Map MIDI pitch to our row index
    const pitchToRow = {
      36: 0, // kick
      38: 1, // snare
      42: 2, // closed hat
      39: 3, // clap (hand clap)
      64: 4, // conga (low conga)
      50: 5, // tom (high tom)
      54: 6, // tamb (tambourine)
      46: 7  // open hat
    };

    // Get quantization step (16th notes typically)
    const stepsPerQuarter = sequence.quantizationInfo?.stepsPerQuarter || 4;
    const totalSteps = cols; // Our grid width

    sequence.notes.forEach(note => {
      const row = pitchToRow[note.pitch];
      if (row === undefined) return; // Skip unmapped drums

      // Convert quantized step to grid column
      const col = Math.floor((note.quantizedStartStep / stepsPerQuarter) * 4) % cols;
      
      if (col >= 0 && col < cols && row >= 0 && row < rows) {
        cellStates[col][row] = true;
      }
    });

    drawGrid();
  }

  // Generate drum pattern with DrumsRNN
  async function generateDrumPattern(temperature = 1.0, steps = 32) {
    if (!drumsRNNReady) {
      console.warn('DrumsRNN not ready yet');
      return;
    }

    if (isGeneratingPattern) {
      console.warn('Already generating a pattern...');
      return;
    }

    try {
      isGeneratingPattern = true;
      console.log('🎵 Generating drum pattern...');

      // Create a seed sequence (optional - can start from empty)
      const seed = {
        notes: [],
        quantizationInfo: { stepsPerQuarter: 4 },
        totalQuantizedSteps: 16
      };

      // Or use current grid as seed if it has notes
      const hasNotes = cellStates.some(col => col.some(cell => cell));
      if (hasNotes) {
        // Convert current grid to seed
        for (let x = 0; x < Math.min(cols, 16); x++) {
          for (let y = 0; y < rows; y++) {
            if (cellStates[x][y]) {
              const rowToPitch = {
                0: 36, 1: 38, 2: 42, 3: 39,
                4: 64, 5: 50, 6: 54, 7: 46
              };
              seed.notes.push({
                pitch: rowToPitch[y] || 36,
                quantizedStartStep: x,
                quantizedEndStep: x + 1,
                velocity: 100
              });
            }
          }
        }
      }

      // Generate continuation
      const result = await drumsRNN.continueSequence(seed, steps, temperature);
      
      console.log('✅ Pattern generated!');
      drumsRNNToGrid(result);

    } catch (err) {
      console.error('❌ Pattern generation failed:', err);
    } finally {
      isGeneratingPattern = false;
    }
  }

  // Expose API for external control
  window.drumRNNAPI = {
    generate: generateDrumPattern,
    isReady: () => drumsRNNReady,
    clearGrid: () => {
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          cellStates[x][y] = false;
        }
      }
      drawGrid();
    }
  };

  // ========== DRUMS RNN INTEGRATION END ==========


const masterDrumGain = new Tone.Gain(1).toDestination();

  const kickGain = new Tone.Gain(1).connect(masterDrumGain);
  const snareGain = new Tone.Gain(1).connect(masterDrumGain);
  const hatGain = new Tone.Gain(1).connect(masterDrumGain);
  const clapGain = new Tone.Gain(1).connect(masterDrumGain);
  const congaGain = new Tone.Gain(1).connect(masterDrumGain);
  const tomGain = new Tone.Gain(1).connect(masterDrumGain);
  const tambGain = new Tone.Gain(1).connect(masterDrumGain);
  const openhatGain = new Tone.Gain(1).connect(masterDrumGain);

  // try to create players for samples; if decoding fails we'll fallback to synths
  function makePlayers() {
    const map = {
  kick: 'samples/kick.mp3',
  snare: 'samples/snare.mp3',
  hat: 'samples/closed_hat.mp3',
  clap: 'samples/clap.mp3',
  open_hat:'samples/open_hat.mp3',
  tamb:'samples/tamb.mp3',
  tom:'samples/tom.mp3',
  conga:'samples/conga.mp3'
    };

    for (const [k, v] of Object.entries(map)) {
      players[k] = new Tone.Player(v);

      switch(k){
        case 'kick':players[k].connect(kickGain);break;
        case 'snare':players[k].connect(snareGain);break;
        case 'hat':players[k].connect(hatGain);break;
        case 'clap':players[k].connect(clapGain);break;
        case 'conga':players[k].connect(congaGain);break;
        case 'tom':players[k].connect(tomGain);break;
        case 'tamb':players[k].connect(tambGain);break;
        case 'open_hat':players[k].connect(openhatGain);break;
      }
    }
  }

  const kickGainSlider = document.getElementById('kickGain');

  const drumsSlider = document.getElementById('drums-all');
  if(drumsSlider){
    drumsSlider.addEventListener('input',(e)=>{
      masterDrumGain.gain.rampTo(parseFloat(e.target.value),0.05)
    });
    masterDrumGain.gain.value=parseFloat(drumsSlider.value);
  }

  if(kickGainSlider){
    kickGainSlider.addEventListener('input',(e)=>{
      kickGain.gain.rampTo(parseFloat(e.target.value)/100,0.05);
    })
  }

const sliders = [
  {id:'snareGain',gain:snareGain},
  {id:'hatGain', gain:hatGain},
  {id:'clapGain',gain:clapGain},
  {id:'congaGain', gain:congaGain},
  {id:'tomGain',gain:tomGain},
  {id:'tambGain',gain:tambGain},
  {id:'openhatGain',gain:openhatGain}
];

sliders.forEach(({id, gain})=>{
  const slider = document.getElementById(id);
  if(slider){
    slider.addEventListener('input',(e)=>{
      gain.gain.rampTo(parseFloat(e.target.value)/100,0.05);
    })
  }
})

  // create simple synth fallbacks
  function makeSynths() {
    synths.kick = new Tone.MembraneSynth().toDestination();
    synths.snare = new Tone.NoiseSynth({ noise: { type: 'white' } }).toDestination();
    synths.hat = new Tone.MetalSynth({ frequency: 400, envelope: { attack: 0.001, decay: 0.1, release: 0.01 } }).toDestination();
    synths.clav = new Tone.Synth().toDestination();
  }

  makePlayers();
  
  // Expose players globally for MIDI access
  window.players = players;
  window.drumGains = {
    kick: kickGain,
    snare: snareGain,
    hat: hatGain,
    clap: clapGain,
    conga: congaGain,
    tom: tomGain,
    tamb: tambGain,
    open_hat: openhatGain
  };

  // Wait for samples to load, but don't fail if they don't decode
  async function loadSamplesSafe() {
    try {
  await Tone.loaded();
  console.log('Samples loaded');
  samplesLoaded = true;
    } catch (err) {
  console.warn('Sample loading failed or some files could not be decoded:', err);
    }
  }

  // draw grid with optional playhead highlight (rounded corners)
  function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // helper to draw a rounded rectangle
    function drawRoundedRect(x, y, w, h, r, fillStyle,strokeStyle, shadow = null) {
      const radius = Math.min(r, w / 2, h / 2);

      if(shadow){
        ctx.save();
        if(shadow.color) ctx.shadowColor = shadow.color;
        if(typeof shadow.blur === 'number') ctx.shadowBlur = shadow.blur;
        if(typeof shadow.offsetX === 'number') ctx.shadowOffsetX=shadow.offsetX;
        if(typeof shadow.offsetY=== 'number') ctx.shadowOffsetY=shadow.offsetY;
      }

      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
      }
      if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.stroke();

        if(shadow){
          ctx.save();
          ctx.shadowColor = 'transparent';
          ctx.strokeStyle = strokeStyle;
        ctx.stroke();
        ctx.restore();
        }else{
          ctx.strokeStyle = strokeStyle;
          ctx.stroke();
        }
      }

      if(shadow) ctx.restore();
    }

    // playhead column highlight (draw behind cells)
    if (playhead >= 0) {
      const px = playhead * cellWidth;
      ctx.save();

      ctx.shadowColor = 'rgba(0, 255, 17, 0.5)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(255,200,0,0.14)';
      ctx.fillRect(px, 0, cellWidth, canvas.height);
      
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(255,200,0,0.06)';
      ctx.fillRect(px-12,0,cellWidth+24,canvas.height);

      ctx.restore();

      ctx.fillStyle = 'rgba(255,225,120,0.12)';
      ctx.fillRect(px + 2, canvas.height * 0.45, cellWidth - 4, canvas.height * 0.10);

      ctx.fillStyle = 'rgba(54, 255, 43, 0.52)';
      ctx.fillRect(playhead * cellWidth, 0, cellWidth, canvas.height);
    }

    const cornerRadius = 8;
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        const px = x * cellWidth;
        const py = y * cellHeight;
        if (cellStates[x][y]) {
          drawRoundedRect(px + 2, py + 2, cellWidth - 4, cellHeight - 4, cornerRadius, '#6ac2fdff', null);
        } else {
          drawRoundedRect(px + 2, py + 2, cellWidth - 4, cellHeight - 4, cornerRadius, null, '#fff6f6ff');
        }
      }
    }
  }

  // play a specific sound by row name
  function triggerSound(rowName, time) {
    const p = players[rowName];
    if (p && p.buffer) {
      try {
        p.start(time);
        return;
      } catch (err) {
        console.warn(`Player start failed for ${rowName}, falling back to synth:`, err);
      }
    }
    const s = synths[rowName];
    if (!s) return;
    if (rowName === 'kick') s.triggerAttackRelease('C2', '8n', time);
    else if (rowName === 'snare') s.triggerAttackRelease('8n', time);
    else if (rowName === 'hat') s.triggerAttackRelease('16n', time);
    else s.triggerAttackRelease('C4', '8n', time);
  }

  // Sequencer: step through columns at specified subdivision
  const stepInterval = '16n';

  const looper = new Tone.Loop((time) => {
    playhead = (playhead + 1) % cols;
    for (let y = 0; y < rows; y++) {
      if (cellStates[playhead][y]) {
        const rowName = rowSounds[y % rowSounds.length] || 'clav';
        triggerSound(rowName, time);
      }
    }
    requestAnimationFrame(drawGrid);
  }, stepInterval).start(0);

  // start/stop helpers
  let running = false;
  async function startTransport() {
    if (!running) {
      await Tone.start();
      if (!samplesLoaded) {
        const wait = loadSamplesSafe();
        const timeout = new Promise((res) => setTimeout(res, 2000));
        await Promise.race([wait, timeout]);
      }
      Tone.Transport.bpm.value = Number(tempoInput.value) || 120;
      Tone.Transport.start();
      running = true;
    }
  }

  function stopTransport() {
    if (running) {
      Tone.Transport.stop();
      running = false;
      playhead = -1;
      drawGrid();
    }
  }

  const drumbtn = document.querySelector('.drum-btn');

  // wire UI
  if(drumbtn){
    drumbtn.addEventListener('click', async () => {
      if (!running){ 
        await startTransport();
        drumbtn.classList.add('highlight');
      }
      else {
        stopTransport();
        drumbtn.classList.remove('highlight');
      }
    });
  }

  // ========== GENERATE DRUMS BUTTON ==========
  const generateBtn = document.getElementById('generate-drums');
  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
      if (!drumsRNNReady) {
        alert('DrumsRNN is still loading, please wait...');
        return;
      }
      
      // Get temperature from slider or use default
      const tempSlider = document.getElementById('drum-temperature');
      const temperature = tempSlider ? parseFloat(tempSlider.value) : 1.0;
      
      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating...';
      
      await generateDrumPattern(temperature, cols);
      
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate AI Drums';
    });
  }

  tempoInput.addEventListener('change', () => {
    const v = Number(tempoInput.value);
    if (!isNaN(v) && v > 0) Tone.Transport.bpm.value = v;
  });

  // toggle cells on click
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellWidth);
    const y = Math.floor((e.clientY - rect.top) / cellHeight);
    if (x >= cols || y >= rows) return;
    cellStates[x][y] = !cellStates[x][y];
    drawGrid();
  });

  // initialize
  await loadSamplesSafe();
  
  // Initialize DrumsRNN (non-blocking)
  initDrumsRNN().catch(err => console.error('DrumsRNN init error:', err));
  
  drawGrid();
};
