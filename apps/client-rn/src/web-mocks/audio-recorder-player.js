// Web Audio API implementation for react-native-audio-recorder-player
// Provides recording and playback functionality using Web Audio API

class AudioRecorderPlayer {
  constructor() {
    this.audioRecorder = null;
    this.audioPlayer = null;
    this.mediaStream = null;
    this.recordBack = null;
    this.playBack = null;
    this.startTime = 0;
    this.pausedDuration = 0;
    this.pauseStartTime = null;
    this.isPlaying = false;
    this.isRecording = false;
    this.isPaused = false;
    this.recordInterval = null;
    this.playInterval = null;
    this.subscriptionDuration = 100; // ms, default 0.1s
    this._recordedChunks = [];
    this._recordedBlob = null;
    this._recordedUrl = null;
  }

  setSubscriptionDuration(durationSeconds) {
    this.subscriptionDuration = Math.round(durationSeconds * 1000);
  }

  async startRecorder(path, audioSet, callback) {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioRecorder = new MediaRecorder(this.mediaStream);
      this.recordBack = callback || null;
      this.startTime = Date.now();
      this.pausedDuration = 0;
      this.pauseStartTime = null;
      this._recordedChunks = [];
      this._recordedBlob = null;
      this._recordedUrl = null;

      this.audioRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this._recordedChunks.push(e.data);
        }
      };

      // onstop is set lazily by stopRecorder() to guarantee ordering:
      // 1. ondataavailable flushes last chunk
      // 2. onstop builds the Blob and resolves the promise
      this.audioRecorder.onstop = null;

      this.audioRecorder.start();
      this.isRecording = true;
      this.isPaused = false;

      // Start interval for position updates
      this._startRecordInterval();

      return path || 'web-recording.webm';
    } catch (error) {
      console.error('startRecorder error:', error);
      throw error;
    }
  }

  _startRecordInterval() {
    if (this.recordInterval) {
      clearInterval(this.recordInterval);
    }
    this.recordInterval = setInterval(() => {
      if (this.isRecording && !this.isPaused && this.recordBack) {
        const elapsed = (Date.now() - this.startTime) - this.pausedDuration;
        this.recordBack({
          currentPosition: elapsed,
          duration: elapsed,
          currentMetering: -30, // approximate metering value
        });
      }
    }, this.subscriptionDuration);
  }

  async pauseRecorder() {
    return new Promise((resolve, reject) => {
      if (this.audioRecorder && this.isRecording && !this.isPaused) {
        try {
          this.audioRecorder.pause();
          this.isPaused = true;
          this.pauseStartTime = Date.now();
          resolve('paused');
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('Not recording or already paused'));
      }
    });
  }

  async resumeRecorder() {
    return new Promise((resolve, reject) => {
      if (this.audioRecorder && this.isRecording && this.isPaused) {
        try {
          this.audioRecorder.resume();
          this.isPaused = false;
          if (this.pauseStartTime != null) {
            this.pausedDuration += Date.now() - this.pauseStartTime;
            this.pauseStartTime = null;
          }
          resolve('resumed');
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('Not paused'));
      }
    });
  }

  async stopRecorder() {
    return new Promise((resolve, reject) => {
      if (this.audioRecorder && this.isRecording) {
        if (this.recordInterval) {
          clearInterval(this.recordInterval);
          this.recordInterval = null;
        }

        this.isRecording = false;
        this.isPaused = false;

        // Set onstop here so it runs after all ondataavailable events,
        // guaranteeing the Blob is built before we resolve.
        this.audioRecorder.onstop = () => {
          const blob = new Blob(this._recordedChunks, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          this._recordedBlob = blob;
          this._recordedUrl = url;

          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
          }

          resolve(url);
        };

        this.audioRecorder.stop();
      } else {
        reject(new Error('Not recording'));
      }
    });
  }

  async startPlayer(path, callback) {
    try {
      this.audioPlayer = new Audio(path);
      this.playBack = callback || null;
      this.startTime = Date.now();
      this.isPlaying = true;

      this.audioPlayer.onended = () => {
        this.isPlaying = false;
        if (this.playInterval) {
          clearInterval(this.playInterval);
          this.playInterval = null;
        }
        if (this.playBack) {
          this.playBack({
            currentPosition: 0,
            duration: 0,
          });
        }
      };

      this.audioPlayer.onloadedmetadata = () => {
        if (this.playBack) {
          this.playBack({
            currentPosition: 0,
            duration: this.audioPlayer.duration * 1000,
          });
        }
      };

      await this.audioPlayer.play();

      // Start interval for position updates
      if (this.playBack) {
        this.playInterval = setInterval(() => {
          if (this.isPlaying && this.audioPlayer && this.playBack) {
            this.playBack({
              currentPosition: this.audioPlayer.currentTime * 1000,
              duration: (this.audioPlayer.duration || 0) * 1000,
            });
          }
        }, this.subscriptionDuration);
      }

      return path;
    } catch (error) {
      console.error('startPlayer error:', error);
      throw error;
    }
  }

  async stopPlayer() {
    return new Promise((resolve) => {
      if (this.audioPlayer) {
        this.audioPlayer.pause();
        this.audioPlayer.currentTime = 0;
        this.isPlaying = false;

        if (this.playInterval) {
          clearInterval(this.playInterval);
          this.playInterval = null;
        }
      }
      resolve();
    });
  }

  async pausePlayer() {
    return new Promise((resolve) => {
      if (this.audioPlayer) {
        this.audioPlayer.pause();
        this.isPlaying = false;
      }
      resolve();
    });
  }

  async resumePlayer() {
    return new Promise(async (resolve) => {
      if (this.audioPlayer) {
        await this.audioPlayer.play();
        this.isPlaying = true;
      }
      resolve();
    });
  }

  setVolume(volume) {
    if (this.audioPlayer) {
      this.audioPlayer.volume = Math.max(0, Math.min(1, volume));
    }
  }

  addRecordBackListener(callback) {
    this.recordBack = callback;
  }

  addPlayBackListener(callback) {
    this.playBack = callback;
  }

  removeRecordBackListener() {
    this.recordBack = null;
  }

  removePlayBackListener() {
    this.playBack = null;
  }

  async addPlayBackListenerCallback(callback) {
    this.playBack = callback;
  }

  async addRecordBackListenerCallback(callback) {
    this.recordBack = callback;
  }
}

