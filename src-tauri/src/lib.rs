mod auth;

use auth::{
    hash_password, verify_password, create_session, check_session, destroy_session, SessionStore,
    login_user, register_user
};
use std::collections::HashMap;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg(target_os = "android")]
use android_logger;
#[cfg(not(target_os = "android"))]
use env_logger;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Инициализируем логгер
    #[cfg(target_os = "android")]
    {
        android_logger::init_once(
            android_logger::Config::default()
                .with_tag("TrainingPlannerRust")
                .with_max_level(log::LevelFilter::Debug),
        );
        log::info!("Android logger initialized");
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = env_logger::builder().is_test(false).try_init();
        log::info!("Desktop logger initialized");
    }

    // Install a panic hook to log panics before abort (helps on Android)
    std::panic::set_hook(Box::new(|info| {
        log::error!("Rust panic: {}", info);
    }));

    tauri::Builder::default()
        // Ensure we don't attempt to create an implicit 'main' window on Android
        .setup(|_app| {
            // Could add future custom initialization here
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(SessionStore::new(HashMap::new()))
        .invoke_handler(tauri::generate_handler![
            greet,
            hash_password,
            verify_password,
            create_session,
            check_session,
            destroy_session,
            login_user,
            register_user
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
