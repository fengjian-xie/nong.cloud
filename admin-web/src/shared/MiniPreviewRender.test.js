// @vitest-environment jsdom
// Exercise the actual public preview scripts under the deployment subdirectory.
import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'

const root = '../miniapp/'
const read = name => readFileSync(root + name, 'utf8')
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); localStorage.clear(); delete window.wx; delete window.XqChoiceMenu })

it('小程序静态演示在/miniapp-preview/加载原生页面和影像，不请求站点根资源', async () => {
  const config = JSON.parse(read('app.json'))
  const sources = ['app.wxss', ...['catalog', 'session', 'connection', 'module-ui', 'address', 'farm-data', 'message-ui', 'support', 'value-data', 'business-groups', 'business-groups-data'].map(name => 'utils/' + name + '.js'), ...config.pages.flatMap(page => ['.js', '.json', '.wxml', '.wxss'].map(ext => page + ext)), ...['js', 'wxml', 'wxss'].map(ext => 'components/identity-switcher/index.' + ext)]
  const files = Object.fromEntries(sources.map(name => [name, read(name)]))
  document.body.innerHTML = read('preview/index.html').split('<body>')[1].split('</body>')[0]
  const script = document.createElement('script')
  script.src = 'https://work.nong.cloud/miniapp-preview/preview/runtime.js'
  vi.spyOn(document, 'currentScript', 'get').mockReturnValue(script)
  const fetch = vi.fn().mockResolvedValue({ json: async () => ({ config, files }) })
  vi.stubGlobal('fetch', fetch)
  new Function(read('preview/choice-menu.js'))()
  await new Function('return ' + read('preview/runtime.js').replace(/^\/\/[^\n]*\n/gm, ''))()
  expect(String(fetch.mock.calls[0][0])).toBe('https://work.nong.cloud/miniapp-preview/source-bundle.json')
  expect(document.getElementById('screen').textContent).toContain('把每一季耕耘')
  expect(document.querySelector('.stage-error')).toBeNull()
  expect(document.querySelectorAll('#role-links button').length).toBeGreaterThan(11)
  window.wx.switchTab({ url: '/pages/farm/farm' })
  await Promise.resolve()
  expect(document.getElementById('screen').textContent).toContain('查看产品批次履历原型')
  expect(document.querySelector('#screen .passport-entry')).toBeTruthy()
  for (const image of document.querySelectorAll('#screen img,#tabs img')) {
    expect(image.src.startsWith('https://work.nong.cloud/miniapp-preview/assets/')).toBe(true)
  }
})
