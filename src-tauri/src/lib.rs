use tauri::Manager;

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
      log::warn!("Custom bell path '{}' invalid or not found, using bundled bell", custom_path);
      app.path().resource_dir()?.join("bell.mp3")
    }
  } else {
    // No custom path, use bundled
    app.path().resource_dir()?.join("bell.mp3")
  };

  log::info!("Attempting to play bell at: {}", bell_path.display());

  // Check if file exists before trying to open
  if !bell_path.exists() {
    log::error!("Bell file does not exist at path: {}", bell_path.display());
    return Err(format!("Bell file not found: {}", bell_path.display()).into());
  }

  // Read the audio file
  let file = std::fs::File::open(&bell_path)?;
  let source = rodio::Decoder::new(std::io::BufReader::new(file))?;

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