export default new AudioRecorderPlayer();

// Android Audio Constants
export const AudioEncoderAndroidType = {
  AAC: 3,
  AMR: 1,
  AMR_WB: 2,
  DEFAULT: 3,
  HE_AAC: 5,
  AAC_HE_V2: 7,
};

export const AudioSourceAndroidType = {
  CAMCORDER: 5,
  DEFAULT: 0,
  MIC: 1,
  REMOTE_SUBMIX: 8,
  VOICE_CALL: 4,
  VOICE_COMMUNICATION: 7,
  VOICE_DOWNLINK: 4,
  VOICE_RECOGNITION: 6,
  VOICE_UPLINK: 4,
};

export const OutputFormatAndroidType = {
  AAC_ADTS: 6,
  AMR_WB: 4,
  DEFAULT: 0,
  MPEG_4: 2,
  THREE_GPP: 1,
  WEBM: 11,
};

// iOS Audio Constants
export const AVModeIOSOption = {
  default: 0,
  measurement: 6,
  playback: 1,
  voicePrompt: 2,
};

export const AVEncoderAudioQualityIOSType = {
  high: 96,
  low: 60,
  max: 100,
  medium: 75,
  min: 0,
};

export const AVEncodingOption = {
  aac: 1633772320,
  alac: 1633772321,
  amr: 1633771456,
  amr_WB: 1633771457,
  he_aac: 1633772322,
  he_aac_v2: 1633772323,
  lpcm: 1633772368,
  mp4a: 1633772320,
  mp4v: 1633772570,
  wav: 1633721204,
};

// AudioSet type helper
export const AudioSet = {};
