import { ref, computed, onMounted } from 'vue'

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
  
  // Check if CSS env() is supported by testing a simple property
  const checkSupport = () => {
    try {
      const testElement = document.createElement('div')
      testElement.style.padding = 'env(safe-area-inset-top, 10px)'
      return testElement.style.padding !== ''
    } catch {
      return false
    }
  }

  // CSS utility classes using existing global variables
  const safeAreaCSS = computed(() => {
    return `
      .safe-area-top {
        padding-top: var(--safe-top);
      }
      
      .safe-area-bottom {
        padding-bottom: var(--safe-bottom);
      }
      
      .safe-area-left {
        padding-left: var(--safe-left);
      }
      
      .safe-area-right {
        padding-right: var(--safe-right);
      }
      
      .safe-area-all {
        padding: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);
      }
    `
  })

  // Inject CSS if not already present
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
    isSupported.value = checkSupport()
    
    // Ensure viewport meta tag has viewport-fit=cover
    const viewport = document.querySelector('meta[name="viewport"]')
    if (viewport) {
      const content = viewport.getAttribute('content') || ''
      if (!content.includes('viewport-fit=cover')) {
        viewport.setAttribute('content', content + ', viewport-fit=cover')
      }
    }
    
    injectCSS()
  })

  return {
    isSupported,
    safeAreaCSS,
    injectCSS
  }
}
