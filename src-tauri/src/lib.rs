#![recursion_limit = "256"]
pub mod matrix;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .manage(matrix::client_manager::ClientManager::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            matrix::commands::login,
            matrix::commands::register,
            matrix::commands::login_sso,
            matrix::commands::restore_session,
            matrix::commands::sync,
            matrix::commands::send_message,
            matrix::commands::send_typing_notice,
            matrix::commands::send_read_receipt,
            matrix::commands::send_media,
            matrix::commands::send_call_invite,
            matrix::commands::recover_backup,
            matrix::commands::logout,
            matrix::commands::get_media,
            matrix::commands::get_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
