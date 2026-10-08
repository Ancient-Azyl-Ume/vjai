// Native application menu. Every custom item id is forwarded to the frontend as a
// "menu" event; src/ui/shell/commands.ts maps ids to the same commands the top bar runs.
use serde_json::Value;
use tauri::menu::{AboutMetadata, Menu, MenuBuilder, MenuEvent, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Runtime};

// Panel ids live in src/ui/panels/registry.ts; this list mirrors it for the View menu.
const PANELS: [(&str, &str); 9] = [
    ("preview", "Preview"),
    ("layers", "Layers"),
    ("mapping", "Mapping"),
    ("mods", "Mods"),
    ("graph", "Graph"),
    ("media", "Media"),
    ("deck", "Deck"),
    ("chat", "Chat"),
    ("settings", "Settings"),
];

// Recent shows are read from the same config file the frontend writes; the menu is
// built once at startup, so new entries show up on the next launch.
fn recent() -> Vec<String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    let path = std::path::PathBuf::from(home).join(".config/vjai/config.json");
    let text = match std::fs::read_to_string(path) {
        Ok(t) => t,
        Err(_) => return Vec::new(),
    };
    let cfg: Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    cfg.get("recent")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).take(8).collect())
        .unwrap_or_default()
}

fn short(path: &str) -> String {
    path.rsplit('/').next().unwrap_or(path).to_string()
}

// Cmd+Z / B / F / Space carry no menu accelerator on purpose: an accelerator fires even
// while typing in the chat box, so those keys stay with the frontend handler, which
// ignores text fields (src/ui/shell/App.tsx).
pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let item = |id: &str, label: &str, accel: Option<&str>| {
        let mut b = MenuItemBuilder::with_id(id.to_string(), label);
        if let Some(a) = accel {
            b = b.accelerator(a);
        }
        b.build(app)
    };

    let app_menu = SubmenuBuilder::new(app, "vjai")
        .about(Some(AboutMetadata::default()))
        .separator()
        .quit()
        .build()?;

    let mut file = SubmenuBuilder::new(app, "File")
        .item(&item("new", "New Show", Some("CmdOrCtrl+N"))?)
        .item(&item("open", "Open Show...", Some("CmdOrCtrl+O"))?)
        .item(&item("save", "Save", Some("CmdOrCtrl+S"))?)
        .item(&item("save_as", "Save As...", Some("CmdOrCtrl+Shift+S"))?);
    let paths = recent();
    if !paths.is_empty() {
        let mut sub = SubmenuBuilder::new(app, "Open Recent");
        for p in &paths {
            sub = sub.item(&item(&format!("open:{}", p), &short(p), None)?);
        }
        file = file.separator().item(&sub.build()?);
    }
    let file = file.build()?;

    let edit = SubmenuBuilder::new(app, "Edit")
        .item(&item("undo", "Undo", None)?)
        .item(&item("redo", "Redo", None)?)
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let mut view = SubmenuBuilder::new(app, "View");
    for (id, label) in PANELS {
        view = view.item(&item(&format!("view:{}", id), label, None)?);
    }
    let view = view.separator().item(&item("view:reset", "Reset Layout", None)?).build()?;

    let output = SubmenuBuilder::new(app, "Output")
        .item(&item("out:open_all", "Open All Outputs", None)?)
        .item(&item("out:close_all", "Close All Outputs", None)?)
        .item(&item("out:identify", "Identify Monitors", None)?)
        .separator()
        .item(&item("blackout", "Blackout", None)?)
        .build()?;

    let help = SubmenuBuilder::new(app, "Help")
        .item(&item("help:shortcuts", "Keyboard Shortcuts", None)?)
        .build()?;

    MenuBuilder::new(app)
        .items(&[&app_menu, &file, &edit, &view, &output, &help])
        .build()
}

pub fn on_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    let _ = app.emit("menu", event.id().0.clone());
}
