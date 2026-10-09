// Package only current, registered prototype routes. Never include local private configuration.
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const destination = path.resolve(process.argv[2] || path.join(root, '../artifacts/2026-10-06/xiangqiao-miniapp-product-value-v2.zip'))
if (fs.existsSync(destination)) throw new Error('目标文件已存在，请换一个版本名，避免覆盖交接包')
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'xiangqiao-miniapp-package-'))
const packageRoot = path.join(stage, 'xiangqiao-miniapp')
fs.mkdirSync(packageRoot)
const pages = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).pages
const files = ['app.js', 'app.json', 'app.wxss', 'sitemap.json', 'project.config.json', 'README.md', 'PAGES.md',
  ...pages.flatMap(page => ['.js', '.json', '.wxml', '.wxss'].map(ext => page + ext)),
  'utils/business-groups.json',
  ...['address', 'catalog', 'connection', 'farm-data', 'message-ui', 'module-ui', 'session', 'support', 'value-data', 'business-groups', 'business-groups-data'].map(name => `utils/${name}.js`)]
for (const relative of files) {
  fs.mkdirSync(path.dirname(path.join(packageRoot, relative)), { recursive: true })
  fs.copyFileSync(path.join(root, relative), path.join(packageRoot, relative))
}
for (const relative of ['assets', 'components', 'preview', 'tests', 'tools']) {
  fs.cpSync(path.join(root, relative), path.join(packageRoot, relative), { recursive: true })
}
fs.mkdirSync(path.dirname(destination), { recursive: true })
execFileSync('/usr/bin/zip', ['-qr', destination, 'xiangqiao-miniapp'], { cwd: stage })
console.log(JSON.stringify({ artifact: destination, registeredRoutes: pages.length, stagingDirectory: stage }))
