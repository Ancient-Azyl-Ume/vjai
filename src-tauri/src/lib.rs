// vjai host: doc state + patch ops (doc.rs), monitors and output windows (windows.rs),
// files/config/log (files.rs). New commands: add them to their module and append to the
// generate_handler list below (append-only).
mod doc;
mod files;
mod menu;
mod windows;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .menu(menu::build)
        .on_menu_event(menu::on_event)
        .manage(doc::DocState::new())
        .invoke_handler(tauri::generate_handler![
            doc::get_doc,
            doc::set_doc,
            doc::patch_doc,
            windows::list_monitors,
            windows::open_output,
            windows::close_output,
            files::save_doc,
            files::load_doc,
            files::list_dir,
            files::get_config,
            files::set_config,
            files::log_line,
            windows::close_all_outputs,
            windows::identify_monitors
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
