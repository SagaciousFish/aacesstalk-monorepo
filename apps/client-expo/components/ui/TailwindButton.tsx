import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { PropsWithChildren } from 'react';

// Local style templates (simplified from client-rn)
const styleTemplates = {
    withBoldFont: { fontFamily: 'NanumSquareNeoTTF-dEb' },
};

type Props = {
    title?: string;
    onPress?: () => void;
    disabled?: boolean;
    containerStyle?: ViewStyle | ViewStyle[];
    buttonStyle?: ViewStyle | ViewStyle[];
    titleStyle?: any;
};

export function TailwindButton({ title, onPress, disabled, containerStyle, buttonStyle, titleStyle }: Props) {
    return (
        <Pressable onPress={onPress} disabled={disabled} style={[styles.container, containerStyle]}>
            <Pressable onPress={onPress} disabled={disabled} style={[styles.button, disabled ? styles.disabled : undefined, buttonStyle]}>
                <Text style={[styleTemplates.withBoldFont, styles.title, titleStyle]}>{title}</Text>
            </Pressable>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%'
    },
    button: {
        backgroundColor: '#f9aa33',
        paddingVertical: 12,
        borderRadius: 999,
        alignItems: 'center',
    },
    disabled: {
        backgroundColor: '#e5e7eb'
    },
    title: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 20
    }
});
