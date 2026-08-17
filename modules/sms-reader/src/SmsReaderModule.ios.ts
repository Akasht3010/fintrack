import { SmsMessage } from './SmsReader.types'

// SMS reading has no iOS equivalent (no public API for reading the inbox) —
// this module is Android-only. Without this file, Metro falls back to the
// default SmsReaderModule.ts on iOS, which calls requireNativeModule() at
// import time and throws immediately since no native module is registered
// for this platform — crashing app startup before useSmsSync's own
// Platform.OS === 'android' guard ever runs. A plain object is enough here:
// unlike on web, `NativeModule`/`registerWebModule` on a real native runtime
// (iOS) ties into the actual JSI bridge rather than being a harmless JS
// shim, and neither of these methods needs that — it threw at runtime.
const SmsReaderModule = {
  hasReadSmsPermission(): boolean {
    return false
  },

  async getInboxMessages(_limit: number): Promise<SmsMessage[]> {
    throw new Error('SMS reading is only supported on Android')
  },
}

export default SmsReaderModule
