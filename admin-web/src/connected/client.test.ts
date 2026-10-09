import { afterEach, expect, it, vi } from 'vitest'
import { request, BackendError, pageRows, listPath } from './client'
afterEach(() => vi.unstubAllGlobals())
it('web uses cookies and anti-CSRF marker; idempotency/version are explicit', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ code: 0, data: { id: 'p' }, traceId: 't' }) }); vi.stubGlobal('fetch', fetch)
  expect(await request('/plots', { method: 'POST', body: { name: 'test' }, key: 'key123456', version: 2, identity: 'identity-farmer' })).toEqual({ id: 'p' })
  expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'include', headers: { 'X-XQ-Client': 'web-v1', 'Idempotency-Key': 'key123456', 'If-Match': '2', 'X-XQ-Identity': 'identity-farmer' } })
})
it('API error is surfaced and cannot fall back to demo rows', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ code: 403, message: '对象无权限', traceId: 'trace' }) }))
  await expect(request('/plots')).rejects.toEqual(new BackendError('对象无权限', 403, 'trace'))
})
it('invalid proxy response is a visible configuration error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 502, json: async () => { throw new Error('HTML') } }))
  await expect(request('/plots')).rejects.toThrow('接口未返回有效 JSON')
})
it('malformed success envelope cannot be mistaken for saved server data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({code:0}) }))
  await expect(request('/plots')).rejects.toThrow('格式不一致')
})
it('list pagination is validated and does not accept truncated window metadata', () => {
  const page = {items:[{id:'p'}],total:5,page:2,size:2,hasNext:true}
  expect(pageRows(page)).toEqual(page.items)
  expect(() => pageRows({...page,hasNext:undefined} as never)).toThrow('分页契约')
  expect(() => pageRows({...page,size:0})).toThrow('分页契约')
  expect(listPath('/plots?size=100',2)).toBe('/plots?size=20&page=2')
})
