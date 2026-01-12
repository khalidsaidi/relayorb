const WARN_FRAGMENT =
  "[React Flow]: It looks like you've created a new nodeTypes or edgeTypes object."

const PATCH_KEY = "__rfWarnPatched"

if (import.meta.env.DEV) {
  const consoleAny = console as unknown as Record<string, unknown>
  if (!consoleAny[PATCH_KEY]) {
    const originalWarn = console.warn
    const originalError = console.error
    consoleAny[PATCH_KEY] = true
    const shouldSkip = (args: unknown[]) =>
      typeof args[0] === "string" && args[0].includes(WARN_FRAGMENT)

    console.warn = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes(WARN_FRAGMENT)) {
        return
      }
      originalWarn(...args)
    }

    console.error = (...args: unknown[]) => {
      if (shouldSkip(args)) return
      originalError(...args)
    }
  }
}
