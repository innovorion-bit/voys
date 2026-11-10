mod activity;

use tauri::Manager;

#[tauri::command]
fn detect_running_game() -> Option<String> {
  activity::detect_running_game()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  std::panic::set_hook(Box::new(|info| {
    let msg = format!("PANIC: {}\n", info);
    let _ = std::fs::write("tauri_panic.log", msg);
  }));

  let res = tauri::Builder::default()
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .invoke_handler(tauri::generate_handler![detect_running_game])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      if let Some(window) = app.get_webview_window("main") {
        if let Some(icon) = app.default_window_icon() {
          let _ = window.set_icon(icon.clone());
        }
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
      }
      Ok(())
    })
    .run(tauri::generate_context!());

  if let Err(e) = res {
    let _ = std::fs::write("tauri_error.log", format!("RUN ERROR: {:?}\n", e));
  }
}
