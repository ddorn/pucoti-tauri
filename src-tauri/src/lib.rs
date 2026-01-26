use tauri::Manager;
use rodio::Source;

#[tauri::command]
fn play_bell(app: tauri::AppHandle) {
  // Spawn a thread to avoid blocking the main thread
  std::thread::spawn(move || {
    if let Err(e) = play_bell_internal(&app) {
      log::error!("Failed to play bell: {}", e);
    }
  });
}

fn play_bell_internal(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
  // Get the resource path for the bell.mp3 file
  let resource_path = app.path().resource_dir()?.join("bell.mp3");

  // Read the audio file
  let file = std::fs::File::open(resource_path)?;
  let source = rodio::Decoder::new(std::io::BufReader::new(file))?;

  // Get an output stream and play the sound
  let (_stream, stream_handle) = rodio::OutputStream::try_default()?;
  stream_handle.play_raw(source.convert_samples())?;

  // Sleep to allow the sound to finish playing
  // MP3 duration detection is complex, so we use a fixed duration
  // The bell.mp3 should be short (< 2 seconds)
  std::thread::sleep(std::time::Duration::from_secs(2));

  Ok(())
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
      Ok(())
    })
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![play_bell])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
