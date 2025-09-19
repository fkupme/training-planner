use serde::{Deserialize, Serialize};
use tauri::command;

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
