# @isaacs/cached

Cache the results of a function based on a `path` argument, and
clear the cache whenever the mtime of the path changes.

## USAGE

```js
import { cachedMtime } from '@isaacs/cached'
import { writeFile, readFile } from 'node:fs/promises'

const readFileCached = cachedMtime(readFile)

// first time, actually reads the file
const results = await readFileCached('file.txt')
// second time, just serve from cache
const cachedResults = await readFileCached('file.txt')

// file changes!
await writeFile('file.txt', 'new contents')
const cacheBusted = await readFileCached('file.txt')
```

The `cached` method is the same thing, but without the mtime
stuff, so you'd have to expire the cache yourself if you want to
do that.

```js
import { cached } from '@isaacs/cached'
import { writeFile, readFile } from 'node:fs/promises'

const readFileCached = cached(readFile)

await writeFile('file.txt', 'some contents')

// first time, actually reads the file
const results = await readFileCached('file.txt')
// second time, just serve from cache
const cachedResults = await readFileCached('file.txt')

// file changes! but this is ignored, because we're using
// cached(), not cachedMtime()
await writeFile('file.txt', 'new contents')
const cacheNotBusted = await readFileCached('file.txt')
assert.equal(cacheNotBusted, 'some contents')
```

You can supply your own cache to the method if you'd like to use
an [LRU](https://github.com/isaacs/node-lru-cache) or something.
It must implement get, set, and has, at minimum.

```js
import { cached } from '@isaacs/cached'
const map1 = new Map([
  [1, 11],
  [2, 22],
])
const map2 = new Map([
  [3, 13],
  [4, 14],
])
const myCache = {
  get: key => map1.get(key) || map2.get(key),
  set: (key, value) => map1.set(key),
  has: key => map1.has(key) || map2.has(key),
  delete: key => map1.delete(key) || map2.delete(key),
}
const cachedFunction = cached(key => key * 100)
assert.equal(cachedFunction(1), 11)
assert.equal(cachedFunction(4), 14)
assert.equal(cachedFunction(5), 500)
assert.equal(map1.get(5), 500) // cached now
```

If you want to interact with the cache (and in the case of
`cachedMtime`, the mtime cache) then that's hanging on the
returned function. You can use this to pre-seed cached values,
clear the cache in a targetted way, etc.

```js
import { cachedMtime } from '@isaacs/cached'
import { writeFile, readFile } from 'node:fs/promises'

const readFileCached = cachedMtime(readFile)
await readFileCached('file.txt')
console.log(readFileCached.cache) // Map { 'file.txt' => 'some contents' }
console.log(readFileCached.mtimeCache) // Map { 'file.txt' => 853283471948 }
```

You can set the minimum time between stat calls, and optionally
provide your own cache map objects for the return values and for
the mtime values.

```js
import { cachedMtime } from '@isaacs/cached'
import { readFileSync } from 'node:fs'
const mtimes = new Map<string, number>
const contents = new Map<string, string>
const cached = cachedMtime(
  (path: string) => readFileSync(path, 'utf8'),
  1000, // check for mtime changes at most 1ce per second
  contents,
  mtimes
)
```

See [the typedocs](https://isaacs.github.io/cached) for more
information.
