// Embed the default bell sound at compile time (325KB)
const DEFAULT_BELL_MP3: &[u8] = include_bytes!("../bell.mp3");

use tauri::Manager;
use tauri_plugin_cli::CliExt;

#[cfg(target_os = "linux")]
mod dbus_service;

#[tauri::command]
fn play_bell(_app: tauri::AppHandle, custom_bell_path: Option<String>) {
  // Spawn a thread to avoid blocking the main thread
  std::thread::spawn(move || {
    if let Err(e) = play_bell_internal(custom_bell_path) {
      log::error!("Failed to play bell: {}", e);
    }
  });
}

fn play_bell_internal(custom_bell_path: Option<String>) -> Result<(), Box<dyn std::error::Error>> {
  // Try custom bell first if provided
  if let Some(custom_path) = custom_bell_path {
    if !custom_path.is_empty() && std::path::Path::new(&custom_path).exists() {
      log::info!("Using custom bell path: {}", custom_path);
      let file = std::fs::File::open(&custom_path)?;
      let source = rodio::Decoder::new(std::io::BufReader::new(file))?;

      let (_stream, stream_handle) = rodio::OutputStream::try_default()?;
      let sink = rodio::Sink::try_new(&stream_handle)?;
      sink.append(source);
      sink.sleep_until_end();

      return Ok(());
    } else {
      log::warn!("Custom bell path '{}' invalid or not found, using embedded bell", custom_path);
    }
  }

  // Use embedded default bell
  log::info!("Using embedded default bell ({} bytes)", DEFAULT_BELL_MP3.len());

  // Decode the embedded MP3 bytes
  let cursor = std::io::Cursor::new(DEFAULT_BELL_MP3);
  let source = rodio::Decoder::new(cursor)?;

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
    .plugin(tauri_plugin_cli::init())
    .setup(|app| {
      // Handle CLI arguments
      match app.cli().matches() {
        Ok(matches) => {
          // Check if help flag was passed (occurrences > 0)
          if let Some(data) = matches.args.get("help") {
            if data.occurrences > 0 {
              println!("Pucoti {}", app.package_info().version);
              println!();
              println!("A timer to stay on track and make predictions to overcome the planning fallacy.");
              println!();
              println!("Pucoti helps you track predicted vs actual task durations and provides");
              println!("calibration statistics to improve your time estimation accuracy over time.");
              println!();
              println!("USAGE:");
              println!("    pucoti [OPTIONS]");
              println!();
              println!("OPTIONS:");
              println!("    -h, --help       Print help information");
              println!("    -v, --version    Print version information");
              std::process::exit(0);
            }
          }

          // Check if version flag was passed (occurrences > 0)
          if let Some(data) = matches.args.get("version") {
            if data.occurrences > 0 {
              println!("Pucoti {}", app.package_info().version);
              std::process::exit(0);
            }
          }
        }
        Err(_) => {
          // No CLI args, continue normally
        }
      }

      // Enable logging in both debug and release modes
      let log_level = if cfg!(debug_assertions) {
        log::LevelFilter::Debug
      } else {
        log::LevelFilter::Info
      };

      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log_level)
          .build(),
      )?;

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
