# MIDI Keyboard Setup Guide

## Overview
This Music Generator now supports external MIDI keyboards! Connect your MIDI keyboard to your computer and play along with the AI-generated harmonies.

## Features

### ✅ What's New
- **External MIDI Keyboard Support**: Play notes directly from your MIDI keyboard
- **Device Name Display**: See which MIDI device is connected in real-time
- **Visual Feedback**: The on-screen keyboard highlights when you play notes
- **Automatic Detection**: Automatically detects when devices connect/disconnect
- **Multiple Device Support**: Works with multiple MIDI keyboards simultaneously

## How to Use

### 1. Connect Your MIDI Keyboard
- Plug your MIDI keyboard into your computer via USB or MIDI interface
- Make sure your keyboard is powered on

### 2. Open the Application
- Open `index.html` in a modern web browser (Chrome, Edge, or Opera recommended)
- The browser may ask for MIDI access permission - click **Allow**

### 3. Check Connection Status
- Look for the MIDI status indicator in the "Human" section (below the controls)
- If connected, you'll see: `🔌 Connected: [Your Keyboard Name]`
- If not connected, you'll see: `🔌 No MIDI device connected`

### 4. Start Playing!
- Play notes on your MIDI keyboard
- The on-screen keyboard will highlight the keys you press in green
- The AI will generate harmonies based on your playing
- Adjust tempo, temperature, and genre settings to customize the experience

## Browser Compatibility

### ✅ Fully Supported
- Google Chrome (recommended)
- Microsoft Edge
- Opera
- Brave

### ⚠️ Limited/No Support
- Firefox (Web MIDI API not enabled by default)
- Safari (requires macOS 12+ and may have limitations)

## Troubleshooting

### "No MIDI device connected"
1. **Check physical connection**: Ensure your MIDI keyboard is properly connected
2. **Power on**: Make sure your keyboard is powered on
3. **Reload page**: Refresh the browser page after connecting your device
4. **Browser permissions**: Check that you've allowed MIDI access in your browser

### "Web MIDI API not supported"
- Try using Google Chrome or Microsoft Edge
- Update your browser to the latest version
- For Firefox: Go to `about:config` and enable `dom.webmidi.enabled`

### Notes not playing
1. **Start audio context**: Click anywhere on the page first (browsers require user interaction)
2. **Check volume**: Ensure the "Synth Volume" and "Melody Volume" sliders are not at zero
3. **Wait for loading**: Make sure the "Loading..." indicator has disappeared

### Multiple devices showing
- The app will connect to all available MIDI input devices
- All connected devices will work simultaneously

## Technical Details

### Supported MIDI Messages
- **Note On** (Status: 144-159): Triggers note playback
- **Note Off** (Status: 128-143): Stops note playback
- **Control Change** (Status: 176-191): Logged for future features

### Note Range
- The visual keyboard displays notes from C3 (MIDI 48) to C7 (MIDI 84)
- MIDI notes outside this range will play but won't show visual feedback

### Integration with AI Harmony
- MIDI input is integrated with the existing harmony generation system
- Your played notes serve as seeds for the AI to generate complementary melodies
- Adjust the "Temperature" slider to control harmony creativity

## Files Modified/Added

### Modified Files
- `index.js` - Added MIDI handler code (at the end of the file)
- `index.html` - Added MIDI status display
- `style.css` - Added styling for active keys and MIDI status

## API Reference

The MIDI handler exposes the following global functions:

```javascript
// Initialize MIDI (called automatically)
window.midiHandler.init()

// Manually play a note
window.midiHandler.playNote('C4', 0.8) // Note name, velocity (0-1)

// Stop a note
window.midiHandler.stopNote('C4')

// Get list of connected devices
window.midiHandler.getConnectedDevices() // Returns array of device names
```

## Future Enhancements
- [ ] MIDI controller mapping for knobs/sliders
- [ ] Sustain pedal support
- [ ] MIDI recording and playback
- [ ] Custom note mapping
- [ ] Velocity curves adjustment

## Support
For issues or questions, please check the browser console (F12) for error messages.

---
Enjoy making music with your MIDI keyboard! 🎹🎵
