/**
 * @fileoverview Unit tests for OpenRouter request rate limiting.
 */

import { describe, it, expect } from 'vitest';
import { OpenRouterRateLimiter } from '../../src/core/ml/openRouterRateLimit.js';

describe('OpenRouterRateLimiter', () => {
    it('allows only one in-flight request at a time', async () => {
        const limiter = new OpenRouterRateLimiter(0);
        let inFlight = 0;
        let maxInFlight = 0;

        const task = async () => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise((resolve) => setTimeout(resolve, 20));
            inFlight--;
        };

        await Promise.all([
            limiter.run(task),
            limiter.run(task),
            limiter.run(task),
        ]);

        expect(maxInFlight).toBe(1);
    });

    it('waits at least the configured delay between calls', async () => {
        const limiter = new OpenRouterRateLimiter(80);
        const timestamps: number[] = [];

        await limiter.run(async () => {
            timestamps.push(Date.now());
        });
        await limiter.run(async () => {
            timestamps.push(Date.now());
        });

        expect(timestamps).toHaveLength(2);
        expect(timestamps[1]! - timestamps[0]!).toBeGreaterThanOrEqual(75);
    });
});
