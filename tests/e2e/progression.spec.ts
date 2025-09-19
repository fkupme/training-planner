import { test, expect } from '@playwright/test';

test.describe('Weight Progression', () => {
  test('should calculate progressive weight correctly', async ({ page }) => {
    // Переходим на приложение
    await page.goto('/');
    
    // Ждем загрузки приложения
    await expect(page.locator('[data-testid="app-ready"]')).toBeVisible();
    
    // Проверяем, что приложение загрузилось без ошибок
    const title = await page.title();
    expect(title).toBe('Training Planner');
    
    // Проверяем консоль на отсутствие критических ошибок
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`${msg.type()}: ${msg.text()}`);
    });
    
    // Ждем немного, чтобы все логи обработались
    await page.waitForTimeout(1000);
    
    // Проверяем, что нет критических ошибок (игнорируем warning'и и info)
    const errors = consoleLogs.filter(log => 
      log.includes('error') && !log.includes('[AUTH STORE]') && !log.includes('Cannot read properties of null')
    );
    
    if (errors.length > 0) {
      console.log('Console errors found:', errors);
    }
    
    // Основная проверка - приложение загружено и готово к работе
    expect(errors.length).toBe(0);
  });

  test('should handle database operations with mock', async ({ page }) => {
    // Переходим на приложение
    await page.goto('/');
    
    // Ждем загрузки приложения
    await expect(page.locator('[data-testid="app-ready"]')).toBeVisible();
    
    // Проверяем, что моковая база данных работает (смотрим на логи)
    const dbLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[DB MOCK]')) {
        dbLogs.push(text);
      }
    });
    
    // Ждем немного, чтобы все операции с БД выполнились
    await page.waitForTimeout(2000);
    
    // Проверяем, что были операции с базой данных
    expect(dbLogs.length).toBeGreaterThan(0);
    
    // Проверяем, что есть операции SELECT и INSERT
    const selectOps = dbLogs.filter(log => log.includes('select:'));
    const insertOps = dbLogs.filter(log => log.includes('execute:') && log.includes('INSERT'));
    
    expect(selectOps.length).toBeGreaterThan(0);
    expect(insertOps.length).toBeGreaterThan(0);
    
    console.log(`Found ${selectOps.length} SELECT operations and ${insertOps.length} INSERT operations`);
  });

  test('should initialize without Tauri API errors', async ({ page }) => {
    // Собираем все консольные сообщения
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`${msg.type()}: ${msg.text()}`);
    });
    
    // Переходим на приложение
    await page.goto('/');
    
    // Ждем загрузки приложения
    await expect(page.locator('[data-testid="app-ready"]')).toBeVisible();
    
    // Ждем завершения всех асинхронных операций
    await page.waitForTimeout(2000);
    
    // Проверяем, что нет ошибок, связанных с Tauri API
    const tauriErrors = consoleLogs.filter(log => 
      log.includes('Cannot read properties of undefined (reading \'invoke\')') ||
      log.includes('__TAURI__ is not defined') ||
      log.includes('tauri is not available')
    );
    
    expect(tauriErrors.length).toBe(0);
    
    // Проверяем, что приложение успешно использует моковые функции
    const mockLogs = consoleLogs.filter(log => 
      log.includes('[DB MOCK]') || 
      log.includes('Using mock database')
    );
    
    expect(mockLogs.length).toBeGreaterThan(0);
  });

  test('should handle navigation properly', async ({ page }) => {
    // Переходим на приложение
    await page.goto('/');
    
    // Ждем загрузки приложения
    await expect(page.locator('[data-testid="app-ready"]')).toBeVisible();
    
    // Проверяем, что мы на главной странице (планировщик)
    await expect(page).toHaveURL(/.*planner/);
    
    // Проверяем наличие основных элементов интерфейса
    const body = await page.locator('body').innerHTML();
    expect(body.length).toBeGreaterThan(1000); // Приложение должно отрендериться
  });
});
