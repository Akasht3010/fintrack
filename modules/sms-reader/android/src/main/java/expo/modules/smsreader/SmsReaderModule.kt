package expo.modules.smsreader

import android.Manifest
import android.content.pm.PackageManager
import android.provider.Telephony
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsReaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SmsReader")

    // READ_SMS is a runtime-dangerous permission — the JS layer requests it via
    // PermissionsAndroid before ever calling getInboxMessages; this just lets it
    // check status without a native round trip failing.
    Function("hasReadSmsPermission") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) ==
        PackageManager.PERMISSION_GRANTED
    }

    // Reads the most recent messages from the SMS inbox, newest first. Returns
    // raw messages (sender address, body, epoch-ms date) — filtering for which
    // ones look like bank alerts happens in JS/backend, not here, since that
    // logic is shared with the Gmail import path.
    AsyncFunction("getInboxMessages") { limit: Int ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) !=
        PackageManager.PERMISSION_GRANTED
      ) {
        throw Exceptions.MissingPermissions("android.permission.READ_SMS")
      }

      val messages = mutableListOf<Map<String, Any?>>()
      // "LIMIT n" appended to the sort order isn't a formally documented
      // ContentResolver feature, but it's a long-standing, widely-relied-on
      // behavior of Android's SMS provider specifically (it passes the sort
      // order straight through to the underlying SQLite query). take() below
      // is a cheap safety net in case a device/ROM ever doesn't honor it.
      val cursor = context.contentResolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        arrayOf(Telephony.Sms.Inbox.ADDRESS, Telephony.Sms.Inbox.BODY, Telephony.Sms.Inbox.DATE),
        null,
        null,
        "${Telephony.Sms.Inbox.DATE} DESC LIMIT $limit"
      )

      cursor?.use {
        val addressIndex = it.getColumnIndexOrThrow(Telephony.Sms.Inbox.ADDRESS)
        val bodyIndex = it.getColumnIndexOrThrow(Telephony.Sms.Inbox.BODY)
        val dateIndex = it.getColumnIndexOrThrow(Telephony.Sms.Inbox.DATE)

        while (it.moveToNext()) {
          messages.add(
            mapOf(
              "address" to it.getString(addressIndex),
              "body" to it.getString(bodyIndex),
              "date" to it.getLong(dateIndex)
            )
          )
        }
      }

      messages.take(limit)
    }
  }
}
