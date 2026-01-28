use tauri::Manager;

#[cfg(target_os = "linux")]
mod dbus_service;

#[tauri::command]
fn play_bell(app: tauri::AppHandle, custom_bell_path: Option<String>) {
  // Spawn a thread to avoid blocking the main thread
  std::thread::spawn(move || {
    if let Err(e) = play_bell_internal(&app, custom_bell_path) {
      log::error!("Failed to play bell: {}", e);
    }
  });
}

fn play_bell_internal(app: &tauri::AppHandle, custom_bell_path: Option<String>) -> Result<(), Box<dyn std::error::Error>> {
  // Determine which bell to play
  let bell_path = if let Some(custom_path) = custom_bell_path {
    if !custom_path.is_empty() && std::path::Path::new(&custom_path).exists() {
      std::path::PathBuf::from(custom_path)
    } else {
      // Custom path specified but invalid, fall back to bundled
      log::warn!("Custom bell path invalid or not found, using bundled bell");
      app.path().resource_dir()?.join("bell.mp3")
    }
  } else {
    // No custom path, use bundled
    app.path().resource_dir()?.join("bell.mp3")
  };

  // Read the audio file
  let file = std::fs::File::open(bell_path)?;
  let source = rodio::Decoder::new(std::io::BufReader::new(file))?;

  // Get an output stream and create a sink for playback control
  let (_stream, stream_handle) = rodio::OutputStream::try_default()?;
  let sink = rodio::Sink::try_new(&stream_handle)?;

  // Append the audio source and wait until it finishes playing
  sink.append(source);
  sink.sleep_until_end();

  Ok(())
}

/// Update timer state for D-Bus service (Linux only)
/// On non-Linux platforms, this is a no-op
#[cfg(target_os = "linux")]
#[tauri::command]
fn update_timer_state(
    state: tauri::State<'_, dbus_service::SharedTimerState>,
    running: bool,
    remaining_seconds: i32,
    focus_text: String,
    is_overtime: bool,
) {
    dbus_service::update_state(&state, running, remaining_seconds, focus_text, is_overtime);
}

/// Update timer state - no-op on non-Linux platforms
#[cfg(not(target_os = "linux"))]
#[tauri::command]
fn update_timer_state(
    _running: bool,
    _remaining_seconds: i32,
    _focus_text: String,
    _is_overtime: bool,
) {
    // No-op on non-Linux platforms
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Initialize D-Bus service on Linux
      #[cfg(target_os = "linux")]
      {
        use std::sync::{Arc, RwLock};

        // Create shared timer state
        let timer_state: dbus_service::SharedTimerState = Arc::new(RwLock::new(dbus_service::TimerState::default()));

        // Store in app state for Tauri commands
        app.manage(timer_state.clone());

        // Start D-Bus service in background
        let state_clone = timer_state.clone();
        std::thread::spawn(move || {
          let rt = tokio::runtime::Runtime::new().unwrap();
          rt.block_on(async {
            match dbus_service::init_dbus_service(state_clone).await {
              Ok(_connection) => {
                log::info!("D-Bus service initialized successfully");
                // Keep the connection alive indefinitely (thread dies with app)
                loop {
                  tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;
                }
              }
              Err(e) => {
                log::error!("Failed to initialize D-Bus service: {}", e);
              }
            }
          });
        });
      }

      Ok(())
    })
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![play_bell, update_timer_state])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
