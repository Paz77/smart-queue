// The one place the frontend talks to the API.
//
//   import { api, ApiError } from '../api/client'
//
//   const visits = await api.get('/me/history', { params: { organizationId: org.id } })
//   await api.post('/services/svc-it/queue', { body: { priority: 'normal' } })
//
// Paths are relative to /api. The signed-in token is attached automatically,
// and any error response becomes an ApiError carrying its per-field messages.

const BASE = '/api'
const TOKEN_KEY = 'queuesmart:token'

/** An error response from the API, or a request that never got one. */
export class ApiError extends Error {
  constructor(status, code, message, fields = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    // "validation_error", "unauthorized", "email_taken"... see errors.py.
    this.code = code
    // { fieldName: "what is wrong" }, keyed to match the form field names.
    this.fields = fields
  }

  /** True when the server rejected the input rather than the request itself. */
  get isValidation() {
    return this.status === 422 || Object.keys(this.fields).length > 0
  }
}

// The token lives in localStorage so a reload keeps you signed in. Reads and
// writes are wrapped because storage throws in private windows.
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Without storage the session simply ends on reload.
  }
}

export function clearToken() {
  setToken(null)
}

function buildUrl(path, params) {
  const url = BASE + path
  if (!params) return url

  // Drop undefined and null so callers can pass optional filters straight through.
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null),
  ).toString()
  return query ? `${url}?${query}` : url
}

// Turns a failed response into an ApiError. Falls back to the status text when
// the body is not our error envelope, which happens for proxy and server faults.
async function toApiError(response) {
  let payload = null
  try {
    payload = await response.json()
  } catch {
    // Body was empty or not JSON.
  }

  const error = payload?.error
  if (error) return new ApiError(response.status, error.code, error.message, error.fields ?? {})

  return new ApiError(response.status, 'error', response.statusText || 'Something went wrong.')
}

async function request(method, path, { body, params, signal } = {}) {
  const token = getToken()

  let response
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      signal,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
  } catch (cause) {
    // An aborted request is the caller unmounting, not a failure to report.
    if (cause.name === 'AbortError') throw cause
    throw new ApiError(0, 'network_error', 'Could not reach the server. Is the backend running?')
  }

  if (!response.ok) throw await toApiError(response)

  // 204 for logout, read-all and the other endpoints that return nothing.
  if (response.status === 204) return null
  return response.json()
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, options) => request('POST', path, options),
  patch: (path, options) => request('PATCH', path, options),
  put: (path, options) => request('PUT', path, options),
  delete: (path, options) => request('DELETE', path, options),
}
