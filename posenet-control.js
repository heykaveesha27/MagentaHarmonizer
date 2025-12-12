// ============================================================================
// ENHANCED POSENET CONTROL - Drum Pattern Generation & Volume Control
// ============================================================================

let poseNet;
let video;
let canvas;
let ctx;
let poses = [];
let isWebcamActive = false;
let controlMode = 'volume'; // 'volume', 'drum-generate', 'drum-trigger'

// Smoothing and gesture detection
let smoothedLeftWrist = { x: 0, y: 0 };
let smoothedRightWrist = { x: 0, y: 0 };
let smoothedLeftShoulder = { x: 0, y: 0 };
let smoothedRightShoulder = { x: 0, y: 0 };
const SMOOTHING_FACTOR = 0.3;

// Gesture detection state
let gestureState = {
    lastGenerateTime: 0,
    generateCooldown: 2000, // 2 seconds between generations
    handsUpDetected: false,
    handsUpStartTime: 0,
    handsUpDuration: 1000, // Hold hands up for 1 second to generate
    lastVolume: { drums: 0.7, synth: 0.6, melody: 0.6 },
    drumTriggerHistory: [], // Track recent drum triggers
    lastDrumTrigger: 0,
    drumTriggerCooldown: 300 // 300ms between drum hits
};

// Initialize PoseNet
async function initPoseNet() {
    try {
        const statusEl = document.getElementById('poseStatus');
        statusEl.textContent = 'Loading PoseNet model...';
        statusEl.style.color = '#f59e0b';

        // Load PoseNet with optimized settings
        poseNet = await posenet.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            inputResolution: { width: 640, height: 480 },
            multiplier: 0.75
        });

        statusEl.textContent = 'PoseNet loaded! Click "Start Body Control"';
        statusEl.style.color = '#4CAF50';
        
        console.log('✅ PoseNet model loaded successfully');
        return true;
    } catch (error) {
        console.error('❌ Error loading PoseNet:', error);
        const statusEl = document.getElementById('poseStatus');
        statusEl.textContent = 'Error loading PoseNet model';
        statusEl.style.color = '#ef4444';
        return false;
    }
}

// Start webcam
async function startWebcam() {
    try {
        video = document.getElementById('webcam');
        canvas = document.getElementById('output');
        ctx = canvas.getContext('2d');

        const statusEl = document.getElementById('poseStatus');
        statusEl.textContent = 'Starting camera...';
        statusEl.style.color = '#f59e0b';

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: false
        });

        video.srcObject = stream;
        
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                resolve();
            };
        });

        isWebcamActive = true;
        statusEl.textContent = '🎥 Body control active - Use gestures!';
        statusEl.style.color = '#4CAF50';

        detectPose();
        
        console.log('✅ Webcam started successfully');
        return true;
    } catch (error) {
        console.error('❌ Error starting webcam:', error);
        const statusEl = document.getElementById('poseStatus');
        statusEl.textContent = 'Camera access denied or unavailable';
        statusEl.style.color = '#ef4444';
        return false;
    }
}

