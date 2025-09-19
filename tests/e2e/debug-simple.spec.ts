import { test, expect } from '@playwright/test';

test('simple app load test', async ({ page }) => {
  // Добавляем консольное логирование для отладки
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('/');
  
  // Ждем немного времени для загрузки
  await page.waitForTimeout(2000);
  
  // Проверяем, есть ли хоть какие-то элементы на странице
  const body = await page.locator('body');
  await expect(body).toBeVisible();
  
  // Проверяем заголовок страницы
  const title = await page.title();
  console.log('Page title:', title);
  
  // Проверяем, что приложение загружается
  const html = await page.innerHTML('body');
  console.log('Body HTML length:', html.length);
  
  // Ищем элемент app-ready
  const appReady = await page.locator('[data-testid="app-ready"]').count();
  const appLoading = await page.locator('[data-testid="app-loading"]').count();
  
  console.log('app-ready elements:', appReady);
  console.log('app-loading elements:', appLoading);
  
  // Проверим все data-testid атрибуты на странице
  const allTestIds = await page.evaluate(() => {
    const elements = document.querySelectorAll('[data-testid]');
    return Array.from(elements).map(el => el.getAttribute('data-testid'));
  });
  
  console.log('All data-testid attributes found:', allTestIds);
});
