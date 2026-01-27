import type { Ctx } from './types'

/**
 * A pipeline builder for chaining enhancers and permission checks.
 * Automatically short-circuits on null values.
 */
export class Pipeline<TCtx extends Ctx, T> {
  private constructor(
    private ctx: TCtx,
    private promise: Promise<T | null>,
  ) {}

  /**
   * Start a pipeline with an initial value
   */
  static start<TCtx extends Ctx, T>(ctx: TCtx, value: T | null): Pipeline<TCtx, T> {
    return new Pipeline(ctx, Promise.resolve(value))
  }

  /**
   * Start a pipeline with an async initial value
   */
  static startAsync<TCtx extends Ctx, T>(
    ctx: TCtx,
    promise: Promise<T | null>,
  ): Pipeline<TCtx, T> {
    return new Pipeline(ctx, promise)
  }

  /**
   * Apply an enhancer function. Short-circuits if current value is null.
   */
  pipe<TResult>(
    fn: (ctx: TCtx, value: T) => Promise<TResult> | TResult,
  ): Pipeline<TCtx, TResult> {
    const newPromise = this.promise.then((value) => {
      if (value === null) {
        return null
      }
      return fn(this.ctx, value)
    })
    return new Pipeline(this.ctx, newPromise)
  }

  /**
   * Apply a permission check that can return null.
   * Alias for pipe() that makes intent clearer in code.
   */
  enforce<TResult>(
    fn: (ctx: TCtx, value: T) => Promise<TResult | null>,
  ): Pipeline<TCtx, TResult> {
    return this.pipe(fn) as Pipeline<TCtx, TResult>
  }

  /**
   * Execute the pipeline and return the result
   */
  async run(): Promise<T | null> {
    return this.promise
  }
}

/**
 * Shorthand for Pipeline.start
 */
export const pipe = <TCtx extends Ctx, T>(ctx: TCtx, value: T | null): Pipeline<TCtx, T> =>
  Pipeline.start(ctx, value)

/**
 * Shorthand for Pipeline.startAsync
 */
export const pipeAsync = <TCtx extends Ctx, T>(
  ctx: TCtx,
  promise: Promise<T | null>,
): Pipeline<TCtx, T> => Pipeline.startAsync(ctx, promise)

/**
 * A pipeline builder for chaining operations on arrays.
 * Supports mapping, filtering, and permission enforcement on lists.
 */
export class ListPipeline<TCtx extends Ctx, T> {
  private constructor(
    private ctx: TCtx,
    private promise: Promise<Array<T>>,
  ) {}

  /**
   * Start a list pipeline with an array
   */
  static start<TCtx extends Ctx, T>(ctx: TCtx, items: Array<T>): ListPipeline<TCtx, T> {
    return new ListPipeline(ctx, Promise.resolve(items))
  }

  /**
   * Start a list pipeline with an async array
   */
  static startAsync<TCtx extends Ctx, T>(
    ctx: TCtx,
    promise: Promise<Array<T>>,
  ): ListPipeline<TCtx, T> {
    return new ListPipeline(ctx, promise)
  }

  /**
   * Map each item through an enhancer function
   */
  map<TResult>(
    fn: (ctx: TCtx, value: T) => Promise<TResult> | TResult,
  ): ListPipeline<TCtx, Awaited<TResult>> {
    const newPromise = this.promise.then((items) =>
      Promise.all(items.map((item) => fn(this.ctx, item))),
    )
    return new ListPipeline(this.ctx, newPromise)
  }

  /**
   * Apply a permission check that can return null, filtering out unauthorized items
   */
  enforce<TResult>(
    fn: (ctx: TCtx, value: T) => Promise<TResult | null>,
  ): ListPipeline<TCtx, Awaited<TResult>> {
    const newPromise = this.promise.then(async (items) => {
      const results = await Promise.all(items.map((item) => fn(this.ctx, item)))
      return results.filter(
        (item): item is Awaited<TResult> => item !== null,
      )
    })
    return new ListPipeline(this.ctx, newPromise)
  }

  /**
   * Filter items based on a predicate
   */
  filter(fn: (ctx: TCtx, value: T) => Promise<boolean> | boolean): ListPipeline<TCtx, T> {
    const newPromise = this.promise.then(async (items) => {
      const results = await Promise.all(
        items.map(async (item) => ({
          item,
          keep: await fn(this.ctx, item),
        })),
      )
      return results.filter(({ keep }) => keep).map(({ item }) => item)
    })
    return new ListPipeline(this.ctx, newPromise)
  }

  /**
   * Execute the pipeline and return the results
   */
  async run(): Promise<Array<T>> {
    return this.promise
  }
}

/**
 * Shorthand for ListPipeline.start
 */
export const pipeList = <TCtx extends Ctx, T>(
  ctx: TCtx,
  items: Array<T>,
): ListPipeline<TCtx, T> => ListPipeline.start(ctx, items)

/**
 * Shorthand for ListPipeline.startAsync
 */
export const pipeListAsync = <TCtx extends Ctx, T>(
  ctx: TCtx,
  promise: Promise<Array<T>>,
): ListPipeline<TCtx, T> => ListPipeline.startAsync(ctx, promise)
