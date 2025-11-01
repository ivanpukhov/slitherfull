import '@testing-library/jest-dom/vitest'

class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  listeners: Record<string, Set<(event: MessageEvent<string>) => void>> = {}
  readyState = 1

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, callback: (event: MessageEvent<string>) => void) {
    if (!this.listeners[type]) {
      this.listeners[type] = new Set()
    }
    this.listeners[type].add(callback)
  }

  removeEventListener(type: string, callback: (event: MessageEvent<string>) => void) {
    this.listeners[type]?.delete(callback)
  }

  emit(type: string, data: string) {
    const event: MessageEvent<string> = { data } as MessageEvent<string>
    this.listeners[type]?.forEach((listener) => listener(event))
  }

  close() {
    this.listeners = {}
    this.readyState = 2
  }
}

Object.defineProperty(globalThis, 'EventSource', {
  value: MockEventSource,
  writable: true
})

export { MockEventSource }
