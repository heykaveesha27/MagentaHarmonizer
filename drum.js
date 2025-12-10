

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
  //makeSynths();
  
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

    const cornerRadius = 8; // change this to increase/decrease corner rounding
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        const px = x * cellWidth;
        const py = y * cellHeight;
        if (cellStates[x][y]) {
          drawRoundedRect(px + 2, py + 2, cellWidth - 4, cellHeight - 4, cornerRadius, '#6ac2fdff', null);
        } else {
          // background cell (transparent fill, but draw rounded border)
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
        // If player fails (buffer not ready or decode error), fallback to synth
        console.warn(`Player start failed for ${rowName}, falling back to synth:`, err);
      }
    }
    // fallback to synths if no buffer decoded
    const s = synths[rowName];
    if (!s) return;
    if (rowName === 'kick') s.triggerAttackRelease('C2', '8n', time);
    else if (rowName === 'snare') s.triggerAttackRelease('8n', time);
    else if (rowName === 'hat') s.triggerAttackRelease('16n', time);
    else s.triggerAttackRelease('C4', '8n', time);
  }

  // Sequencer: step through columns at specified subdivision
  const stepInterval = '16n'; // each column is an 8th note by default

  const looper = new Tone.Loop((time) => {
    // advance playhead
    playhead = (playhead + 1) % cols;
    // for each row in this column, trigger sound if active
    for (let y = 0; y < rows; y++) {
      if (cellStates[playhead][y]) {
        const rowName = rowSounds[y % rowSounds.length] || 'clav';
        triggerSound(rowName, time);
      }
    }
    // redraw quickly (schedule on next animation frame)
    requestAnimationFrame(drawGrid);
  }, stepInterval).start(0);

  // start/stop helpers
  let running = false;
  async function startTransport() {
    if (!running) {
      await Tone.start();
      // if samples still haven't finished loading, wait a short time so playback doesn't trigger errors
      if (!samplesLoaded) {
        // try to wait for Tone.loaded (but don't block forever)
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
  drawGrid();
};
