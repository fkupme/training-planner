use serde::{Deserialize, Serialize};
use tauri::{AppHandle, command};

#[derive(Debug, Serialize, Deserialize)]
pub struct ProgressiveWeightParams {
    pub base: f64,
    pub cycles_completed: u32,
    pub percent_per_cycle: f64,
    pub unit: String, // "kg" or "lb"
    pub increment: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProgressiveWeightResult {
    pub weight: f64,
    pub formatted: String,
}

// Функция вычисления прогрессивного веса
pub fn compute_progressive_weight(
    base: f64,
    cycles_completed: u32,
    percent_per_cycle: f64,
    unit: &str,
    increment: Option<f64>,
) -> (f64, String) {
    if cycles_completed == 0 {
        let formatted = format!("{:.1} {}", base, unit);
        return (base, formatted);
    }

    // Формула сложного процента: new_weight = base * (1 + percent_per_cycle/100)^cycles_completed
    let multiplier = 1.0 + percent_per_cycle / 100.0;
    let raw_weight = base * multiplier.powi(cycles_completed as i32);

    // Округление до ближайшего инкремента
    let increment_val = increment.unwrap_or(2.5);
    let rounded_weight = (raw_weight / increment_val).round() * increment_val;

    let formatted = format!("{:.1} {}", rounded_weight, unit);
    (rounded_weight, formatted)
}

#[command]
pub async fn calculate_completed_cycles(
    app: AppHandle,
    program_id: i64,
    exercise_id: i64,
    current_timestamp: i64,
) -> Result<u32, String> {
    let db = app.state::<tauri_plugin_sql::Sql>();

    // Получаем информацию о программе
    let program_query = "
        SELECT start_date, cycle_type, cycle_days, updated_at 
        FROM programs 
        WHERE id = ?
    ";
    
    let program_result = db
        .query("sqlite:training.db", program_query, vec![program_id.into()])
        .await
        .map_err(|e| format!("Program query error: {}", e))?;

    if program_result.is_empty() {
        return Err("Program not found".to_string());
    }

    let row = &program_result[0];
    let start_date: i64 = row.get(0).unwrap().as_i64().unwrap();
    let cycle_type: String = row.get(1).unwrap().as_str().unwrap().to_string();
    let cycle_days: Option<i64> = row.get(2).and_then(|v| v.as_i64());

    // Получаем информацию об упражнении
    let exercise_query = "
        SELECT updated_at 
        FROM program_day_exercises 
        WHERE id = ?
    ";
    
    let exercise_result = db
        .query("sqlite:training.db", exercise_query, vec![exercise_id.into()])
        .await
        .map_err(|e| format!("Exercise query error: {}", e))?;

    if exercise_result.is_empty() {
        return Err("Exercise not found".to_string());
    }

    let exercise_row = &exercise_result[0];
    let exercise_updated_at: Option<i64> = exercise_row.get(0).and_then(|v| v.as_i64());

    // Определяем стартовую дату для расчёта
    let calculation_start = if let Some(updated_at) = exercise_updated_at {
        if updated_at > start_date {
            updated_at
        } else {
            start_date
        }
    } else {
        start_date
    };

    // Вычисляем количество завершённых циклов
    let elapsed_ms = current_timestamp - calculation_start;
    let elapsed_days = elapsed_ms / (24 * 60 * 60 * 1000);

    let cycles_completed = match cycle_type.as_str() {
        "weekly" => (elapsed_days / 7) as u32,
        "custom" => {
            if let Some(days) = cycle_days {
                (elapsed_days / days) as u32
            } else {
                return Err("Custom cycle requires cycle_days".to_string());
            }
        }
        _ => return Err(format!("Unsupported cycle type: {}", cycle_type)),
    };

    Ok(cycles_completed)
}

#[command]
pub async fn update_progressive_weights(
    app: AppHandle,
    program_id: i64,
    current_timestamp: i64,
) -> Result<String, String> {
    let db = app.state::<tauri_plugin_sql::Sql>();

    // Сначала получаем все упражнения программы
    let exercises_query = "
        SELECT pde.id, pde.work_weight, pde.progression_percent, pde.weight_unit,
               pde.weight_increment, pde.updated_at
        FROM program_day_exercises pde
        INNER JOIN program_days pd ON pde.program_day_id = pd.id
        WHERE pd.program_id = ? AND pde.work_weight IS NOT NULL
        ORDER BY pde.id
    ";

    let exercises = db
        .query("sqlite:training.db", exercises_query, vec![program_id.into()])
        .await
        .map_err(|e| format!("Failed to fetch exercises: {}", e))?;

    if exercises.is_empty() {
        return Ok("No exercises found for this program".to_string());
    }

    let mut updated_count = 0;
    let mut results = Vec::new();

    for exercise in exercises {
        let exercise_id: i64 = exercise.get(0).unwrap().as_i64().unwrap();
        let current_weight: f64 = exercise.get(1).unwrap().as_f64().unwrap();
        let progression_percent: Option<f64> = exercise.get(2).and_then(|v| v.as_f64());
        let weight_unit: String = exercise.get(3).unwrap().as_str().unwrap_or("kg").to_string();
        let weight_increment: Option<f64> = exercise.get(4).and_then(|v| v.as_f64());

        // Пропускаем упражнения без настроенной прогрессии
        let percent = match progression_percent {
            Some(p) if p > 0.0 => p,
            _ => continue,
        };

        // Вычисляем количество завершённых циклов
        let cycles = calculate_completed_cycles(
            app.clone(),
            program_id,
            exercise_id,
            current_timestamp,
        )
        .await?;

        if cycles == 0 {
            continue;
        }

        // Вычисляем новый вес
        let (new_weight, formatted) = compute_progressive_weight(
            current_weight,
            cycles,
            percent,
            &weight_unit,
            weight_increment,
        );

        // Проверяем, нужно ли обновление (с учётом погрешности)
        if (new_weight - current_weight).abs() > 0.1 {
            let update_query = "
                UPDATE program_day_exercises 
                SET work_weight = ?, updated_at = NULL 
                WHERE id = ?
            ";

            db.execute(
                "sqlite:training.db",
                update_query,
                vec![new_weight.into(), exercise_id.into()],
            )
            .await
            .map_err(|e| format!("Failed to update exercise {}: {}", exercise_id, e))?;

            updated_count += 1;
            results.push(format!(
                "Exercise {}: {:.1} → {}",
                exercise_id, current_weight, formatted
            ));
        }
    }

    if updated_count > 0 {
        Ok(format!(
            "Updated {} exercises:\n{}",
            updated_count,
            results.join("\n")
        ))
    } else {
        Ok("No weight updates needed".to_string())
    }
}

#[command]
pub async fn compute_progressive_weight_command(params: ProgressiveWeightParams) -> Result<ProgressiveWeightResult, String> {
    let (weight, formatted) = compute_progressive_weight(
        params.base,
        params.cycles_completed,
        params.percent_per_cycle,
        &params.unit,
        params.increment,
    );

    Ok(ProgressiveWeightResult { weight, formatted })
}
