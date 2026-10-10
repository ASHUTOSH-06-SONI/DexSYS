const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')

type JsonParser<T> = (value: unknown) => T

export class ApiError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function getJson<T>(path: string, parse: JsonParser<T>, signal?: AbortSignal): Promise<T> {
  return requestJson(path, { method: 'GET' }, parse, signal)
}

export async function postJson<T>(
  path: string,
  body: unknown,
  parse: JsonParser<T>,
  signal?: AbortSignal,
): Promise<T> {
  return requestJson(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, parse, signal)
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  parse: JsonParser<T>,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...init.headers },
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError(error instanceof Error ? `Unable to reach DexSYS API: ${error.message}` : 'Unable to reach DexSYS API.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiError(`DexSYS API returned invalid JSON (${response.status}).`, response.status)
  }

  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === 'string' ? payload.error : `DexSYS API request failed (${response.status}).`
    throw new ApiError(message, response.status)
  }

  try {
    return parse(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Response did not match the expected format.'
    throw new ApiError(`Invalid DexSYS API response: ${message}`, response.status)
  }
}
