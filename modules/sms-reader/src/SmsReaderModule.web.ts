import { registerWebModule, NativeModule } from 'expo'

import { SmsMessage } from './SmsReader.types'

// SMS reading has no web/iOS equivalent — this module is Android-only.
// The JS-side hook is expected to gate all calls behind Platform.OS === 'android',
// so these throwing stubs are a safety net, not the primary guard.
class SmsReaderModule extends NativeModule {
  hasReadSmsPermission(): boolean {
    return false
  }

  async getInboxMessages(_limit: number): Promise<SmsMessage[]> {
    throw new Error('SMS reading is only supported on Android')
  }
}

export default registerWebModule(SmsReaderModule, 'SmsReaderModule')
