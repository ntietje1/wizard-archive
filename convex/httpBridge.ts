import { v } from 'convex/values'

const httpHeaderValidator = v.object({
  name: v.string(),
  value: v.string(),
})

export const serializedHttpRequestValidator = v.object({
  url: v.string(),
  method: v.string(),
  headers: v.array(httpHeaderValidator),
  body: v.union(v.bytes(), v.null()),
})

export const serializedHttpResponseValidator = v.object({
  status: v.number(),
  statusText: v.string(),
  headers: v.array(httpHeaderValidator),
  body: v.union(v.bytes(), v.null()),
})

type HttpHeader = {
  name: string
  value: string
}

type SerializedHttpRequest = {
  url: string
  method: string
  headers: Array<HttpHeader>
  body: ArrayBuffer | null
}

type SerializedHttpResponse = {
  status: number
  statusText: string
  headers: Array<HttpHeader>
  body: ArrayBuffer | null
}

export async function serializeHttpRequest(request: Request): Promise<SerializedHttpRequest> {
  return {
    url: request.url,
    method: request.method,
    headers: serializeHeaders(request.headers),
    body:
      request.method === 'GET' || request.method === 'HEAD' ? null : await request.arrayBuffer(),
  }
}

export function deserializeHttpRequest(request: SerializedHttpRequest): Request {
  return new Request(request.url, {
    method: request.method,
    headers: headersFromEntries(request.headers),
    body:
      request.body && request.method !== 'GET' && request.method !== 'HEAD'
        ? request.body
        : undefined,
  })
}

export async function serializeHttpResponse(response: Response): Promise<SerializedHttpResponse> {
  const headers = serializeHeaders(response.headers)
  return {
    status: response.status,
    statusText: response.statusText,
    headers,
    body: hasNoResponseBody(response, headers) ? null : await response.arrayBuffer(),
  }
}

export function deserializeHttpResponse(response: SerializedHttpResponse): Response {
  return new Response(response.body ?? undefined, {
    status: response.status,
    statusText: response.statusText,
    headers: headersFromEntries(response.headers),
  })
}

function hasNoResponseBody(response: Response, headers: Array<HttpHeader>): boolean {
  if (response.status === 204 || response.status === 304) return true
  return headers.some(
    (header) => header.name.toLowerCase() === 'content-length' && header.value.trim() === '0',
  )
}

function headersFromEntries(entries: Array<HttpHeader>): Headers {
  const headers = new Headers()
  for (const { name, value } of entries) {
    headers.append(name, value)
  }
  return headers
}

function serializeHeaders(headers: Headers): Array<HttpHeader> {
  const setCookies =
    'getSetCookie' in headers
      ? (headers as Headers & { getSetCookie: () => Array<string> }).getSetCookie()
      : []
  const entries: Array<HttpHeader> = []
  headers.forEach((value, name) => {
    if (setCookies.length === 0 || name.toLowerCase() !== 'set-cookie') {
      entries.push({ name, value })
    }
  })

  for (const value of setCookies) {
    entries.push({ name: 'set-cookie', value })
  }
  return entries
}
