use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, State, Manager};
use tauri_plugin_store::StoreExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthUser {
    pub id: i64,
    pub email: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub success: bool,
    pub message: String,
    pub user: Option<AuthUser>,
    pub token: Option<String>,
}

// Простое хранилище сессий в памяти
pub type SessionStore = Mutex<HashMap<String, AuthUser>>;

// Генерируем простой токен сессии
fn generate_session_token() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ\
                            abcdefghijklmnopqrstuvwxyz\
                            0123456789";
    let mut rng = rand::thread_rng();
    (0..32)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

// Хешируем пароль с Argon2
#[tauri::command]
pub fn hash_password(password: String) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| {
            log::error!("[RUST AUTH] Password hashing error: {}", e);
            "Password hashing failed".to_string()
        })?
        .to_string();
    Ok(password_hash)
}

// Проверяем пароль - поддерживаем и старые SHA-256, и новые Argon2
#[tauri::command]
pub fn verify_password(password: String, hash: String) -> Result<bool, String> {
    // Проверяем, это Argon2 хеш (начинается с $argon2)
    if hash.starts_with("$argon2") {
        log::info!("[RUST AUTH] Verifying Argon2 hash");
        let parsed_hash = PasswordHash::new(&hash).map_err(|e| {
            log::error!("[RUST AUTH] Argon2 hash parsing error: {}", e);
            "Password verification failed".to_string()
        })?;

        let argon2 = Argon2::default();
        Ok(argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok())
    } else {
        log::info!("[RUST AUTH] Verifying legacy SHA-256 hash");
        // Это старый SHA-256 хеш, нужен salt
        Err("Legacy SHA-256 verification not implemented in Rust".to_string())
    }
}

// Создаем сессию
#[tauri::command]
pub async fn create_session(
    app: AppHandle,
    sessions: State<'_, SessionStore>,
    user: AuthUser,
) -> Result<String, String> {
    let token = generate_session_token();
    sessions.lock().unwrap().insert(token.clone(), user.clone());

    // Сохраняем в Store для персистентности
    if let Ok(store) = app.store("session.json") {
        let _ = store.set("current_user", serde_json::to_value(&user).unwrap());
        let _ = store.set("auth_token", serde_json::to_value(&token).unwrap());
        let _ = store.save();
    }

    log::info!("[RUST AUTH] Session created for user ID: {}", user.id);
    Ok(token)
}

#[tauri::command]
pub async fn check_session(
    app: AppHandle,
    sessions: State<'_, SessionStore>,
) -> Result<AuthResponse, String> {
    log::info!("[RUST AUTH] Checking session");

    // Пытаемся восстановить сессию из Store
    if let Ok(store) = app.store("session.json") {
        if let (Some(user_value), Some(token_value)) = (
            store.get("current_user"),
            store.get("auth_token")
        ) {
            if let (Ok(user), Ok(token)) = (
                serde_json::from_value::<AuthUser>(user_value),
                serde_json::from_value::<String>(token_value)
            ) {
                // Проверяем, есть ли сессия в памяти
                if sessions.lock().unwrap().contains_key(&token) {
                    log::info!("[RUST AUTH] Session restored for user ID: {}", user.id);
                    return Ok(AuthResponse {
                        success: true,
                        message: "Сессия активна".to_string(),
                        user: Some(user.clone()),
                        token: Some(token.clone()),
                    });
                } else {
                    // Восстанавливаем сессию в памяти
                    sessions.lock().unwrap().insert(token.clone(), user.clone());
                    log::info!("[RUST AUTH] Session restored to memory for user ID: {}", user.id);
                    return Ok(AuthResponse {
                        success: true,
                        message: "Сессия восстановлена".to_string(),
                        user: Some(user),
                        token: Some(token),
                    });
                }
            }
        }
    }

    log::info!("[RUST AUTH] No active session found");

    Ok(AuthResponse {
        success: false,
        message: "Нет активной сессии".to_string(),
        user: None,
        token: None,
    })
}

#[tauri::command]
pub async fn destroy_session(
    app: AppHandle,
    sessions: State<'_, SessionStore>,
    token: String,
) -> Result<AuthResponse, String> {
    log::info!("[RUST AUTH] Destroying session");

    // Удаляем из сессий
    sessions.lock().unwrap().remove(&token);

    // Очищаем Store
    if let Ok(store) = app.store("session.json") {
        let _ = store.delete("current_user");
        let _ = store.delete("auth_token");
        let _ = store.save();
    }

    log::info!("[RUST AUTH] Session destroyed");

    Ok(AuthResponse {
        success: true,
        message: "Выход выполнен".to_string(),
        user: None,
        token: None,
    })
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn register_user(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, SessionStore>,
    email: String,
    password: String,
    displayName: String,
) -> Result<serde_json::Value, String> {
    log::info!("[RUST AUTH] Starting registration for email: {}", email);
    
    // Hash password
    let _hash = hash_password(password.clone())?;
    log::info!("[RUST AUTH] Password hashed successfully");
    
    // Create user (simplified - just create with ID 1 for now)
    let auth_user = AuthUser {
        id: 1,
        email: email.clone(),
        display_name: Some(displayName.clone()),
    };
    log::info!("[RUST AUTH] AuthUser created with ID: {}", auth_user.id);

    // Create session
    let token = create_session(app, sessions, auth_user.clone()).await?;
    log::info!("[RUST AUTH] Session created with token length: {}", token.len());

    let result = serde_json::json!({
        "success": true,
        "message": "Регистрация успешна",
        "user": auth_user,
        "token": token,
        "refresh_token": null
    });
    
    log::info!("[RUST AUTH] Registration completed successfully for: {}", email);
    Ok(result)
}

#[tauri::command]
pub async fn login_user(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, SessionStore>,
    email: String,
    password: String,
) -> Result<serde_json::Value, String> {
    log::info!("[RUST AUTH] Starting login for email: {}", email);
    
    // Simple hardcoded check for now
    if email == "test@test.com" && password == "test123" {
        log::info!("[RUST AUTH] Hardcoded credentials matched");
        
        let auth_user = AuthUser {
            id: 1,
            email: email.clone(),
            display_name: Some("Test User".to_string()),
        };

        let token = create_session(app, sessions, auth_user.clone()).await?;
        log::info!("[RUST AUTH] Login session created successfully");

        let result = serde_json::json!({
            "success": true,
            "message": "Вход выполнен",
            "user": auth_user,
            "token": token,
            "refresh_token": null
        });
        
        log::info!("[RUST AUTH] Login completed successfully for: {}", email);
        Ok(result)
    } else {
        log::warn!("[RUST AUTH] Invalid credentials for email: {}", email);
        Ok(serde_json::json!({
            "success": false,
            "message": "Неверные данные для входа",
        }))
    }
}
