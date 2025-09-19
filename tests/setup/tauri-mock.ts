// Mock для Tauri API в браузерной среде

// Mock для @tauri-apps/api/core
export const tauriMock = {
  invoke: async (command: string, args: any) => {
    console.log(`[TAURI MOCK] invoke: ${command}`, args);
    
    if (command === 'compute_progressive_weight_command') {
      const { params } = args;
      // Простая имитация расчёта прогрессии
      const progressiveWeight = params.base * Math.pow(1 + params.percent_per_cycle / 100, params.cycles_completed);
      return {
        weight: Math.round(progressiveWeight * 10) / 10,
        formatted: `${Math.round(progressiveWeight * 10) / 10} ${params.unit}`
      };
    }
    
    return null;
  }
};

// Mock для @tauri-apps/plugin-sql
export const sqlMock = {
  Database: {
    load: async (dbPath: string) => {
      console.log(`[SQL MOCK] Database.load: ${dbPath}`);
      return {
        select: async (query: string, params: any[]) => {
          console.log(`[SQL MOCK] select: ${query}`, params);
          
          // Mock данных для программ
          if (query.includes('FROM programs')) {
            return [{
              id: 1,
              start_date: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 дней назад
              cycle_type: 'weekly',
              cycle_days: 7
            }];
          }
          
          // Mock данных для упражнений
          if (query.includes('FROM program_day_exercises')) {
            return [
              {
                id: 1,
                work_weight: 100.0,
                progression_percent: 2.5,
                weight_unit: 'kg',
                weight_increment: 2.5,
                updated_at: null
              },
              {
                id: 2,
                work_weight: 80.0,
                progression_percent: 5.0,
                weight_unit: 'kg',
                weight_increment: 1.25,
                updated_at: null
              }
            ];
          }
          
          // Mock данных для тренировочных сессий
          if (query.includes('FROM training_sessions')) {
            return [
              {
                created_at: Date.now() - 25 * 24 * 60 * 60 * 1000 // 25 дней назад
              },
              {
                created_at: Date.now() - 18 * 24 * 60 * 60 * 1000 // 18 дней назад
              },
              {
                created_at: Date.now() - 11 * 24 * 60 * 60 * 1000 // 11 дней назад
              },
              {
                created_at: Date.now() - 4 * 24 * 60 * 60 * 1000 // 4 дня назад
              }
            ];
          }
          
          return [];
        },
        
        execute: async (query: string, params: any[]) => {
          console.log(`[SQL MOCK] execute: ${query}`, params);
          return { rowsAffected: 1 };
        }
      };
    }
  }
};

// Глобальная функция для инъекции mock'ов
export function injectTauriMocks() {
  if (typeof window !== 'undefined') {
    // Mock для invoke
    (window as any).__TAURI_IPC__ = {
      invoke: tauriMock.invoke
    };
    
    // Метка что Tauri API доступен
    (window as any).__TAURI__ = {
      invoke: tauriMock.invoke
    };
    
    // Mock для SQL плагина через глобальную переменную
    (window as any).__TAURI_PLUGIN_SQL__ = sqlMock;
    
    console.log('[TAURI MOCK] Mocks injected successfully');
  }
}
