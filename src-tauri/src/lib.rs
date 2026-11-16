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
fn exit_app(app: tauri::AppHandle) {
  app.exit(0);
}

#[tauri::command]
fn open_external_url(url: String) -> Result<bool, String> {
  let trimmed = url.trim();
  if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
    return Err("Geçersiz link protokolü".into());
  }

  #[cfg(target_os = "windows")]
  {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "shell32")]
    unsafe extern "system" {
      fn ShellExecuteW(
        hwnd: isize,
        lpOperation: *const u16,
        lpFile: *const u16,
        lpParameters: *const u16,
        lpDirectory: *const u16,
        nShowCmd: i32,
      ) -> isize;
    }

    let operation: Vec<u16> = OsStr::new("open").encode_wide().chain(std::iter::once(0)).collect();
    let file: Vec<u16> = OsStr::new(trimmed).encode_wide().chain(std::iter::once(0)).collect();

    let res = unsafe {
      ShellExecuteW(
        0,
        operation.as_ptr(),
        file.as_ptr(),
        std::ptr::null(),
        std::ptr::null(),
        1, // SW_SHOWNORMAL
      )
    };

    if res > 32 {
      Ok(true)
    } else {
      Err(format!("ShellExecuteW failed with error code: {}", res))
    }
  }

  #[cfg(target_os = "macos")]
  {
    std::process::Command::new("open")
      .arg(trimmed)
      .spawn()
      .map_err(|e| e.to_string())?;
    Ok(true)
  }

  #[cfg(not(any(target_os = "windows", target_os = "macos")))]
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
  #[cfg(target_os = "windows")]
  {
    unsafe {
      std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-media-suspend --disable-features=CalculateNativeWinOcclusion",
      );
    }
  }

  std::panic::set_hook(Box::new(|info| {
    let msg = format!("PANIC: {}\n", info);
    let _ = std::fs::write("tauri_panic.log", msg);
  }));

  let app_res = tauri::Builder::default()
    .manage(ptt::PttController::default())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
      detect_running_game,
      start_ptt_listener,
      stop_ptt_listener,
      open_external_url,
      exit_app
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