// Stop webcam
function stopWebcam() {
    if (video && video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
    
    isWebcamActive = false;
    poses = [];
    
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    const statusEl = document.getElementById('poseStatus');
    statusEl.textContent = 'Camera stopped';
    statusEl.style.color = '#888';
    
    console.log('🛑 Webcam stopped');
}

// Main pose detection loop
async function detectPose() {
    if (!isWebcamActive || !video || !poseNet) return;

    try {
        const pose = await poseNet.estimateSinglePose(video, {
            flipHorizontal: true
        });

        poses = [pose];
        drawPose(pose);
        applyPoseControl(pose);

    } catch (error) {
        console.warn('Pose detection error:', error);
    }

    if (isWebcamActive) {
        requestAnimationFrame(detectPose);
    }
}

// Draw pose visualization
function drawPose(pose) {
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw video frame (mirrored)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    if (pose.score < 0.2) return;

    const minConfidence = 0.3;

    // Draw skeleton
    const adjacentKeyPoints = posenet.getAdjacentKeyPoints(
        pose.keypoints,
        minConfidence
    );

    ctx.strokeStyle = '#39bdf8';
    ctx.lineWidth = 3;

    adjacentKeyPoints.forEach(([from, to]) => {
        ctx.beginPath();
        ctx.moveTo(from.position.x, from.position.y);
        ctx.lineTo(to.position.x, to.position.y);
        ctx.stroke();
    });

    // Draw keypoints with special colors
    pose.keypoints.forEach(keypoint => {
        if (keypoint.score >= minConfidence) {
            // Wrists in red, shoulders in blue, others in green
            if (keypoint.part.includes('wrist')) {
                ctx.fillStyle = '#ef4444';
            } else if (keypoint.part.includes('shoulder')) {
                ctx.fillStyle = '#3b82f6';
            } else {
                ctx.fillStyle = '#4CAF50';
            }
            
            ctx.beginPath();
            ctx.arc(keypoint.position.x, keypoint.position.y, 8, 0, 2 * Math.PI);
            ctx.fill();

            // Label key points
            if (keypoint.part.includes('wrist') || keypoint.part.includes('shoulder')) {
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px Arial';
                ctx.fillText(
                    keypoint.part.replace('Wrist', 'W').replace('Shoulder', 'S'),
                    keypoint.position.x + 12,
                    keypoint.position.y - 10
                );
            }
        }
    });

    drawControlVisualization(pose);
    drawGestureIndicators(pose);
}

// Draw control visualization
function drawControlVisualization(pose) {
    const leftWrist = pose.keypoints.find(kp => kp.part === 'leftWrist');
    const rightWrist = pose.keypoints.find(kp => kp.part === 'rightWrist');

    if (!leftWrist || !rightWrist || leftWrist.score < 0.3 || rightWrist.score < 0.3) {
        return;
    }

    // Draw line between wrists
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(leftWrist.position.x, leftWrist.position.y);
    ctx.lineTo(rightWrist.position.x, rightWrist.position.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Show control value
    const midX = (leftWrist.position.x + rightWrist.position.x) / 2;
    const midY = (leftWrist.position.y + rightWrist.position.y) / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(midX - 80, midY - 35, 160, 40);

    ctx.fillStyle = '#39bdf8';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`MODE: ${controlMode.toUpperCase()}`, midX, midY - 10);
}

// Draw gesture indicators
function drawGestureIndicators(pose) {
    // Top-left corner: Gesture hints
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 280, 120);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('GESTURES:', 20, 30);
    
    ctx.font = '12px Arial';
    ctx.fillStyle = '#a0a0a0';
    
    if (controlMode === 'volume') {
        ctx.fillText('• Spread hands = Volume UP', 20, 50);
        ctx.fillText('• Close hands = Volume DOWN', 20, 70);
        ctx.fillText('• Left hand height = Drum gain', 20, 90);
        ctx.fillText('• Right hand height = Melody gain', 20, 110);
    } else if (controlMode === 'drum-generate') {
        ctx.fillText('• Raise BOTH hands UP', 20, 50);
        ctx.fillText('• Hold for 1 second', 20, 70);
        ctx.fillText('• = Generate drum pattern!', 20, 90);
        
        // Show cooldown timer
        const timeSinceGenerate = Date.now() - gestureState.lastGenerateTime;
        const cooldownRemaining = Math.max(0, gestureState.generateCooldown - timeSinceGenerate);
        if (cooldownRemaining > 0) {
            ctx.fillStyle = '#f59e0b';
            ctx.fillText(`Cooldown: ${(cooldownRemaining / 1000).toFixed(1)}s`, 20, 110);
        }
    } else if (controlMode === 'drum-trigger') {
        ctx.fillText('• Raise left hand = Kick', 20, 50);
        ctx.fillText('• Raise right hand = Snare', 20, 70);
        ctx.fillText('• Both hands up = Hi-hat', 20, 90);
        ctx.fillText('• Clap hands = Clap sound', 20, 110);
    }
}

// Apply pose control based on mode
function applyPoseControl(pose) {
    const leftWrist = pose.keypoints.find(kp => kp.part === 'leftWrist');
    const rightWrist = pose.keypoints.find(kp => kp.part === 'rightWrist');
    const leftShoulder = pose.keypoints.find(kp => kp.part === 'leftShoulder');
    const rightShoulder = pose.keypoints.find(kp => kp.part === 'rightShoulder');

    if (!leftWrist || !rightWrist || leftWrist.score < 0.3 || rightWrist.score < 0.3) {
        return;
    }

    // Smooth positions
    smoothedLeftWrist.x = lerp(smoothedLeftWrist.x, leftWrist.position.x, SMOOTHING_FACTOR);
    smoothedLeftWrist.y = lerp(smoothedLeftWrist.y, leftWrist.position.y, SMOOTHING_FACTOR);
    smoothedRightWrist.x = lerp(smoothedRightWrist.x, rightWrist.position.x, SMOOTHING_FACTOR);
    smoothedRightWrist.y = lerp(smoothedRightWrist.y, rightWrist.position.y, SMOOTHING_FACTOR);

    if (leftShoulder && rightShoulder) {
        smoothedLeftShoulder.x = lerp(smoothedLeftShoulder.x, leftShoulder.position.x, SMOOTHING_FACTOR);
        smoothedLeftShoulder.y = lerp(smoothedLeftShoulder.y, leftShoulder.position.y, SMOOTHING_FACTOR);
        smoothedRightShoulder.x = lerp(smoothedRightShoulder.x, rightShoulder.position.x, SMOOTHING_FACTOR);
        smoothedRightShoulder.y = lerp(smoothedRightShoulder.y, rightShoulder.position.y, SMOOTHING_FACTOR);
    }

    // Apply different controls based on mode
    switch (controlMode) {
        case 'volume':
            controlVolumeGesture();
            break;
        case 'drum-generate':
            controlDrumGeneration();
            break;
        case 'drum-trigger':
            controlDrumTrigger();
            break;
    }
}

