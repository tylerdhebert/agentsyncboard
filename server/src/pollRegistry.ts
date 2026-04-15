type Resolver<T> = (value: T) => void

const registry = new Map<string, Resolver<unknown>>()

export const pollRegistry = {
  park<T>(key: string, timeoutMs = 900_000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        registry.delete(key)
        reject(new Error('timeout'))
      }, timeoutMs)

      registry.set(key, (value: unknown) => {
        clearTimeout(timer)
        registry.delete(key)
        resolve(value as T)
      })
    })
  },

  resolve<T>(key: string, value: T): boolean {
    const resolver = registry.get(key)
    if (!resolver) return false
    resolver(value)
    return true
  },

  has(key: string): boolean {
    return registry.has(key)
  },
}
