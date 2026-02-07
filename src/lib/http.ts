export class HttpRequestError extends Error {
  service: string
  url: string
  status: number
  bodyText?: string
  hint?: string
  kind: "http" | "network" | "timeout"

  constructor(args: {
    service: string
    url: string
    status?: number
    bodyText?: string
    hint?: string
    kind: "http" | "network" | "timeout"
    message: string
  }) {
    super(args.message)
    this.name = "HttpRequestError"
    this.service = args.service
    this.url = args.url
    this.status = args.status ?? 0
    this.bodyText = args.bodyText
    this.hint = args.hint
    this.kind = args.kind
  }
}

function excerpt(text: string, maxLen = 400) {
  const trimmed = text.trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen)}…`
}

function hintForNetworkError() {
  return [
    "Check that the backend URL is reachable in your browser.",
    "If this is production, confirm the VM domain resolves and TLS is valid.",
    "If this is local dev, confirm you are signed in and not blocked by an extension/VPN.",
  ].join(" ")
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchJsonWithMeta<T = any>(
  service: string,
  url: string,
  init?: RequestInit,
  timeoutMs = 20000
): Promise<{ status: number; ok: boolean; data: T }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    const text = await res.text()

    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }

    if (!res.ok) {
      const bodyText = typeof data === "string" ? data : JSON.stringify(data)
      throw new HttpRequestError({
        service,
        url,
        status: res.status,
        bodyText: excerpt(bodyText),
        kind: "http",
        message: `[${service}] ${res.status} ${url} :: ${excerpt(bodyText) || res.statusText || "Request failed"}`,
      })
    }

    return { status: res.status, ok: true, data: data as T }
  } catch (err) {
    if (err instanceof HttpRequestError) throw err
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new HttpRequestError({
        service,
        url,
        kind: "timeout",
        hint: "The backend is slow or unreachable. Try again, then check service logs/health.",
        message: `[${service}] timeout after ${timeoutMs}ms: ${url}`,
      })
    }

    const message = err instanceof Error ? err.message : String(err)
    throw new HttpRequestError({
      service,
      url,
      kind: "network",
      hint: hintForNetworkError(),
      message: `[${service}] network error: ${url} :: ${message}`,
    })
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchJsonOrThrow<T = any>(
  service: string,
  url: string,
  init?: RequestInit,
  timeoutMs = 20000
): Promise<T> {
  const method = (init?.method || "GET").toUpperCase()
  const canRetry = method === "GET" || method === "HEAD"
  const maxAttempts = canRetry ? 2 : 1

  let lastErr: unknown = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchJsonWithMeta<T>(service, url, init, timeoutMs)
      return res.data
    } catch (err) {
      lastErr = err
      const retriable =
        err instanceof HttpRequestError &&
        (err.kind === "network" ||
          err.kind === "timeout" ||
          (err.kind === "http" && [502, 503, 504].includes(err.status)))

      if (!retriable || attempt === maxAttempts) throw err

      // Small jittered backoff: enough to survive brief deploys/restarts without masking real errors.
      const base = 250 * attempt
      const jitter = Math.floor(Math.random() * 200)
      await sleep(base + jitter)
    }
  }
  throw lastErr
}
