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

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
