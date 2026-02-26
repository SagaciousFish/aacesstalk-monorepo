// Web Audio API implementation for react-native-sound-player
// Provides audio playback functionality using Web Audio API

class SoundPlayer {
  constructor() {
    this.audio = null;
    this.currentSource = '';
    this.onLoadCallback = null;
    this.onProgressCallback = null;
    this.onFinishCallback = null;
    this.onErrorCallback = null;
    this.progressInterval = null;

    // Bind event handlers
    this.handleLoadedMetadata = this.handleLoadedMetadata.bind(this);
    this.handleEnded = this.handleEnded.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
  }

  handleLoadedMetadata() {
    if (this.audio && this.onLoadCallback) {
      this.onLoadCallback(this.audio.duration * 1000);
    }
  }

  handleEnded() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    if (this.onFinishCallback) {
      this.onFinishCallback();
    }
  }

  handleError(error) {
    console.error('SoundPlayer error:', error);
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
  }

  handleTimeUpdate() {
    if (this.audio && this.onProgressCallback) {
      this.onProgressCallback(
        this.audio.currentTime * 1000,
        (this.audio.duration || 0) * 1000
      );
    }
  }

  loadUrl(url, onLoad, onError) {
    // Clean up previous audio
    if (this.audio) {
      this.audio.pause();
      this.audio.removeEventListener('loadedmetadata', this.handleLoadedMetadata);
      this.audio.removeEventListener('ended', this.handleEnded);
      this.audio.removeEventListener('error', this.handleError);
      this.audio.removeEventListener('timeupdate', this.handleTimeUpdate);
    }

    this.audio = new Audio(url);
    this.currentSource = url;
    this.onLoadCallback = onLoad || null;
    this.onErrorCallback = onError || null;

    this.audio.addEventListener('loadedmetadata', this.handleLoadedMetadata);
    this.audio.addEventListener('ended', this.handleEnded);
    this.audio.addEventListener('error', this.handleError);
    this.audio.addEventListener('timeupdate', this.handleTimeUpdate);

    // Also try to load immediately in case the metadata is already available
    this.audio.load();
  }

  play(onFinish, onError) {
    if (!this.audio) {
      if (onError) {
        onError(new Error('No audio loaded'));
      }
      return;
    }

    if (onFinish) {
      this.onFinishCallback = onFinish;
    }
    if (onError) {
      this.onErrorCallback = onError;
    }

    this.audio.play().catch((error) => {
      console.error('Play error:', error);
      if (onError) {
        onError(error);
      }
    });

    // Start progress interval
    this.progressInterval = setInterval(() => {
      this.handleTimeUpdate();
    }, 100);
  }

  pause() {
    if (this.audio) {
      this.audio.pause();
      if (this.progressInterval) {
        clearInterval(this.progressInterval);
        this.progressInterval = null;
      }
    }
  }

  resume() {
    if (this.audio) {
      this.audio.play().catch(console.error);
    }
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      if (this.progressInterval) {
        clearInterval(this.progressInterval);
        this.progressInterval = null;
      }
    }
  }

  setVolume(volume) {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  getDuration(callback) {
    if (this.audio && this.audio.duration) {
      callback(this.audio.duration * 1000);
    } else {
      this.onLoadCallback = callback;
    }
  }

  getCurrentTime(callback) {
    if (this.audio) {
      callback(this.audio.currentTime * 1000);
    }
  }

  seekTo(time) {
    if (this.audio) {
      this.audio.currentTime = time / 1000;
    }
  }

  addEventListener(event, callback) {
    if (!this.audio) return;

    switch (event) {
      case 'loaded':
        this.audio.addEventListener('loadedmetadata', () => callback());
        break;
      case 'progress':
        this.audio.addEventListener('timeupdate', () => callback());
        break;
      case 'end':
      case 'finished':
        this.audio.addEventListener('ended', () => callback());
        break;
      case 'error':
        this.audio.addEventListener('error', (e) => callback(e));
        break;
    }
  }

  removeEventListener(event, callback) {
    if (!this.audio) return;
    this.audio.removeEventListener(event, callback);
  }

  onProgress(callback) {
    this.onProgressCallback = callback;
  }

  onLoad(callback) {
    this.onLoadCallback = callback;
  }

  onFinish(callback) {
    this.onFinishCallback = callback;
  }

  onError(callback) {
    this.onErrorCallback = callback;
  }
}

export default new SoundPlayer();
