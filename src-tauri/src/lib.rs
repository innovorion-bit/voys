mod activity;
mod ptt;

use tauri::Manager;

#[tauri::command]
fn detect_running_game() -> Option<String> {
  activity::detect_running_game()
}

#[tauri::command]
fn start_ptt_listener(
  app: tauri::AppHandle,
  state: tauri::State<'_, ptt::PttController>,
  shortcut_key: String,
  generation: Option<u64>,
) -> Result<bool, String> {
  ptt::start_ptt_listener(app, &state, shortcut_key, generation)
}

#[tauri::command]
fn stop_ptt_listener(state: tauri::State<'_, ptt::PttController>) {
  ptt::stop_ptt_listener(&state);
}

#[tauri::command]
fn open_external_url(url: String) -> Result<bool, String> {
  let trimmed = url.trim();
  if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
    return Err("Geçersiz link protokolü".into());
  }

  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    std::process::Command::new("cmd")
      .args(["/C", "start", "", trimmed])
      .creation_flags(CREATE_NO_WINDOW)
      .spawn()
      .map_err(|e| e.to_string())?;
    Ok(true)
  }

  #[cfg(not(target_os = "windows"))]
  {
    std::process::Command::new("xdg-open")
      .arg(trimmed)
      .spawn()
      .map_err(|e| e.to_string())?;
    Ok(true)
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  std::panic::set_hook(Box::new(|info| {
    let msg = format!("PANIC: {}\n", info);
    let _ = std::fs::write("tauri_panic.log", msg);
  }));

  let app_res = tauri::Builder::default()
    .manage(ptt::PttController::default())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .invoke_handler(tauri::generate_handler![
      detect_running_game,
      start_ptt_listener,
      stop_ptt_listener,
      open_external_url
    ])
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
    .build(tauri::generate_context!());

  match app_res {
    Ok(app) => {
      app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
          app_handle.state::<ptt::PttController>().stop();
        }
      });
    }
    Err(e) => {
      let _ = std::fs::write("tauri_error.log", format!("RUN ERROR: {:?}\n", e));
    }
  }
}
