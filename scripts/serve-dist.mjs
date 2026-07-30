import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'

const root = path.resolve(process.cwd(), 'dist')
const port = Number(process.env.PORT || 4173)
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
}

if (!existsSync(path.join(root, 'index.html'))) {
  throw new Error('dist/index.html is missing. Run npm run build before visual tests.')
}

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname)
  const requested = path.resolve(root, `.${pathname}`)
  const safeRequested = requested.startsWith(root) ? requested : path.join(root, 'index.html')
  const file = existsSync(safeRequested) && statSync(safeRequested).isFile()
    ? safeRequested
    : path.join(root, 'index.html')
  response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
  response.setHeader('Cache-Control', 'no-store')
  createReadStream(file).pipe(response)
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving dist at http://127.0.0.1:${port}`)
})
