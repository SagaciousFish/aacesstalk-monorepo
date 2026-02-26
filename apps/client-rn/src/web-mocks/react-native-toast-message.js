// Web implementation for react-native-toast-message
// Uses browser DOM for toast notifications

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

let toastRef = null;

// Toast container component
class ToastContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      toasts: [],
    };
    this.counter = 0;
  }

  componentDidMount() {
    toastRef = this;
  }

  componentWillUnmount() {
    toastRef = null;
  }

  show(options) {
    const id = ++this.counter;
    const toast = {
      id,
      type: options.type || 'info',
      text1: options.text1 || '',
      text2: options.text2 || '',
      visibilityTime: options.visibilityTime || 3000,
      position: options.position || 'top',
      onShow: options.onShow,
      onHide: options.onHide,
      onPress: options.onPress,
    };

    this.setState(state => ({
      toasts: [...state.toasts, toast],
    }));

    // Auto hide
    setTimeout(() => {
      this.hide(id);
    }, toast.visibilityTime);

    if (options.onShow) {
      options.onShow();
    }

    return id;
  }

  hide(id) {
    this.setState(state => ({
      toasts: state.toasts.filter(t => t.id !== id),
    }));
  }

  hideAll() {
    this.setState({ toasts: [] });
  }

  render() {
    const { toasts } = this.state;

    if (toasts.length === 0) return null;

    // Group by position
    const topToasts = toasts.filter(t => t.position === 'top');
    const bottomToasts = toasts.filter(t => t.position === 'bottom');

    return (
      <View style={styles.container}>
        {topToasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onHide={() => this.hide(toast.id)} />
        ))}
        {bottomToasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onHide={() => this.hide(toast.id)} />
        ))}
      </View>
    );
  }
}

// Individual toast item
class ToastItem extends React.Component {
  constructor(props) {
    super(props);
    this.opacity = new Animated.Value(0);
  }

  componentDidMount() {
    Animated.timing(this.opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }

  hide = () => {
    Animated.timing(this.opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      this.props.onHide();
    });
  };

  render() {
    const { toast } = this.props;

    const backgroundColor = {
      success: '#4CAF50',
      error: '#F44336',
      info: '#2196F3',
      warning: '#FF9800',
    }[toast.type] || '#2196F3';

    const isBottom = toast.position === 'bottom';

    return (
      <Animated.View
        style={[
          styles.toast,
          { backgroundColor, top: isBottom ? undefined : 50, bottom: isBottom ? 50 : undefined },
          { opacity: this.opacity },
        ]}
        onTouchEnd={toast.onPress || this.hide}
      >
        <Text style={styles.title}>{toast.text1}</Text>
        {toast.text2 && <Text style={styles.subtitle}>{toast.text2}</Text>}
      </Animated.View>
    );
  }
}

// Base styles
const styles = StyleSheet.create({
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
    zIndex: 9999,
  },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
  },
});

// Toast instance methods
const show = (options) => {
  if (toastRef) {
    return toastRef.show(options);
  }
  console.warn('Toast not mounted');
  return null;
};

const hide = (id) => {
  if (toastRef) {
    toastRef.hide(id);
  }
};

const hideAll = () => {
  if (toastRef) {
    toastRef.hideAll();
  }
};

// BaseToast component
const BaseToast = (props) => {
  return <View {...props} />;
};

// InfoToast component
const InfoToast = (props) => {
  return <BaseToast {...props} style={[props.style, { borderLeftColor: '#87CEFA' }]} />;
};

// SuccessToast component
const SuccessToast = (props) => {
  return <BaseToast {...props} style={[props.style, { borderLeftColor: '#69C779' }]} />;
};

// ErrorToast component
const ErrorToast = (props) => {
  return <BaseToast {...props} style={[props.style, { borderLeftColor: '#F44336' }]} />;
};

// Config function
const config = (options) => {
  // Store config for future use
  return options;
};

// Toast component - This is the default export that can be used as JSX
// It wraps ToastContainer and provides the static methods
const Toast = (props) => {
  return <ToastContainer {...props} />;
};

// Attach static methods to Toast component
Toast.show = show;
Toast.hide = hide;
Toast.hideAll = hideAll;
Toast.config = config;
Toast.BaseToast = BaseToast;
Toast.InfoToast = InfoToast;
Toast.SuccessToast = SuccessToast;
Toast.ErrorToast = ErrorToast;
Toast.ToastContainer = ToastContainer;

export {
  Toast,
  ToastContainer,
  BaseToast,
  InfoToast,
  SuccessToast,
  ErrorToast,
  show,
  hide,
  hideAll,
  config,
};

export default Toast;
