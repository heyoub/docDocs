/**
 * @fileoverview Serializes OpenRouter API calls with a minimum gap between requests.
 *
 * @module core/ml/openRouterRateLimit
 */

const DEFAULT_MIN_DELAY_MS = 200;

/**
 * Limits OpenRouter traffic to one in-flight request and enforces spacing between calls.
 */
export class OpenRouterRateLimiter {
    private chain: Promise<unknown> = Promise.resolve();
    private lastEndAt = 0;

    constructor(private readonly minDelayMs = DEFAULT_MIN_DELAY_MS) {}

    /**
     * Runs {@link fn} after any prior call completes and the minimum delay has elapsed.
     */
    run<T>(fn: () => Promise<T>): Promise<T> {
        const job = this.chain.then(async () => {
            const wait = Math.max(0, this.minDelayMs - (Date.now() - this.lastEndAt));
            if (wait > 0) {
                await new Promise((resolve) => setTimeout(resolve, wait));
            }
            return fn();
        }).finally(() => {
            this.lastEndAt = Date.now();
        });

        this.chain = job.then(
            () => undefined,
            () => undefined
        );
        return job as Promise<T>;
    }

    /** Clears queued state (for tests). */
    reset(): void {
        this.chain = Promise.resolve();
        this.lastEndAt = 0;
    }
}

const sharedLimiter = new OpenRouterRateLimiter();

/** Runs a function through the shared OpenRouter rate limiter. */
export function runWithOpenRouterRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    return sharedLimiter.run(fn);
}

/** Resets the shared limiter (for tests). */
export function resetOpenRouterRateLimitForTests(): void {
    sharedLimiter.reset();
}
