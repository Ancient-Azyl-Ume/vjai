// Monitors and projector output windows.
use serde::Serialize;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};

#[derive(Serialize)]
pub struct MonitorInfo {
    index: usize,
    name: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    scale: f64,
}

#[tauri::command]
pub fn list_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let mons = app.available_monitors().map_err(|e| e.to_string())?;
    Ok(mons
        .iter()
        .enumerate()
        .map(|(i, m)| MonitorInfo {
            index: i,
            name: m.name().cloned().unwrap_or_else(|| format!("Display {}", i)),
            x: m.position().x,
            y: m.position().y,
            width: m.size().width,
            height: m.size().height,
            scale: m.scale_factor(),
        })
        .collect())
}

// One borderless window per output, labelled "output-<id>", loading index.html?output=<id>.
// It is built hidden, moved and sized to the monitor in physical pixels (so mixed-DPI setups
// land on the right screen), then shown and put fullscreen. On macOS "simple" fullscreen is
// used on purpose: it covers the monitor it is already on instead of animating into a Space.
#[tauri::command]
pub fn open_output(app: AppHandle, output_id: String, monitor: usize) -> Result<(), String> {
    let label = format!("output-{}", output_id);
    if let Some(w) = app.get_webview_window(&label) {
        w.close().map_err(|e| e.to_string())?;
    }
    let mons = app.available_monitors().map_err(|e| e.to_string())?;
    let m = mons.get(monitor).ok_or("monitor index out of range")?;
    let pos = *m.position();
    let size = *m.size();
    let url = format!("index.html?output={}", output_id);
    let win = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title(format!("vjai output {}", output_id))
        .decorations(false)
        .always_on_top(true)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())?;
    win.set_position(PhysicalPosition::new(pos.x, pos.y))
        .map_err(|e| e.to_string())?;
    win.set_size(PhysicalSize::new(size.width, size.height))
        .map_err(|e| e.to_string())?;
    win.show().map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    win.set_simple_fullscreen(true).map_err(|e| e.to_string())?;
    #[cfg(not(target_os = "macos"))]
    win.set_fullscreen(true).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn close_output(app: AppHandle, output_id: String) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(&format!("output-{}", output_id)) {
        w.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Panic button: close every projector window, whatever the doc currently says.
#[tauri::command]
pub fn close_all_outputs(app: AppHandle) -> Result<usize, String> {
    let mut n = 0;
    for (label, w) in app.webview_windows() {
        if label.starts_with("output-") {
            w.close().map_err(|e| e.to_string())?;
            n += 1;
        }
    }
    Ok(n)
}

// Flash a big number on every monitor for 2 seconds so the user can tell which index
// is which. The pages are public/identify.html; a background thread closes them.
#[tauri::command]
pub fn identify_monitors(app: AppHandle) -> Result<(), String> {
    let mons = app.available_monitors().map_err(|e| e.to_string())?;
    let mut labels: Vec<String> = Vec::new();
    for (i, m) in mons.iter().enumerate() {
        let label = format!("identify-{}", i);
        if let Some(w) = app.get_webview_window(&label) {
            let _ = w.close();
        }
        let size = *m.size();
        let pos = *m.position();
        let url = format!("identify.html?i={}&w={}&h={}", i, size.width, size.height);
        let win = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
            .title("identify")
            .decorations(false)
            .always_on_top(true)
            .visible(false)
            .build()
            .map_err(|e| e.to_string())?;
        win.set_position(PhysicalPosition::new(pos.x, pos.y))
            .map_err(|e| e.to_string())?;
        win.set_size(PhysicalSize::new(size.width, size.height))
            .map_err(|e| e.to_string())?;
        win.show().map_err(|e| e.to_string())?;
        labels.push(label);
    }
    let app2 = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(2));
        for l in labels {
            if let Some(w) = app2.get_webview_window(&l) {
                let _ = w.close();
            }
        }
    });
    Ok(())
}
