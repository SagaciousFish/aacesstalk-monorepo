// Web implementation for react-native-global-keyevent
// Uses browser keyboard events

import React from 'react';

const KeyEvent = {
  // Supported keys
  KEYCODE_0: 7,
  KEYCODE_1: 8,
  KEYCODE_2: 9,
  KEYCODE_3: 10,
  KEYCODE_4: 11,
  KEYCODE_5: 12,
  KEYCODE_6: 13,
  KEYCODE_7: 14,
  KEYCODE_8: 15,
  KEYCODE_9: 16,
  KEYCODE_A: 29,
  KEYCODE_B: 30,
  KEYCODE_C: 31,
  KEYCODE_D: 32,
  KEYCODE_E: 33,
  KEYCODE_F: 34,
  KEYCODE_G: 35,
  KEYCODE_H: 36,
  KEYCODE_I: 37,
  KEYCODE_J: 38,
  KEYCODE_K: 39,
  KEYCODE_L: 40,
  KEYCODE_M: 41,
  KEYCODE_N: 42,
  KEYCODE_O: 43,
  KEYCODE_P: 44,
  KEYCODE_Q: 45,
  KEYCODE_R: 46,
  KEYCODE_S: 47,
  KEYCODE_T: 48,
  KEYCODE_U: 49,
  KEYCODE_V: 50,
  KEYCODE_W: 51,
  KEYCODE_X: 52,
  KEYCODE_Y: 53,
  KEYCODE_Z: 54,

  // Navigation
  KEYCODE_DPAD_UP: 19,
  KEYCODE_DPAD_DOWN: 20,
  KEYCODE_DPAD_LEFT: 21,
  KEYCODE_DPAD_RIGHT: 22,
  KEYCODE_DPAD_CENTER: 23,

  // Media
  KEYCODE_MEDIA_PLAY_PAUSE: 85,
  KEYCODE_MEDIA_STOP: 86,
  KEYCODE_MEDIA_NEXT: 87,
  KEYCODE_MEDIA_PREVIOUS: 88,

  // Special
  KEYCODE_ENTER: 66,
  KEYCODE_ESCAPE: 4,
  KEYCODE_BACKSPACE: 67,
  KEYCODE_TAB: 61,
  KEYCODE_SPACE: 62,
  KEYCODE_PLUS: 81,
  KEYCODE_MINUS: 69,

  // Listener management
  listeners: [],

  // Supported features
  isSupported: true,

  // Get native interface (returns null on web)
  getNativeModule: () => null,

  // Observer pattern for key events
  observers: [],

  // Add key listener
  addListener: function(callback) {
    const listener = {
      callback,
      keyDown: (e) => {
        callback({
          eventType: 'down',
          keyCode: this.mapKeyCode(e.keyCode),
          pressedKey: e.key,
        });
      },
      keyUp: (e) => {
        callback({
          eventType: 'up',
          keyCode: this.mapKeyCode(e.keyCode),
          pressedKey: e.key,
        });
      },
    };

    window.addEventListener('keydown', listener.keyDown);
    window.addEventListener('keyup', listener.keyUp);
    this.listeners.push(listener);

    return {
      remove: () => {
        window.removeEventListener('keydown', listener.keyDown);
        window.removeEventListener('keyup', listener.keyUp);
        this.listeners = this.listeners.filter(l => l !== listener);
      },
    };
  },

  // Remove all listeners
  removeListeners: function() {
    this.listeners.forEach(listener => {
      window.removeEventListener('keydown', listener.keyDown);
      window.removeEventListener('keyup', listener.keyUp);
    });
    this.listeners = [];
  },

  // Map browser keyCode to Android keyCode
  mapKeyCode: function(browserKeyCode) {
    const keyMap = {
      48: 7,  // 0
      49: 8,  // 1
      50: 9,  // 2
      51: 10, // 3
      52: 11, // 4
      53: 12, // 5
      54: 13, // 6
      55: 14, // 7
      56: 15, // 8
      57: 16, // 9
      65: 29, // A
      66: 30, // B
      67: 31, // C
      68: 32, // D
      69: 33, // E
      70: 34, // F
      71: 35, // G
      72: 36, // H
      73: 37, // I
      74: 38, // J
      75: 39, // K
      76: 40, // L
      77: 41, // M
      78: 42, // N
      79: 43, // O
      80: 44, // P
      81: 45, // Q
      82: 46, // R
      83: 47, // S
      84: 48, // T
      85: 49, // U
      86: 50, // V
      87: 51, // W
      88: 52, // X
      89: 53, // Y
      90: 54, // Z
      38: 19,  // Up
      40: 20,  // Down
      37: 21,  // Left
      39: 22,  // Right
      13: 66,  // Enter
      27: 4,   // Escape
      8: 67,   // Backspace
      9: 61,   // Tab
      32: 62,  // Space
      187: 81, // +
      189: 69, // -
    };
    return keyMap[browserKeyCode] || browserKeyCode;
  },

  // Helper method to map pressed key
  mapKey: function(key) {
    return key;
  },
};

// Helper hook for React integration
const useKeyEvent = (callback) => {
  React.useEffect(() => {
    const subscription = KeyEvent.addListener(callback);
    return () => subscription.remove();
  }, [callback]);
};

export { KeyEvent, useKeyEvent };
export default KeyEvent;
