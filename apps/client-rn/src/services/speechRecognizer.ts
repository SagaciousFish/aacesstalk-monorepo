/* A tiny wrapper around @dev-amirzubair/react-native-voice that falls back when
   the native module isn't available at runtime. Keeps a small, promise-based
   API used by the recording flow. */

type Callbacks = {
    onSpeechStart?: () => void
    onSpeechEnd?: () => void
    onSpeechResults?: (results: string[]) => void
    onSpeechError?: (error: any) => void
}

let Voice: any = null
let _available = false
try {
    // require here so bundlers won't fail if the package is not installed in some environments
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Voice = require('@dev-amirzubair/react-native-voice')
    _available = !!Voice
} catch (e) {
    Voice = null
    _available = false
}

export function isAvailable() {
    return _available
}

export async function startListening(language: string, callbacks: Callbacks = {}): Promise<boolean> {
    if (!isAvailable()) {
        console.log("SpeechRecognizer: Voice module not available");
        return false
    }

    try {
        Voice.onSpeechStart = () => callbacks.onSpeechStart?.()
        Voice.onSpeechEnd = () => callbacks.onSpeechEnd?.()
        Voice.onSpeechResults = (e: any) => callbacks.onSpeechResults?.(e.value ?? [])
        Voice.onSpeechError = (e: any) => callbacks.onSpeechError?.(e)

        // voice.start returns a promise in newer versions
        await Voice.start(language)
        return true
    } catch (ex) {
        callbacks.onSpeechError?.(ex)
        return false
    }
}

export async function stopListening() {
    if (!isAvailable()) return
    try {
        await Voice.stop()
    } catch (ex) {
        // ignore
    }
}

export async function destroy() {
    if (!isAvailable()) return
    try {
        await Voice.destroy()
        Voice.removeAllListeners()
    } catch (ex) {
        // ignore
    }
}

export default {
    isAvailable,
    startListening,
    stopListening,
    destroy
}
