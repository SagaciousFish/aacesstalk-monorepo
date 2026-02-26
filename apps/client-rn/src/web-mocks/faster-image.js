// Web implementation for @candlefinance/faster-image
// Uses regular React Native Image component as fallback

import React from 'react';
import { Image, View, StyleSheet } from 'react-native';

function FasterImageView(props) {
  const {
    source,
    style,
    resizeMode = 'cover',
    transitionDuration = 200,
    ...rest
  } = props;

  return (
    <View style={style}>
      <Image
        source={source}
        resizeMode={resizeMode}
        style={StyleSheet.absoluteFill}
        {...rest}
      />
    </View>
  );
}

export { FasterImageView };
export default FasterImageView;
