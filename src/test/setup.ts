import { vi } from 'vitest'
import './apexcharts.mock'

// Mock Tauri API для unit тестов
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-sql', () => ({
  Database: {
    load: vi.fn(() => ({
      execute: vi.fn(),
      select: vi.fn(),
    })),
  },
}))

vi.mock('@tauri-apps/plugin-store', () => ({
  Store: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    save: vi.fn(),
  })),
}))

// Mock роутера Vue
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
  }),
  useRoute: () => ({
    params: {},
    query: {},
    path: '/',
  }),
}))

// Глобальные моки для мобильных функций
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
