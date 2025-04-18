class VoiceRecorder {
  constructor() {
    this.recording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recordingTimeout = null;
    this.maxRecordingTime = 120000; // 2 minutes max
    
    this.voiceBtn = document.querySelector('.voice-btn');
    this.sendBtn = document.querySelector('.send-btn');
    this.messageInput = document.getElementById('message-input');
    this.recordingUI = document.querySelector('.recording-ui');
    this.cancelRecordingBtn = document.querySelector('.cancel-recording-btn');
    this.messageForm = document.getElementById('message-form');
    
    this.init();
  }

  init() {
    if (!this.voiceBtn) return;
    
    // Check for microphone support
    this.hasMicrophoneAccess().then(hasAccess => {
      if (hasAccess) {
        this.setupEventListeners();
      } else {
        this.voiceBtn.style.display = 'none';
      }
    });
  }

  async hasMicrophoneAccess() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  setupEventListeners() {
    // Press and hold to record
    this.voiceBtn.addEventListener('mousedown', this.startRecording.bind(this));
    this.voiceBtn.addEventListener('touchstart', this.startRecording.bind(this));
    
    // Release to send
    this.voiceBtn.addEventListener('mouseup', this.stopRecording.bind(this));
    this.voiceBtn.addEventListener('touchend', this.stopRecording.bind(this));
    this.voiceBtn.addEventListener('mouseleave', this.stopRecording.bind(this));
    
    // Cancel recording
    this.cancelRecordingBtn.addEventListener('click', this.cancelRecording.bind(this));
    
    // Keyboard alternative for accessibility
    this.voiceBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.startRecording();
      }
    });
    
    this.voiceBtn.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.stopRecording();
      }
    });
  }

  async startRecording(e) {
    if (e) e.preventDefault();
    if (this.recording) return;
    
    try {
      // Show recording UI
      this.messageInput.style.display = 'none';
      this.recordingUI.style.display = 'flex';
      this.sendBtn.disabled = true;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        await this.processRecording(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.recording = true;
      
      // Start recording timeout
      this.recordingTimeout = setTimeout(() => {
        this.stopRecording();
      }, this.maxRecordingTime);
      
    } catch (error) {
      console.error('Recording error:', error);
      this.resetRecordingUI();
      alert('Could not access microphone. Please check permissions.');
    }
  }

  stopRecording(e) {
    if (e) e.preventDefault();
    if (!this.recording || !this.mediaRecorder) return;
    
    clearTimeout(this.recordingTimeout);
    this.mediaRecorder.stop();
    this.recording = false;
  }

  cancelRecording(e) {
    if (e) e.preventDefault();
    if (!this.recording) return;
    
    clearTimeout(this.recordingTimeout);
    this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    this.resetRecordingUI();
    this.recording = false;
  }

  async processRecording(audioBlob) {
    try {
      // Show uploading state
      this.recordingUI.querySelector('span').textContent = 'Sending...';
      
      // Convert to MP3 for better compatibility
      const mp3Blob = await this.convertToMP3(audioBlob);
      
      // Create FormData and send to server
      const formData = new FormData();
      formData.append('voice', mp3Blob, `voice-${Date.now()}.mp3`);
      formData.append('sender', document.getElementById('currentUser').value);
      formData.append('receiver', document.getElementById('friendUser').value);
      formData.append('username', document.getElementById('currentUsername').value);
      
      const response = await fetch('/api/voice-message', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Failed to send voice message');
      
      // Reset UI
      this.resetRecordingUI();
      
    } catch (error) {
      console.error('Error processing recording:', error);
      this.resetRecordingUI();
      alert('Failed to send voice message. Please try again.');
    }
  }

  async convertToMP3(blob) {
    // In a real app, you might use a library like lamejs or a WebAssembly module
    // For simplicity, we'll just use the original here
    return blob;
  }

  resetRecordingUI() {
    this.messageInput.style.display = 'block';
    this.recordingUI.style.display = 'none';
    this.recordingUI.querySelector('span').textContent = 'Recording...';
    this.sendBtn.disabled = false;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.voice-btn')) {
    new VoiceRecorder();
  }
});