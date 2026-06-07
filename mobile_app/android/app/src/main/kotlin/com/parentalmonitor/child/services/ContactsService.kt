package com.parentalmonitor.child.services

import android.content.Context
import android.provider.ContactsContract
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class ContactsService(private val ctx: Context) {

    companion object {
        private const val TAG          = "ContactsService"
        private const val PREFS        = "pm_contacts"
        private const val KEY_LAST     = "last_contact_sync_ts"
        private const val SIX_HOURS_MS = 6 * 60 * 60 * 1000L
    }

    /** Uploads all contacts to /api/events/batch (rate-limited to once per 6 h, or forced). */
    fun syncContacts(token: String, deviceId: String, baseUrl: String, force: Boolean = false) {
        val permGranted = ctx.checkSelfPermission(android.Manifest.permission.READ_CONTACTS) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
        if (!permGranted) {
            android.util.Log.w(TAG, "SKIP — READ_CONTACTS permission not granted")
            return
        }

        val prefs    = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val lastSync = prefs.getLong(KEY_LAST, 0L)
        val ageMs    = System.currentTimeMillis() - lastSync
        if (!force && ageMs < SIX_HOURS_MS) {
            android.util.Log.d(TAG, "SKIP — rate limited (last sync ${ageMs / 60_000} min ago, threshold 360 min)")
            return
        }
        android.util.Log.d(TAG, "Reading contacts (force=$force) …")

        val contactsJson = getContacts()
        val contacts     = try { JSONArray(contactsJson) } catch (_: Exception) { return }
        if (contacts.length() == 0) return

        val events = JSONArray()
        for (i in 0 until contacts.length()) {
            val c = contacts.getJSONObject(i)
            events.put(JSONObject().apply {
                put("id",      "${deviceId}_contact_${c.optString("id")}")
                put("type",    "contact")
                put("payload", c)
            })
        }

        val body = JSONObject().apply {
            put("deviceId", deviceId)
            put("events",   events)
        }.toString().toByteArray(Charsets.UTF_8)

        try {
            val conn = (URL("$baseUrl/api/events/batch").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Authorization", "Bearer $token")
                setRequestProperty("Content-Type",  "application/json")
                doOutput       = true
                connectTimeout = 15_000
                readTimeout    = 60_000
                setFixedLengthStreamingMode(body.size.toLong())
            }
            conn.outputStream.use { it.write(body) }
            val code = conn.responseCode
            conn.disconnect()
            if (code == 200 || code == 201) {
                prefs.edit().putLong(KEY_LAST, System.currentTimeMillis()).apply()
                android.util.Log.d(TAG, "Synced ${contacts.length()} contacts ✓")
            } else {
                android.util.Log.w(TAG, "Contacts sync HTTP $code")
            }
        } catch (e: Exception) {
            android.util.Log.w(TAG, "Contacts sync failed: ${e.message}")
        }
    }

    fun getContacts(): String {
        val result = JSONArray()
        try {
            ctx.contentResolver.query(
                ContactsContract.Contacts.CONTENT_URI,
                arrayOf(ContactsContract.Contacts._ID, ContactsContract.Contacts.DISPLAY_NAME_PRIMARY),
                null, null,
                "${ContactsContract.Contacts.DISPLAY_NAME_PRIMARY} ASC",
            )?.use { cursor ->
                val idIdx   = cursor.getColumnIndexOrThrow(ContactsContract.Contacts._ID)
                val nameIdx = cursor.getColumnIndexOrThrow(ContactsContract.Contacts.DISPLAY_NAME_PRIMARY)

                while (cursor.moveToNext()) {
                    val contactId = cursor.getString(idIdx) ?: continue
                    val name      = cursor.getString(nameIdx)?.takeIf { it.isNotBlank() } ?: continue

                    result.put(JSONObject().apply {
                        put("id",     "contact_$contactId")
                        put("name",   name)
                        put("phones", getPhones(contactId))
                        put("emails", getEmails(contactId))
                        put("groups", JSONArray())
                    })
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("ContactsService", "Failed to read contacts: ${e.message}", e)
        }
        return result.toString()
    }

    private fun getPhones(contactId: String): JSONArray {
        val arr = JSONArray()
        ctx.contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
            "${ContactsContract.CommonDataKinds.Phone.CONTACT_ID} = ?",
            arrayOf(contactId), null,
        )?.use { c ->
            val idx = c.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.NUMBER)
            while (c.moveToNext()) c.getString(idx)?.let { arr.put(it) }
        }
        return arr
    }

    private fun getEmails(contactId: String): JSONArray {
        val arr = JSONArray()
        ctx.contentResolver.query(
            ContactsContract.CommonDataKinds.Email.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.Email.ADDRESS),
            "${ContactsContract.CommonDataKinds.Email.CONTACT_ID} = ?",
            arrayOf(contactId), null,
        )?.use { c ->
            val idx = c.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Email.ADDRESS)
            while (c.moveToNext()) c.getString(idx)?.let { arr.put(it) }
        }
        return arr
    }
}
