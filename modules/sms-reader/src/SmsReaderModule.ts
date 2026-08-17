import { NativeModule, requireOptionalNativeModule } from 'expo'

import { SmsMessage } from './SmsReader.types'

declare class SmsReaderModule extends NativeModule {
  hasReadSmsPermission(): boolean
  getInboxMessages(limit: number): Promise<SmsMessage[]>
}

// Expo Go's precompiled binary doesn't include this (or any) third-party
// native module — only a custom dev client built with this module's native
// code does. requireNativeModule() throws synchronously when the module
// isn't found, which would crash the app at import time under Expo Go
// (before useSmsSync's Android/permission checks ever run). The fallback is
// a plain object, not a NativeModule subclass — on a real native runtime
// that class ties into the actual JSI bridge rather than being a harmless
// JS shim (that's what crashed the equivalent iOS fallback), and neither
// method here needs it.
const fallback = {
  hasReadSmsPermission(): boolean {
    return false
  },

  async getInboxMessages(_limit: number): Promise<SmsMessage[]> {
    throw new Error('SMS reading requires a custom development build, not Expo Go.')
  },
} as SmsReaderModule

export default requireOptionalNativeModule<SmsReaderModule>('SmsReader') ?? fallback
