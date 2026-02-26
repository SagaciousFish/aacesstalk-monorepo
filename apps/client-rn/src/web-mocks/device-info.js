// Mock for react-native-device-info
export default {
  getUniqueId: () => 'web-device-id',
  getDeviceName: () => 'Web Browser',
  getModel: () => 'Web',
  getSystemName: () => 'Web',
  getSystemVersion: () => '1.0',
  getVersion: () => '1.0.0',
  getBuildNumber: () => '1',
  isTablet: () => false,
  isPhone: () => true,
  isEmulator: () => false,
  isEmulatorSync: () => false,
};
