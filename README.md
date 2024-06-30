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

## Limitations and Caveats

The `cachedMtime` method uses `statSync` to get the `mtime` of
the path. So, if you are using this in a scenario where you must
not block the event loop, then that could of course be a problem.
The `statSync` is not wrapped in a try/catch either, meaning that
calling this method on a non-existent path will throw an error.

This module is intentionally very small and simple, and so there
are no options to limit how long things are cached for, set
limits on the cache, and so on. For a _much_ more comprehensive
caching library, with support for a wide array of
configurability, sync memoizing and async fetching, check out
[LRUCache](https://isaacs.github.io/node-lru-cache/).

Note that you _may_ use this module to cache the results of async
functions, but it just means that the _Promise_ itself will be
cached, rather than caching the _resolution_ of the Promise. This
means, for example, that Promise _rejections_ will also be
cached. Maybe that's what you want! But if not, then you'll have
to either work around it, or use something else.

One way to work around it would be to explicitly delete any
failing promises from the function's memoization cache.

```js
import { readdir } from 'node:fs/promises'
// If the readdir() fails, then it'll reject the promise,
// and we'll delete it from the memoization cache
const readdirCached = cachedMtime(async path => {
  try {
    // happy path, return the result
    return await readdir(path, 'utf8')
  } catch (er) {
    // oh no! promise failed, delete it from the cache
    readdirCached.cache.delete(path)
    // now throw the error we got for the user to handle
    throw er
  }
})
```
