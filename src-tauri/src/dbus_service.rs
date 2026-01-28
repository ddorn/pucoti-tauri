use std::sync::{Arc, RwLock};
use zbus::{interface, Connection};

/// Timer state shared between the Tauri frontend and D-Bus service
#[derive(Clone, Debug, Default)]
pub struct TimerState {
    pub running: bool,
    pub remaining_seconds: i32,
    pub focus_text: String,
    pub is_overtime: bool,
}

/// Shared state wrapped in Arc<RwLock> for thread-safe access
pub type SharedTimerState = Arc<RwLock<TimerState>>;

/// D-Bus service implementation for org.pucoti.Timer
pub struct TimerDbusService {
    state: SharedTimerState,
}

impl TimerDbusService {
    pub fn new(state: SharedTimerState) -> Self {
        Self { state }
    }
}

#[interface(name = "org.pucoti.Timer")]
impl TimerDbusService {
    /// Get the complete timer state as a tuple
    /// Returns (running, remaining_seconds, focus_text, is_overtime)
    fn get_state(&self) -> (bool, i32, String, bool) {
        let state = self.state.read().unwrap();
        (
            state.running,
            state.remaining_seconds,
            state.focus_text.clone(),
            state.is_overtime,
        )
    }

    /// Property: Whether the timer is currently running
    #[zbus(property)]
    fn running(&self) -> bool {
        self.state.read().unwrap().running
    }

    /// Property: Remaining seconds (negative when overtime)
    #[zbus(property)]
    fn remaining_seconds(&self) -> i32 {
        self.state.read().unwrap().remaining_seconds
    }

    /// Property: Focus text for the current timer
    #[zbus(property)]
    fn focus_text(&self) -> String {
        self.state.read().unwrap().focus_text.clone()
    }

    /// Property: Whether the timer is in overtime
    #[zbus(property)]
    fn is_overtime(&self) -> bool {
        self.state.read().unwrap().is_overtime
    }
}

/// Initialize the D-Bus service on the session bus
pub async fn init_dbus_service(state: SharedTimerState) -> Result<Connection, zbus::Error> {
    let connection = Connection::session().await?;

    // Request the well-known bus name
    connection
        .request_name("org.pucoti.Timer")
        .await?;

    // Create the service and serve it at /org/pucoti/Timer
    let service = TimerDbusService::new(state);
    connection
        .object_server()
        .at("/org/pucoti/Timer", service)
        .await?;

    log::info!("D-Bus service started at org.pucoti.Timer");

    Ok(connection)
}

/// Update the shared timer state (called from Tauri command)
pub fn update_state(
    state: &SharedTimerState,
    running: bool,
    remaining_seconds: i32,
    focus_text: String,
    is_overtime: bool,
) {
    let mut timer_state = state.write().unwrap();
    timer_state.running = running;
    timer_state.remaining_seconds = remaining_seconds;
    timer_state.focus_text = focus_text;
    timer_state.is_overtime = is_overtime;
}
