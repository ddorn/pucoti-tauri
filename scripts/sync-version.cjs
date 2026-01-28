const fs = require('fs');
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
