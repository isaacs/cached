import { catcher } from '@isaacs/catcher'
import { statSync } from 'fs'

// cache an arbitrary function of arity 0 or 1
export function cached<R>(
  fn: () => R,
  cache?: MapLike<undefined, R> | undefined
): (() => R) & { cache: Map<undefined, R> }
export function cached<A, R>(
  fn: (arg: A) => R,
  cache?: MapLike<A, R> | undefined
): ((arg: A) => R) & { cache: Map<A, R> }
export function cached<A, R>(
  fn: (arg?: A) => R,
  cache: MapLike<A | undefined, R> = new Map<A | undefined, R>()
) {
  return Object.assign(
    (arg?: A) => {
      const has = cache.has(arg)
      if (has) {
        return cache.get(arg) as R
      }
      const r = fn(arg)
      cache.set(arg, r)
      return r
    },
    { cache }
  )
}

export interface MapLike<K, V> {
  get: (key: K) => V | undefined
  has: (key: K) => boolean
  set: (key: K, value: V) => MapLike<K, V>
  delete: (key: K) => boolean
}

export function cachedMtime<R>(
  fn: (path: string) => R,
  statFreqMs: number = 10,
  cache: MapLike<string, R> = new Map<string, R>(),
  mtimeCache: MapLike<string, [number, number]> = new Map<
    string,
    [number, number]
  >()
): ((path: string) => R) & {
  mtimeCache: MapLike<string, [number, number]>
  cache: MapLike<string, R>
  getMtime: (path: string) => number | undefined
} {
  const cfn = cached(fn, cache)
  const getMtime = (path: string) => {
    const now = performance.now()
    const cm = mtimeCache.get(path) || [0, -1 * statFreqMs]
    if (now - cm[1] > statFreqMs) {
      const m = catcher(() => Number(statSync(path).mtime))
      if (typeof m === 'number') {
        if (m !== cm[0]) cache.delete(path)
        mtimeCache.set(path, [m, now])
        return m
      } else {
        mtimeCache.delete(path)
        cache.delete(path)
        return undefined
      }
    }
    return cm[0]
  }
  return Object.assign(
    (path: string) => {
      getMtime(path)
      return cfn(path)
    },
    { mtimeCache, cache, getMtime }
  )
}
