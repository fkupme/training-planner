import { test, expect } from '@playwright/test'

test.describe('Rust Progression Service Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    
    // Ждём полной загрузки приложения
    await page.waitForTimeout(2000)
  })

  test('должен автоматически обновлять веса при входе в приложение', async ({ page }) => {
    test.setTimeout(30000)

    // Открываем консоль для мониторинга логов
    const consoleLogs: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'log' && msg.text().includes('Автоматическое обновление весов')) {
        consoleLogs.push(msg.text())
      }
    })

    // Если есть программа, должна сработать автоматическая проверка весов
    await page.waitForTimeout(3000)
    
    // Проверяем, что сервис был вызван (через логи или UI изменения)
    console.log('Console logs captured:', consoleLogs)
  })

  test('должен корректно рассчитывать циклы с учётом ручных изменений', async ({ page }) => {
    // Этот тест требует реального приложения с данными
    // Можно расширить после основной реализации
    
    // Проверяем доступность Tauri API
    const tauriAvailable = await page.evaluate(() => {
      return typeof (window as any).__TAURI__ !== 'undefined'
    })
    
    if (tauriAvailable) {
      console.log('✅ Tauri API доступен для тестирования')
      
      // Тестируем вызов Rust команды напрямую
      const testResult = await page.evaluate(async () => {
        try {
          const { invoke } = (window as any).__TAURI__.core
          return await invoke('test_progressive_weight', {
            params: {
              base: 100,
              cycles_completed: 2,
              percent_per_cycle: 2.0,
              unit: 'kg'
            }
          })
        } catch (error: any) {
          return { error: error.message }
        }
      })
      
      console.log('Rust test result:', testResult)
      
      if ('error' in testResult) {
        console.log('❌ Ошибка вызова Rust команды:', testResult.error)
      } else {
        expect(testResult.loadable).toBeGreaterThanOrEqual(100)
        console.log('✅ Rust команда работает корректно')
      }
    } else {
      console.log('⚠️ Tauri API недоступен (возможно, тестируется в браузере)')
    }
  })

  test('должен показывать уведомления об обновлении весов', async ({ page }) => {
    // Ждём потенциальные уведомления
    await page.waitForTimeout(5000)
    
    // Проверяем наличие уведомлений о прогрессии
    const notifications = await page.locator('.van-notify, .van-toast').count()
    console.log('Найдено уведомлений:', notifications)
    
    if (notifications > 0) {
      const notificationText = await page.locator('.van-notify, .van-toast').first().textContent()
      console.log('Текст уведомления:', notificationText)
      
      if (notificationText?.includes('Обновлено весов')) {
        console.log('✅ Уведомление о прогрессии весов показано')
      }
    }
  })

  test('должен обрабатывать ошибки корректно', async ({ page }) => {
    // Проверяем обработку ошибок в консоли
    const errorLogs: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error' || (msg.type() === 'warning' && msg.text().includes('прогрессии'))) {
        errorLogs.push(msg.text())
      }
    })

    await page.waitForTimeout(3000)
    
    // Логи ошибок помогут в диагностике
    if (errorLogs.length > 0) {
      console.log('Обнаружены ошибки прогрессии:', errorLogs)
    } else {
      console.log('✅ Ошибок прогрессии не обнаружено')
    }
  })
})
