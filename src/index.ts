import { catcher } from '@isaacs/catcher'
import { statSync } from 'fs'

/**
 * Cache an arbitrary function of arity 0 or 1.
 * May provide an optional `Map<argType, returnType>`, or one will be created.
 */
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

/**
 * Defaults to a normal `Map` if not provided, but anything with
 * get/set/has/delete will work. For example:
 * <https://isaacs.github.io/node-lru-cache/>
 */
export interface MapLike<K, V> {
  get: (key: K) => V | undefined
  has: (key: K) => boolean
  set: (key: K, value: V) => MapLike<K, V>
  delete: (key: K) => boolean
}

/**
 * Return type of cachedMtime()
 */
export type MtimeCachedMethod<R> = {
  (path: string): R
  /**
   * cache of mtime values and the most recent peformance.now() value
   * when the statSync was performed to read it.
   */
  mtimeCache: MapLike<string, [mtime: number, lastStatTime: number]>
  /** return value cache */
  cache: MapLike<string, R>
  /**
   * Get the numeric mtime value for a given path, if possible.
   * Will `statSync()` the file if the mtime is not in the cache, or if
   * the time since the lastStatTime is greater than the `statFreqMs`
   * provided to {@link cachedMtime}.
   */
  getMtime: (path: string) => number | undefined
}

/**
 * Cache a synchronous FS function that takes a path as a single argument.
 * The result cache will be invalidated whenever the mtime of the path
 * changes. May specify minimum time between stat() calls in ms, and provide
 * both a results cache and mtime cache.
 */
export function cachedMtime<R>(
  fn: (path: string) => R,
  statFreqMs: number = 10,
  cache: MapLike<string, R> = new Map<string, R>(),
  mtimeCache: MapLike<
    string,
    [mtime: number, lastStatTime: number]
  > = new Map<string, [number, number]>()
): MtimeCachedMethod<R> {
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
