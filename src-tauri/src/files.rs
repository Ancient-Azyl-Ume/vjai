// Show files, media directory listing, user config and the frontend log.
use crate::doc::DocState;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub fn save_doc(state: State<DocState>, path: String) -> Result<(), String> {
    let doc = state.0.lock().unwrap().clone();
    let text = serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())?;
    std::fs::write(&path, text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_doc(app: AppHandle, state: State<DocState>, path: String) -> Result<Value, String> {
    let text = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let doc: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    *state.0.lock().unwrap() = doc.clone();
    app.emit("doc:changed", doc.clone()).map_err(|e| e.to_string())?;
    Ok(doc)
}

#[derive(Serialize)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
}

// `exts` (optional, dots ignored) keeps only files with those extensions; directories are
// always listed so the media browser can walk into them.
#[tauri::command]
pub fn list_dir(path: String, exts: Option<Vec<String>>) -> Result<Vec<FileEntry>, String> {
    let filter: Option<Vec<String>> = exts
        .map(|v| v.iter().map(|e| e.trim_start_matches('.').to_lowercase()).collect::<Vec<_>>())
        .filter(|v| !v.is_empty());
    let mut out = Vec::new();
    for e in std::fs::read_dir(&path).map_err(|e| e.to_string())? {
        let e = e.map_err(|e| e.to_string())?;
        let p = e.path();
        let is_dir = p.is_dir();
        if !is_dir {
            if let Some(f) = &filter {
                let ext = p.extension().map(|x| x.to_string_lossy().to_lowercase()).unwrap_or_default();
                if !f.iter().any(|a| *a == ext) {
                    continue;
                }
            }
        }
        out.push(FileEntry {
            name: e.file_name().to_string_lossy().to_string(),
            path: p.to_string_lossy().to_string(),
            is_dir,
            size: if is_dir { 0 } else { e.metadata().map(|m| m.len()).unwrap_or(0) },
        });
    }
    out.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
    Ok(out)
}

fn config_dir() -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    std::path::PathBuf::from(home).join(".config").join("vjai")
}

fn config_path() -> std::path::PathBuf {
    config_dir().join("config.json")
}

// Frontend errors land here so they can be read from a terminal while the app runs.
#[tauri::command]
pub fn log_line(line: String) {
    use std::io::Write;
    let p = config_dir();
    let _ = std::fs::create_dir_all(&p);
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(p.join("frontend.log")) {
        let _ = writeln!(f, "{}", line);
    }
}

#[tauri::command]
pub fn get_config() -> Value {
    std::fs::read_to_string(config_path())
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_else(|| serde_json::json!({}))
}

#[tauri::command]
pub fn set_config(config: Value) -> Result<(), String> {
    let p = config_path();
    if let Some(dir) = p.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::write(&p, serde_json::to_string_pretty(&config).unwrap()).map_err(|e| e.to_string())
}
