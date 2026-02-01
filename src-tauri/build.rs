fn main() {
  // Capture git commit hash at build time
  if let Ok(output) = std::process::Command::new("git")
    .args(["rev-parse", "--short", "HEAD"])
    .output()
  {
    if let Ok(commit) = String::from_utf8(output.stdout) {
      println!("cargo:rustc-env=GIT_COMMIT={}", commit.trim());
    }
  }

  // Capture commit headline (first line of commit message)
  if let Ok(output) = std::process::Command::new("git")
    .args(["log", "-1", "--pretty=format:%s"])
    .output()
  {
    if let Ok(headline) = String::from_utf8(output.stdout) {
      println!("cargo:rustc-env=GIT_COMMIT_HEADLINE={}", headline.trim());
    }
  }

  // Check if working tree is dirty (has uncommitted changes)
  if let Ok(output) = std::process::Command::new("git")
    .args(["status", "--porcelain"])
    .output()
  {
    if let Ok(status) = String::from_utf8(output.stdout) {
      let dirty = if status.trim().is_empty() { "false" } else { "true" };
      println!("cargo:rustc-env=GIT_DIRTY={}", dirty);
    }
  }

  // Capture build timestamp
  let now = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap()
    .as_secs();
  println!("cargo:rustc-env=BUILD_TIMESTAMP={}", now);

  tauri_build::build()
}
