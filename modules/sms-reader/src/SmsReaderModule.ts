import { NativeModule, requireNativeModule } from 'expo'

import { SmsMessage } from './SmsReader.types'

declare class SmsReaderModule extends NativeModule {
  hasReadSmsPermission(): boolean
  getInboxMessages(limit: number): Promise<SmsMessage[]>
}

// This call loads the native module object from the JSI.
export default requireNativeModule<SmsReaderModule>('SmsReader')
