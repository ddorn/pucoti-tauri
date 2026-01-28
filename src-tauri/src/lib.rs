use tauri::Manager;

// Embed the default bell sound at compile time (325KB)
const DEFAULT_BELL_MP3: &[u8] = include_bytes!("../bell.mp3");

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
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

      Ok(())
    })
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![play_bell])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
