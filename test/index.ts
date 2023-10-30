import {
  readFileSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from 'fs'
import { resolve } from 'path'
import t from 'tap'
import { cached, cachedMtime } from '../src/index.js'

t.test('caching just a basic function', t => {
  const fn = (a: number) => a * a
  const c = cached(fn)
  t.equal(c(2), 4)
  t.equal(c.cache.get(2), 4)
  t.equal(c(2), 4)
  t.end()
})

t.test('caching a filesystem thing', async t => {
  const f = resolve(
    t.testdir({
      file: 'contents',
    }),
    'file'
  )
  const start = new Date('2000-01-01')
  utimesSync(f, start, start)
  const read = (path: string) => readFileSync(path, 'utf8')
  const readCachedZero = cachedMtime(read, -100)
  const readCachedTen = cachedMtime(
    read,
    10,
    readCachedZero.cache,
    readCachedZero.mtimeCache
  )
  t.equal(readCachedZero(f), 'contents')
  t.equal(readCachedTen(f), 'contents')
  writeFileSync(f, 'new contents')
  utimesSync(
    f,
    new Date(start.getTime() + 5),
    new Date(start.getTime() + 5)
  )
  t.equal(readCachedTen(f), 'contents')
  t.equal(readCachedZero(f), 'new contents')
  // this updates the cache, so updates Ten as well
  t.equal(readCachedTen(f), 'new contents')
  writeFileSync(f, 'new new contents')
  utimesSync(
    f,
    new Date(start.getTime() + 5000),
    new Date(start.getTime() + 5000)
  )
  await new Promise<void>(r => setTimeout(r, 100))
  t.equal(readCachedTen(f), 'new new contents')
  unlinkSync(f)
  t.equal(readCachedTen(f), 'new new contents')
  t.throws(() => readCachedZero(f))
  t.throws(() => readCachedTen(f))
})
