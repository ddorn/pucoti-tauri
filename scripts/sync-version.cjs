const fs = require('fs');
const { execSync } = require('child_process');
const version = require('../package.json').version;

// Update tauri.conf.json
const tauriConfPath = 'src-tauri/tauri.conf.json';
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = version;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log(`Updated ${tauriConfPath} to ${version}`);

// Update Cargo.toml
const cargoPath = 'src-tauri/Cargo.toml';
let cargo = fs.readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(/^version = ".*"/m, `version = "${version}"`);
fs.writeFileSync(cargoPath, cargo);
console.log(`Updated ${cargoPath} to ${version}`);

// Update Cargo.lock
try {
  execSync('cargo update -p pucoti --manifest-path src-tauri/Cargo.toml', { stdio: 'inherit' });
  console.log(`Updated Cargo.lock to ${version}`);
} catch (error) {
  console.error('Failed to update Cargo.lock:', error.message);
  process.exit(1);
}
