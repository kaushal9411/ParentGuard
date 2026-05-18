package com.parentalmonitor.child.services

import android.content.Context
import android.provider.ContactsContract
import org.json.JSONArray
import org.json.JSONObject

class ContactsService(private val ctx: Context) {

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