// ============================================================================
// VOLUME CONTROL WITH GESTURES
// ============================================================================

function controlVolumeGesture() {
    // Hand spread controls master volume
    const distance = Math.sqrt(
        Math.pow(smoothedRightWrist.x - smoothedLeftWrist.x, 2) +
        Math.pow(smoothedRightWrist.y - smoothedLeftWrist.y, 2)
    );
    
    const maxDistance = 500;
    const masterVolume = Math.min(1, distance / maxDistance);
    
    // Update drums master volume
    const drumsSlider = document.getElementById('drums-all');
    if (drumsSlider && Math.abs(parseFloat(drumsSlider.value) - masterVolume) > 0.02) {
        drumsSlider.value = masterVolume.toFixed(2);
        drumsSlider.dispatchEvent(new Event('input'));
        gestureState.lastVolume.drums = masterVolume;
    }
    
    // Left hand height controls synth volume
    const leftHandHeight = 1 - (smoothedLeftWrist.y / canvas.height);
    const synthVolume = Math.max(0, Math.min(1, leftHandHeight));
    
    const synthSlider = document.getElementById('synthvol');
    if (synthSlider && Math.abs(parseFloat(synthSlider.value) - synthVolume) > 0.02) {
        synthSlider.value = synthVolume.toFixed(2);
        synthSlider.dispatchEvent(new Event('input'));
        gestureState.lastVolume.synth = synthVolume;
    }
    
    // Right hand height controls melody volume
    const rightHandHeight = 1 - (smoothedRightWrist.y / canvas.height);
    const melodyVolume = Math.max(0, Math.min(1, rightHandHeight));
    
    const melodySlider = document.getElementById('melody');
    if (melodySlider && Math.abs(parseFloat(melodySlider.value) - melodyVolume) > 0.02) {
        melodySlider.value = melodyVolume.toFixed(2);
        melodySlider.dispatchEvent(new Event('input'));
        gestureState.lastVolume.melody = melodyVolume;
    }
}

// ============================================================================
// DRUM PATTERN GENERATION WITH GESTURES
// ============================================================================

function controlDrumGeneration() {
    // Check if both hands are raised above shoulders
    const leftHandRaised = smoothedLeftWrist.y < smoothedLeftShoulder.y - 50;
    const rightHandRaised = smoothedRightWrist.y < smoothedRightShoulder.y - 50;
    
    const bothHandsUp = leftHandRaised && rightHandRaised;
    
    // Visual feedback - draw indicator when hands are up
    if (bothHandsUp) {
        if (!gestureState.handsUpDetected) {
            gestureState.handsUpDetected = true;
            gestureState.handsUpStartTime = Date.now();
        }
        
        const holdDuration = Date.now() - gestureState.handsUpStartTime;
        const progress = Math.min(1, holdDuration / gestureState.handsUpDuration);
        
        // Draw progress circle
        const centerX = canvas.width / 2;
        const centerY = 100;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, 40, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, 40, -Math.PI / 2, -Math.PI / 2 + (2 * Math.PI * progress));
        ctx.strokeStyle = '#39bdf8';
        ctx.lineWidth = 6;
        ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('HOLD...', centerX, centerY + 5);
        
        // Check if gesture completed
        if (holdDuration >= gestureState.handsUpDuration) {
            const timeSinceGenerate = Date.now() - gestureState.lastGenerateTime;
            if (timeSinceGenerate >= gestureState.generateCooldown) {
                triggerDrumGeneration();
                gestureState.lastGenerateTime = Date.now();
                gestureState.handsUpDetected = false;
            }
        }
    } else {
        gestureState.handsUpDetected = false;
    }
}

