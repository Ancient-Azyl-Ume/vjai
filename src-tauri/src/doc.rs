// The whole app state is one JSON document held here.
// Every window (UI + projector outputs) reads it and gets `doc:changed` on every patch.
use serde::Deserialize;
use serde_json::Value;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

pub struct DocState(pub Mutex<Value>);

impl DocState {
    pub fn new() -> Self {
        DocState(Mutex::new(Value::Null))
    }
}

#[derive(Deserialize)]
pub struct Op {
    op: String,   // "set" | "add" | "remove"
    path: String, // dotted path, e.g. "layers.0.opacity" or "layers.<id>.opacity"
    #[serde(default)]
    value: Value,
}

// Resolve one path segment: numeric index, or an object with matching "id" inside an array.
fn step<'a>(v: &'a mut Value, seg: &str) -> Option<&'a mut Value> {
    match v {
        Value::Array(arr) => {
            if let Ok(i) = seg.parse::<usize>() {
                arr.get_mut(i)
            } else {
                arr.iter_mut().find(|e| e.get("id").and_then(|x| x.as_str()) == Some(seg))
            }
        }
        Value::Object(map) => map.get_mut(seg),
        _ => None,
    }
}

// Mirrored by applyOp in src/rpc.ts (browser fallback); keep the two in sync.
pub fn apply_op(doc: &mut Value, op: &Op) -> Result<(), String> {
    let segs: Vec<&str> = op.path.split('.').filter(|s| !s.is_empty()).collect();
    if segs.is_empty() {
        if op.op == "set" {
            *doc = op.value.clone();
            return Ok(());
        }
        return Err("empty path".into());
    }
    let (last, parents) = segs.split_last().unwrap();
    let mut cur = doc;
    for s in parents {
        cur = step(cur, s).ok_or_else(|| format!("path not found: {} (at {})", op.path, s))?;
    }
    match op.op.as_str() {
        "set" => match cur {
            Value::Object(map) => {
                map.insert(last.to_string(), op.value.clone());
                Ok(())
            }
            Value::Array(_) => {
                let slot = step(cur, last).ok_or_else(|| format!("index not found: {}", op.path))?;
                *slot = op.value.clone();
                Ok(())
            }
            _ => Err(format!("cannot set into scalar: {}", op.path)),
        },
        "add" => {
            let target = step(cur, last).ok_or_else(|| format!("path not found: {}", op.path))?;
            match target {
                Value::Array(arr) => {
                    arr.push(op.value.clone());
                    Ok(())
                }
                _ => Err(format!("add target is not an array: {}", op.path)),
            }
        }
        "remove" => match cur {
            Value::Object(map) => {
                map.remove(*last);
                Ok(())
            }
            Value::Array(arr) => {
                if let Ok(i) = last.parse::<usize>() {
                    if i < arr.len() {
                        arr.remove(i);
                    }
                } else {
                    arr.retain(|e| e.get("id").and_then(|x| x.as_str()) != Some(*last));
                }
                Ok(())
            }
            _ => Err(format!("cannot remove from scalar: {}", op.path)),
        },
        other => Err(format!("unknown op: {}", other)),
    }
}

#[tauri::command]
pub fn get_doc(state: State<DocState>) -> Value {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
pub fn set_doc(app: AppHandle, state: State<DocState>, doc: Value) -> Result<(), String> {
    *state.0.lock().unwrap() = doc.clone();
    app.emit("doc:changed", doc).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn patch_doc(app: AppHandle, state: State<DocState>, ops: Vec<Op>) -> Result<Value, String> {
    let mut guard = state.0.lock().unwrap();
    let mut next = guard.clone();
    for op in &ops {
        apply_op(&mut next, op)?;
    }
    *guard = next.clone();
    drop(guard);
    app.emit("doc:changed", next.clone()).map_err(|e| e.to_string())?;
    Ok(next)
}
