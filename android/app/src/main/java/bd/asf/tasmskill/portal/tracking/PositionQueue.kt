package bd.asf.tasmskill.portal.tracking

import android.content.ContentValues
import android.content.Context
import android.database.DatabaseUtils
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.location.Location
import org.json.JSONObject

/** Local SQLite queue of location fixes waiting to be uploaded. */
class PositionQueue private constructor(ctx: Context) :
    SQLiteOpenHelper(ctx.applicationContext, DB_NAME, null, DB_VERSION) {

    data class Row(
        val id: Long,
        val trackId: String,
        val capturedAt: String,
        val latitude: Double,
        val longitude: Double,
        val accuracy: Float,
        val speed: Float?,
        val bearing: Float?,
        val battery: Int?,
    ) {
        fun toJson(): JSONObject = JSONObject().apply {
            put("latitude", latitude)
            put("longitude", longitude)
            put("accuracy", accuracy.toDouble())
            put("capturedAt", capturedAt)
            speed?.let { put("speed", it.toDouble()) }
            bearing?.let { put("bearing", it.toDouble()) }
            battery?.let { put("battery", it) }
        }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                track_id TEXT NOT NULL,
                captured_at TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                accuracy REAL NOT NULL,
                speed REAL,
                bearing REAL,
                battery INTEGER,
                UNIQUE(track_id, captured_at)
            )
            """.trimIndent()
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS positions")
        onCreate(db)
    }

    fun insert(trackId: String, location: Location, battery: Int?) {
        val values = ContentValues().apply {
            put("track_id", trackId)
            put("captured_at", IsoTime.format(location.time))
            put("latitude", location.latitude)
            put("longitude", location.longitude)
            put("accuracy", if (location.hasAccuracy()) location.accuracy else 0f)
            if (location.hasSpeed()) put("speed", location.speed) else putNull("speed")
            if (location.hasBearing()) put("bearing", location.bearing) else putNull("bearing")
            if (battery != null) put("battery", battery) else putNull("battery")
        }
        writableDatabase.insertWithOnConflict("positions", null, values, SQLiteDatabase.CONFLICT_IGNORE)
    }

    fun pending(trackId: String, limit: Int): List<Row> {
        val rows = ArrayList<Row>()
        readableDatabase.query(
            "positions", null, "track_id = ?", arrayOf(trackId),
            null, null, "id ASC", limit.toString()
        ).use { c ->
            val iId = c.getColumnIndexOrThrow("id")
            val iCap = c.getColumnIndexOrThrow("captured_at")
            val iLat = c.getColumnIndexOrThrow("latitude")
            val iLng = c.getColumnIndexOrThrow("longitude")
            val iAcc = c.getColumnIndexOrThrow("accuracy")
            val iSpd = c.getColumnIndexOrThrow("speed")
            val iBrg = c.getColumnIndexOrThrow("bearing")
            val iBat = c.getColumnIndexOrThrow("battery")
            while (c.moveToNext()) {
                rows += Row(
                    id = c.getLong(iId),
                    trackId = trackId,
                    capturedAt = c.getString(iCap),
                    latitude = c.getDouble(iLat),
                    longitude = c.getDouble(iLng),
                    accuracy = c.getFloat(iAcc),
                    speed = if (c.isNull(iSpd)) null else c.getFloat(iSpd),
                    bearing = if (c.isNull(iBrg)) null else c.getFloat(iBrg),
                    battery = if (c.isNull(iBat)) null else c.getInt(iBat),
                )
            }
        }
        return rows
    }

    fun delete(ids: List<Long>) {
        if (ids.isEmpty()) return
        val db = writableDatabase
        db.beginTransaction()
        try {
            ids.chunked(500).forEach { chunk ->
                val placeholders = chunk.joinToString(",") { "?" }
                db.delete("positions", "id IN ($placeholders)", chunk.map { it.toString() }.toTypedArray())
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun deleteTrack(trackId: String) {
        writableDatabase.delete("positions", "track_id = ?", arrayOf(trackId))
    }

    fun deleteOtherTracks(trackId: String) {
        writableDatabase.delete("positions", "track_id <> ?", arrayOf(trackId))
    }

    fun count(trackId: String?): Int = if (trackId == null) {
        DatabaseUtils.queryNumEntries(readableDatabase, "positions").toInt()
    } else {
        DatabaseUtils.queryNumEntries(readableDatabase, "positions", "track_id = ?", arrayOf(trackId)).toInt()
    }

    companion object {
        private const val DB_NAME = "asm_tracking.db"
        private const val DB_VERSION = 1

        @Volatile
        private var instance: PositionQueue? = null

        fun get(ctx: Context): PositionQueue =
            instance ?: synchronized(this) {
                instance ?: PositionQueue(ctx).also { instance = it }
            }
    }
}