function triggerDrumGeneration() {
    console.log('🎵 Gesture detected: Generating drum pattern!');
    
    // Visual feedback
    showGenerationFeedback();
    
    // Trigger drum generation
    const generateBtn = document.getElementById('generate-drums');
    if (generateBtn && !generateBtn.disabled) {
        generateBtn.click();
    } else if (window.drumRNNAPI && window.drumRNNAPI.isReady()) {
        window.drumRNNAPI.generate(1.0, 32);
    }
}

function showGenerationFeedback() {
    // Flash effect on canvas
    const originalFill = ctx.fillStyle;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    setTimeout(() => {
        ctx.fillStyle = originalFill;
    }, 200);
    
    // Status message
    const statusEl = document.getElementById('poseStatus');
    const originalText = statusEl.textContent;
    statusEl.textContent = '✨ Drum pattern generated!';
    statusEl.style.color = '#4CAF50';
    
    setTimeout(() => {
        statusEl.textContent = originalText;
        statusEl.style.color = '#888';
    }, 2000);
}

// ============================================================================
// DRUM TRIGGERING WITH GESTURES
// ============================================================================

function controlDrumTrigger() {
    const now = Date.now();
    
    // Check if hands are raised
    const leftHandRaised = smoothedLeftWrist.y < smoothedLeftShoulder.y - 30;
    const rightHandRaised = smoothedRightWrist.y < smoothedRightShoulder.y - 30;
    
    // Check hand distance (for clap gesture)
    const handDistance = Math.sqrt(
        Math.pow(smoothedRightWrist.x - smoothedLeftWrist.x, 2) +
        Math.pow(smoothedRightWrist.y - smoothedLeftWrist.y, 2)
    );
    
    const handsClose = handDistance < 100;
    
    // Cooldown check
    if (now - gestureState.lastDrumTrigger < gestureState.drumTriggerCooldown) {
        return;
    }
    
    // Trigger drums based on gestures
    if (leftHandRaised && rightHandRaised && handsClose) {
        // Both hands together = Clap
        triggerDrum('clap');
        gestureState.lastDrumTrigger = now;
    } else if (leftHandRaised && rightHandRaised) {
        // Both hands up = Hi-hat
        triggerDrum('hat');
        gestureState.lastDrumTrigger = now;
    } else if (leftHandRaised) {
        // Left hand = Kick
        triggerDrum('kick');
        gestureState.lastDrumTrigger = now;
    } else if (rightHandRaised) {
        // Right hand = Snare
        triggerDrum('snare');
        gestureState.lastDrumTrigger = now;
    }
}

function triggerDrum(drumName) {
    console.log(`🥁 Gesture triggered: ${drumName}`);
    
    // Visual feedback
    showDrumTriggerFeedback(drumName);
    
    // Trigger the drum sample
    if (typeof window.players !== 'undefined' && window.players[drumName]) {
        try {
            window.players[drumName].start();
        } catch (error) {
            console.warn(`Could not trigger ${drumName}:`, error);
        }
    }
}

function showDrumTriggerFeedback(drumName) {
    // Flash color based on drum
    const colors = {
        kick: '#ef4444',
        snare: '#3b82f6',
        hat: '#10b981',
        clap: '#f59e0b'
    };
    
    const color = colors[drumName] || '#fff';
    
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function lerp(start, end, factor) {
    return start + (end - start) * factor;
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    const startBtn = document.getElementById('startPoseNet');
    const stopBtn = document.getElementById('stopPoseNet');
    const modeSelect = document.getElementById('poseControlMode');

    // Initialize PoseNet model on page load
    await initPoseNet();

    // Start button
    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            const success = await startWebcam();
            if (success) {
                startBtn.style.display = 'none';
                stopBtn.style.display = 'inline-block';
            }
        });
    }

    // Stop button
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            stopWebcam();
            stopBtn.style.display = 'none';
            startBtn.style.display = 'inline-block';
        });
    }

    // Control mode selector
    if (modeSelect) {
        modeSelect.addEventListener('change', (e) => {
            controlMode = e.target.value;
            console.log('🎛️ Control mode changed to:', controlMode);
            
            // Reset gesture state when changing modes
            gestureState.handsUpDetected = false;
            gestureState.lastDrumTrigger = 0;
        });
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (isWebcamActive) {
        stopWebcam();
    }
});

console.log('🎭 Enhanced PoseNet Drum & Volume Control loaded');