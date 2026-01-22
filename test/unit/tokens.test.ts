/**
 * @fileoverview Unit tests for token estimation and truncation utilities.
 * @module test/unit/tokens
 */

import { describe, it, expect } from 'vitest';
import { estimateTokens, truncateToTokens } from '../../src/utils/tokens.js';

describe('estimateTokens', () => {
    it('returns 0 for empty string', () => {
        expect(estimateTokens('')).toBe(0);
    });

    it('estimates tokens based on ~4 chars per token', () => {
        // 4 chars = 1 token
        expect(estimateTokens('test')).toBe(1);

        // 8 chars = 2 tokens
        expect(estimateTokens('testtest')).toBe(2);

        // 13 chars = ceil(13/4) = 4 tokens
        expect(estimateTokens('Hello, world!')).toBe(4);
    });

    it('rounds up partial tokens', () => {
        // 5 chars = ceil(5/4) = 2 tokens
        expect(estimateTokens('hello')).toBe(2);

        // 1 char = ceil(1/4) = 1 token
        expect(estimateTokens('a')).toBe(1);
    });

    it('handles whitespace-only strings', () => {
        expect(estimateTokens('    ')).toBe(1); // 4 spaces = 1 token
        expect(estimateTokens('        ')).toBe(2); // 8 spaces = 2 tokens
    });

    it('handles multiline text', () => {
        const multiline = 'line1\nline2\nline3';
        // 17 chars = ceil(17/4) = 5 tokens
        expect(estimateTokens(multiline)).toBe(5);
    });
});

describe('truncateToTokens', () => {
    it('returns empty string for maxTokens <= 0', () => {
        expect(truncateToTokens('Hello world', 0)).toBe('');
        expect(truncateToTokens('Hello world', -1)).toBe('');
    });

    it('returns original text if within token limit', () => {
        const text = 'Short';
        expect(truncateToTokens(text, 100)).toBe(text);
    });

    it('returns original text if exactly at token limit', () => {
        const text = 'test'; // 4 chars = 1 token
        expect(truncateToTokens(text, 1)).toBe(text);
    });

    it('truncates at word boundary', () => {
        const text = 'Hello world test';
        // maxTokens = 2 means ~8 chars
        const result = truncateToTokens(text, 2);
        // Should truncate at word boundary before or at 8 chars
        expect(result).toBe('Hello');
        expect(estimateTokens(result)).toBeLessThanOrEqual(2);
    });

    it('truncates long single word at char limit', () => {
        const text = 'supercalifragilisticexpialidocious';
        // maxTokens = 2 means ~8 chars
        const result = truncateToTokens(text, 2);
        expect(result.length).toBeLessThanOrEqual(8);
    });

    it('preserves word boundaries with multiple words', () => {
        const text = 'The quick brown fox jumps over the lazy dog';
        // maxTokens = 5 means ~20 chars
        const result = truncateToTokens(text, 5);
        // Should not cut in middle of a word
        expect(result.endsWith(' ')).toBe(false);
        expect(estimateTokens(result)).toBeLessThanOrEqual(5);
    });

    it('handles text with tabs and newlines', () => {
        const text = 'Hello\tworld\ntest';
        const result = truncateToTokens(text, 2);
        expect(estimateTokens(result)).toBeLessThanOrEqual(2);
    });

    it('handles empty string input', () => {
        expect(truncateToTokens('', 10)).toBe('');
    });
});
