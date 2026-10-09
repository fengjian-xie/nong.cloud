// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LocalCorsProbe } from './LocalCorsProbe'
afterEach(() => vi.unstubAllGlobals())
it('diagnostic performs only a credentialed CORS health read to loopback', async () => {
  const fetch = vi.fn().mockResolvedValue({ok:true,json:async()=>({code:0,data:{database:'postgresql',status:'up'}})})
  vi.stubGlobal('fetch', fetch)
  render(<LocalCorsProbe/>);fireEvent.click(screen.getByText('检查跨域连接'))
  expect(await screen.findByText(/跨域预检及读取通过/)).toBeTruthy()
  expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:8080/api/v1/health')
  expect(fetch.mock.calls[0][1]).toMatchObject({mode:'cors',credentials:'include',headers:{'X-XQ-Client':'web-v1'}})
  expect(fetch.mock.calls[0][1].body).toBeUndefined()
})
