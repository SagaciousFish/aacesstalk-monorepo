import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

// Local style templates (simplified from client-rn)
const styleTemplates = {
    withRegularFont: { fontFamily: 'NanumSquareNeoTTF-bRg' },
    withSemiboldFont: { fontFamily: 'NanumSquareNeoTTF-cBd' },
    withBoldFont: { fontFamily: 'NanumSquareNeoTTF-dEb' },
};

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        // base font family from client-rn
        styleTemplates.withRegularFont,
        type === 'default' ? styles.default : undefined,
        type === 'title' ? [styles.title, styleTemplates.withBoldFont] : undefined,
        type === 'defaultSemiBold' ? [styles.defaultSemiBold, styleTemplates.withSemiboldFont] : undefined,
        type === 'subtitle' ? [styles.subtitle, styleTemplates.withBoldFont] : undefined,
        type === 'link' ? [styles.link, styleTemplates.withSemiboldFont] : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: '#0a7ea4',
  },
});
