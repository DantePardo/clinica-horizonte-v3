#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use keyring::Entry;
use rand::RngCore;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const KEYRING_SERVICE: &str = "clinica-horizonte";
const KEYRING_ACCOUNT: &str = "agenda-sqlcipher-key";
const CACHE_TTL_SECONDS: i64 = 24 * 60 * 60;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgendaEntry {
    id: String,
    scheduled_at: String,
    duration_minutes: i32,
    status: String,
    doctor: Doctor,
    patient: CachedPatient,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Doctor {
    id: String,
    display_name: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CachedPatient {
    id: String,
    first_name: String,
    last_name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OfflineAgenda {
    day: String,
    appointments: Vec<AgendaEntry>,
}

fn now_seconds() -> Result<i64, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .map_err(|error| error.to_string())
}

fn encryption_key() -> Result<[u8; 32], String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|error| error.to_string())?;
    match entry.get_password() {
        Ok(value) => {
            let decoded = hex::decode(value).map_err(|error| error.to_string())?;
            decoded.try_into().map_err(|_| "La llave local tiene un tamaño inválido".to_string())
        }
        Err(keyring::Error::NoEntry) => {
            let mut key = [0_u8; 32];
            rand::thread_rng().fill_bytes(&mut key);
            entry.set_password(&hex::encode(key)).map_err(|error| error.to_string())?;
            Ok(key)
        }
        Err(error) => Err(error.to_string()),
    }
}

fn open_cache(app: &AppHandle) -> Result<Connection, String> {
    let directory = app.path().app_data_dir().map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let connection = Connection::open(directory.join("agenda.db")).map_err(|error| error.to_string())?;
    let key = encryption_key()?;
    connection
        .execute_batch(&format!("PRAGMA key = \"x'{}'\"; PRAGMA cipher_memory_security = ON;", hex::encode(key)))
        .map_err(|error| error.to_string())?;
    connection
        .execute_batch("CREATE TABLE IF NOT EXISTS agenda_cache (id INTEGER PRIMARY KEY CHECK(id = 1), day TEXT NOT NULL, expires_at INTEGER NOT NULL, payload TEXT NOT NULL);")
        .map_err(|error| error.to_string())?;
    Ok(connection)
}

#[tauri::command]
fn cache_agenda(app: AppHandle, day: String, appointments: Vec<AgendaEntry>) -> Result<(), String> {
    let payload = serde_json::to_string(&appointments).map_err(|error| error.to_string())?;
    let connection = open_cache(&app)?;
    connection
        .execute(
            "INSERT INTO agenda_cache (id, day, expires_at, payload) VALUES (1, ?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET day=excluded.day, expires_at=excluded.expires_at, payload=excluded.payload",
            params![day, now_seconds()? + CACHE_TTL_SECONDS, payload],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_cached_agenda(app: AppHandle, day: String) -> Result<Option<OfflineAgenda>, String> {
    let connection = open_cache(&app)?;
    let cached = connection
        .query_row(
            "SELECT day, expires_at, payload FROM agenda_cache WHERE id = 1",
            [],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?, row.get::<_, String>(2)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    let Some((cached_day, expires_at, payload)) = cached else { return Ok(None) };
    if cached_day != day || expires_at <= now_seconds()? {
        connection.execute("DELETE FROM agenda_cache WHERE id = 1", []).map_err(|error| error.to_string())?;
        return Ok(None);
    }
    let appointments = serde_json::from_str(&payload).map_err(|error| error.to_string())?;
    Ok(Some(OfflineAgenda { day: cached_day, appointments }))
}

#[tauri::command]
fn clear_agenda_cache(app: AppHandle) -> Result<(), String> {
    open_cache(&app)?
        .execute("DELETE FROM agenda_cache", [])
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![cache_agenda, read_cached_agenda, clear_agenda_cache])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar Clínica Horizonte");
}
