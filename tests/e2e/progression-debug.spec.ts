import { test, expect } from '@playwright/test'

declare global {
  interface Window {
    progressionLogs?: string[]
    __VUE_DEVTOOLS_GLOBAL_HOOK__?: any
    __TAURI__?: any
    mockCurrentDate?: Date
    __PROGRESSION_CHECKED__?: boolean
  }
}

test.describe('Диагностика проблем прогрессии весов', () => {
  test.beforeEach(async ({ page }) => {
    // Инъекция Tauri mock перед каждым тестом
    await page.addInitScript(() => {
      // Mock для Tauri API
      (window as any).__TAURI__ = {
        invoke: async (command: string, args: any) => {
          console.log(`[TAURI MOCK] invoke: ${command}`, args);
          
          if (command === 'compute_progressive_weight_command') {
            const { params } = args;
            const progressiveWeight = params.base * Math.pow(1 + params.percent_per_cycle / 100, params.cycles_completed);
            return {
              weight: Math.round(progressiveWeight * 10) / 10,
              formatted: `${Math.round(progressiveWeight * 10) / 10} ${params.unit}`
            };
          }
          
          return null;
        }
      };

      // Mock для SQL Database
      const mockDatabase = {
        select: async (query: string, params: any[]) => {
          console.log(`[SQL MOCK] select: ${query}`, params);
          
          if (query.includes('FROM programs')) {
            return [{
              id: 1,
              start_date: Date.now() - 30 * 24 * 60 * 60 * 1000,
              cycle_type: 'weekly',
              cycle_days: 7
            }];
          }
          
          if (query.includes('FROM program_day_exercises')) {
            return [
              {
                id: 1,
                work_weight: 100.0,
                progression_percent: 2.5,
                weight_unit: 'kg',
                weight_increment: 2.5,
                updated_at: null
              }
            ];
          }
          
          if (query.includes('FROM training_sessions')) {
            return [
              { created_at: Date.now() - 25 * 24 * 60 * 60 * 1000 },
              { created_at: Date.now() - 18 * 24 * 60 * 60 * 1000 },
              { created_at: Date.now() - 11 * 24 * 60 * 60 * 1000 },
              { created_at: Date.now() - 4 * 24 * 60 * 60 * 1000 }
            ];
          }
          
          return [];
        },
        
        execute: async (query: string, params: any[]) => {
          console.log(`[SQL MOCK] execute: ${query}`, params);
          return { rowsAffected: 1 };
        }
      };

      // Мокаем модуль @tauri-apps/plugin-sql
      (window as any).__TAURI_PLUGIN_SQL__ = {
        Database: {
          load: async () => mockDatabase
        }
      };
    });
  });

  test('проверить существующую логику прогрессии', async ({ page }) => {
    await page.goto('/')
    
    // Добавляем консольный логгер для отслеживания
    await page.addInitScript(() => {
      (window as any).progressionLogs = []
      const originalLog = console.log
      console.log = (...args: any[]) => {
        if (args.some(arg => String(arg).includes('progression') || String(arg).includes('weight'))) {
          (window as any).progressionLogs.push(args.join(' '))
        }
        originalLog.apply(console, args)
      }
    })
    
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 10000 })
    
    // Проверяем, вызывается ли логика прогрессии при входе в приложение
    const logs = await page.evaluate(() => (window as any).progressionLogs || [])
    
    console.log('Логи прогрессии:', logs)
    
    // Проверяем через DevTools, используется ли useProgressiveWeight
    const isProgressiveWeightUsed = await page.evaluate(() => {
      // Ищем использование функций прогрессии в глобальном скоупе Vue приложения
      return (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__ !== undefined
    })
    
    console.log('Vue DevTools доступны:', isProgressiveWeightUsed)
  })

  test('проверить конфигурацию программы', async ({ page }) => {
    await page.goto('/')
    
    // Создаём программу и проверяем, сохраняется ли процент прогрессии
    await page.click('[data-testid="new-program-btn"]', { timeout: 5000 })
    await page.fill('[data-testid="program-name-input"]', 'Debug Program')
    
    // Проверяем, есть ли поле для процента прогрессии
    const progressionField = page.locator('[data-testid="progression-percent-input"]')
    const progressionFieldExists = await progressionField.count() > 0
    
    console.log('Поле процента прогрессии существует:', progressionFieldExists)
    
    if (progressionFieldExists) {
      await progressionField.fill('1.5')
      await page.click('[data-testid="save-program-btn"]')
      
      // Проверяем, что конфигурация сохранилась
      await page.click('[data-testid="edit-program-btn"]')
      const savedValue = await progressionField.inputValue()
      expect(savedValue).toBe('1.5')
    } else {
      console.log('❌ Поле процента прогрессии не найдено - это может быть причиной проблемы!')
      await page.click('[data-testid="save-program-btn"]')
    }
  })

  test('проверить обновление весов через БД', async ({ page }) => {
    await page.goto('/')
    
    // Добавляем функцию для прямого доступа к БД через Tauri
    const dbQuery = await page.evaluate(async () => {
      try {
        // Пытаемся получить доступ к Tauri API
        if ((window as any).__TAURI__) {
          const { invoke } = (window as any).__TAURI__.core
          
          // Проверяем структуру БД
          const tables = await invoke('plugin:sql|execute', {
            db: 'sqlite:training.db',
            query: "SELECT name FROM sqlite_master WHERE type='table';"
          })
          
          return { success: true, tables }
        }
        return { success: false, error: 'Tauri API not available' }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    })
    
    console.log('Результат проверки БД:', dbQuery)
    
    if (dbQuery.success) {
      // Проверяем наличие колонки work_weight
      const workWeightColumn = await page.evaluate(async () => {
        const { invoke } = (window as any).__TAURI__.core
        try {
          const columns = await invoke('plugin:sql|execute', {
            db: 'sqlite:training.db', 
            query: "PRAGMA table_info(program_day_exercises);"
          })
          return columns.find((col: any) => col.name === 'work_weight')
        } catch (error: any) {
          return { error: error.message }
        }
      })
      
      console.log('Колонка work_weight:', workWeightColumn)
    }
  })

  test('проверить запуск автоматического обновления при входе', async ({ page }) => {
    // Мокаем Date для симуляции прошедшего времени
    await page.addInitScript(() => {
      const mockDate = new Date(2025, 8, 21) // 3 недели после текущей даты
      
      // Простой мок Date.now()
      const originalNow = Date.now
      Date.now = () => mockDate.getTime()
      
      ;(window as any).mockCurrentDate = mockDate
      ;(window as any).originalDateNow = originalNow
    })
    
    await page.goto('/')
    
    // Проверяем, вызывается ли проверка прогрессии при загрузке
    const progressionChecked = await page.evaluate(() => {
      // Ищем в Vue stores или глобальных объектах признаки проверки прогрессии
      return (window as any).__PROGRESSION_CHECKED__ || false
    })
    
    console.log('Прогрессия проверена при загрузке:', progressionChecked)
  })
})
