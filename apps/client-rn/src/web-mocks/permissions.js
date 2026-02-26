// Mock for react-native-permissions
export default {
  PERMISSIONS: {
    ANDROID: {
      CAMERA: 'android.permission.CAMERA',
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
      READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
      WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
    },
    IOS: {
      CAMERA: 'NSCameraUsageDescription',
      MICROPHONE: 'NSMicrophoneUsageDescription',
      PHOTO_LIBRARY: 'NSPhotoLibraryUsageDescription',
    },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    UNAVAILABLE: 'unavailable',
    LIMITED: 'limited',
  },
  check: async (permission) => 'granted',
  request: async (permission) => 'granted',
  requestMultiple: async (permissions) => permissions.reduce((acc, p) => ({ ...acc, [p]: 'granted' }), {}),
};
