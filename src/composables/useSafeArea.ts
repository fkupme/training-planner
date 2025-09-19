import { ref, computed, onMounted, onUnmounted } from 'vue'

/**
 * CSS-only safe area implementation for Tauri mobile apps
 * Based on research of Tauri discussions and WebKit specifications
 * 
 * Key findings:
 * 1. env(safe-area-inset-*) CSS variables work in iOS WebView but may have limited support in Android WebView
 * 2. viewport-fit=cover is required in meta tag
 * 3. CSS fallback values are essential for unsupported environments
 * 4. Simple CSS approach is more reliable than complex JavaScript detection
 */

export function useSafeArea() {
  const isSupported = ref(false)
  const debug = (() => {
    try { return localStorage.getItem('SAFE_AREA_DEBUG') === '1' } catch { return false }
  })()

  const log = (...args: any[]) => { if (debug) console.debug('[safe-area]', ...args) }
  let firstLogDone = false

  // Платформа: грубая проверка Android WebView
  const isAndroidWebView = /Android/i.test(navigator.userAgent) && /wv|Version\/\d+\.\d+ Chrome\/\d+ Mobile/i.test(navigator.userAgent)

  // Чтение env(...) через рендер в скрытый элемент и computed style
  function readEnvPx(name: string): number {
    const el = document.createElement('div')
    el.style.cssText = `position:fixed;visibility:hidden;top:-9999px;left:-9999px;padding-top:env(${name}, 0px);`
    document.body.appendChild(el)
    const v = getComputedStyle(el).paddingTop
    document.body.removeChild(el)
    const n = parseFloat(v || '0')
    return Number.isFinite(n) ? n : 0
  }

  // Установка CSS-переменных
  function setVar(name: string, px: number) {
    document.documentElement.style.setProperty(name, `${px | 0}px`)
  }

  // Основной расчёт
  function computeAndApply() {
    // Сначала пробуем стандартные env()
    let top = readEnvPx('safe-area-inset-top')
    let bottom = readEnvPx('safe-area-inset-bottom')
    let left = readEnvPx('safe-area-inset-left')
    let right = readEnvPx('safe-area-inset-right')

    // На Android WebView часто 0 — пробуем эвристику
    if (isAndroidWebView) {
      // Не трогаем, если открыта клавиатура (её обрабатывает useKeyboardInsets)
      const active = document.activeElement as HTMLElement | null
      const isInputFocused = !!(active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA'))
      const vv = (window as any).visualViewport as VisualViewport | undefined

      if (vv && !isInputFocused) {
        // top: иногда равен смещению вьюпорта
        if (top === 0 && vv.offsetTop > 0) top = Math.max(top, Math.round(vv.offsetTop))

        // bottom: разница между layout viewport и визуальным без клавиатуры
        const viewportBottom = vv.height + vv.offsetTop
        const diff = Math.max(0, window.innerHeight - viewportBottom)
        if (bottom === 0 && diff > 0 && diff < 120) {
          // 120px — отсечка, чтобы не спутать с клавиатурой
          bottom = Math.round(diff)
        }
      }

      // Классифицируем режим навигации: жесты vs кнопки
      // эмпирически: у жестов обычно <= 36px, у кнопок >= 44px
      let navMode: 'gesture' | 'buttons' | 'unknown' = 'unknown'
      if (bottom > 0 && bottom <= 36) navMode = 'gesture'
      else if (bottom >= 44) navMode = 'buttons'

      // Минимальные значения (тюнинг под реальное устройство)
        const readNum = (k: string, def: number) => {
          try {
            const v = parseInt(localStorage.getItem(k) || '', 10)
            return Number.isFinite(v) && v > 0 ? v : def
          } catch { return def }
        }
        const BOTTOM_MIN_GESTURE = readNum('SAFE_AREA_BOTTOM_MIN_GESTURE', 12)
        const BOTTOM_MIN_BUTTONS = readNum('SAFE_AREA_BOTTOM_MIN_BUTTONS', 48)
        const TOP_MAX_ANDROID = readNum('SAFE_AREA_TOP_MAX', 16)

      if (navMode === 'gesture') {
        bottom = Math.max(bottom, BOTTOM_MIN_GESTURE)
      } else if (navMode === 'buttons') {
        bottom = Math.max(bottom, BOTTOM_MIN_BUTTONS)
      }

      // Верх слишком большой? Ограничим
      if (top > TOP_MAX_ANDROID) top = TOP_MAX_ANDROID
      log('navMode', navMode, { top, bottom })
    }

    setVar('--safe-top', top)
    setVar('--safe-bottom', bottom)
    setVar('--safe-left', left)
    setVar('--safe-right', right)
    // Всегда один раз в консоль, чтобы было видно что композ запустился
    if (!firstLogDone) {
      console.info('[safe-area] applied(init)', { top, bottom, left, right })
      firstLogDone = true
    }
    log('applied', { top, bottom, left, right, ua: navigator.userAgent })
  }

  // CSS utility классы (оставляем как было)
  const safeAreaCSS = computed(() => {
    return `
      .safe-area-top { padding-top: var(--safe-top); }
      .safe-area-bottom { padding-bottom: var(--safe-bottom); }
      .safe-area-left { padding-left: var(--safe-left); }
      .safe-area-right { padding-right: var(--safe-right); }
      .safe-area-all { padding: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left); }
    `
  })

  const injectCSS = () => {
    const existingStyle = document.getElementById('safe-area-css')
    if (!existingStyle) {
      const style = document.createElement('style')
      style.id = 'safe-area-css'
      style.textContent = safeAreaCSS.value
      document.head.appendChild(style)
    }
  }

  onMounted(() => {
    // Проверка поддержки env
    try {
      const test = document.createElement('div')
      test.style.padding = 'env(safe-area-inset-top, 0px)'
      isSupported.value = test.style.padding !== ''
    } catch {
      isSupported.value = false
    }

    // viewport-fit=cover
    const viewport = document.querySelector('meta[name="viewport"]')
    if (viewport) {
      const content = viewport.getAttribute('content') || ''
      if (!content.includes('viewport-fit=cover')) {
        viewport.setAttribute('content', content + ', viewport-fit=cover')
      }
    }

    injectCSS()
    computeAndApply()

    // Слушатели для пересчёта (без конфликтов с клавиатурой)
    const vv = (window as any).visualViewport as VisualViewport | undefined
    const onVV = () => computeAndApply()
    const onResize = () => computeAndApply()
    const onOrientation = () => computeAndApply()

    if (vv) {
      vv.addEventListener('resize', onVV)
      vv.addEventListener('scroll', onVV)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onOrientation)

    onUnmounted(() => {
      if (vv) {
        vv.removeEventListener('resize', onVV)
        vv.removeEventListener('scroll', onVV)
      }
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onOrientation)
    })
  })

  return {
    isSupported,
    safeAreaCSS,
    injectCSS
  }
}
