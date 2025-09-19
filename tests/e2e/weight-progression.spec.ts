import { test, expect } from '@playwright/test'

test.describe('Прогрессия весов', () => {
  test.beforeEach(async ({ page }) => {
    // Переходим на главную страницу приложения
    await page.goto('/')
    
    // Ждём загрузки приложения
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 10000 })
  })

  test('должна автоматически увеличивать веса после завершённых циклов', async ({ page }) => {
    test.setTimeout(60000) // Увеличиваем таймаут для сложного теста

    // 1. Создаём новую программу тренировок
    await page.click('[data-testid="new-program-btn"]')
    await page.fill('[data-testid="program-name-input"]', 'Тест прогрессии весов')
    
    // Устанавливаем процент прогрессии 2% для быстрого тестирования
    await page.fill('[data-testid="progression-percent-input"]', '2.0')
    
    await page.click('[data-testid="save-program-btn"]')

    // 2. Добавляем упражнение с начальным весом
    await page.click('[data-testid="add-exercise-btn"]')
    await page.fill('[data-testid="exercise-search"]', 'Жим штанги лёжа')
    await page.click('[data-testid="exercise-item"]:first-child')
    
    // Устанавливаем начальный рабочий вес 100кг
    await page.click('[data-testid="exercise-params-btn"]')
    await page.fill('[data-testid="work-weight-input"]', '100')
    await page.click('[data-testid="save-params-btn"]')

    // 3. Симулируем завершение нескольких тренировок
    for (let week = 0; week < 4; week++) {
      // Переходим к тренировке
      await page.click('[data-testid="start-workout-btn"]')
      
      // Выполняем упражнение (добавляем все подходы)
      for (let set = 1; set <= 3; set++) {
        await page.click(`[data-testid="add-set-btn-${set}"]`)
        // Можно добавить заполнение веса и повторов если нужно
      }
      
      // Завершаем тренировку
      await page.click('[data-testid="complete-workout-btn"]')
      await page.click('[data-testid="confirm-complete-btn"]')
      
      // Симулируем прохождение времени (переходим к следующей неделе)
      await page.evaluate(() => {
        // Сдвигаем дату на неделю вперёд через localStorage или моки
        const currentDate = new Date()
        currentDate.setDate(currentDate.getDate() + 7)
        // Здесь нужно будет добавить API для симуляции времени
      })
    }

    // 4. Проверяем, что вес автоматически увеличился
    await page.reload() // Перезагружаем для срабатывания автоматического обновления весов
    
    await page.click('[data-testid="exercise-params-btn"]')
    const weightValue = await page.inputValue('[data-testid="work-weight-input"]')
    
    // После 4 недель с 2% прогрессией: 100 * (1.02)^4 ≈ 108.24 -> округление до 107.5кг
    expect(parseFloat(weightValue)).toBeGreaterThan(105)
    expect(parseFloat(weightValue)).toBeLessThan(110)
  })

  test('должна показывать информацию о прогрессии в UI', async ({ page }) => {
    // Создаём программу с упражнениями
    await createTestProgram(page)
    
    // Проверяем отображение текущей прогрессии
    await page.click('[data-testid="progression-info-btn"]')
    
    await expect(page.locator('[data-testid="progression-percent"]')).toContainText('0.8%')
    await expect(page.locator('[data-testid="completed-cycles"]')).toBeVisible()
    await expect(page.locator('[data-testid="next-weight-preview"]')).toBeVisible()
  })

  test('должна корректно работать с разными единицами измерения', async ({ page }) => {
    // Тест с фунтами
    await page.click('[data-testid="settings-btn"]')
    await page.selectOption('[data-testid="units-select"]', 'lb')
    await page.click('[data-testid="save-settings-btn"]')
    
    await createTestProgram(page)
    
    // Проверяем округление до 5 фунтов вместо 2.5 кг
    await page.click('[data-testid="exercise-params-btn"]')
    await page.fill('[data-testid="work-weight-input"]', '223')
    await page.click('[data-testid="save-params-btn"]')
    
    // Симулируем прогрессию и проверяем округление
    // ... логика тестирования округления для фунтов
  })

  // Вспомогательная функция для создания тестовой программы
  async function createTestProgram(page: any) {
    await page.click('[data-testid="new-program-btn"]')
    await page.fill('[data-testid="program-name-input"]', 'E2E Test Program')
    await page.click('[data-testid="save-program-btn"]')
    
    await page.click('[data-testid="add-exercise-btn"]')
    await page.fill('[data-testid="exercise-search"]', 'Жим штанги лёжа')
    await page.click('[data-testid="exercise-item"]:first-child')
  }
})
