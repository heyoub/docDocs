/**
 * @fileoverview Token estimation and truncation utilities.
 * Used by the AI Context Generator to ensure context files fit within LLM context windows.
 *
 * @module utils/tokens
 * @requirements 4.6, 4.7
 */

/**
 * Average characters per token for English text.
 * This is a common approximation used by many LLM tokenizers.
 * GPT-style tokenizers average ~4 characters per token for English.
 */
const CHARS_PER_TOKEN = 4;

/**
 * Estimates the number of tokens in a text string.
 * Uses a simple heuristic of ~4 characters per token, which is a common
 * approximation for English text with GPT-style tokenizers.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count (integer)
 *
 * @example
 * const tokens = estimateTokens('Hello, world!');
 * // Returns: 4 (13 characters / 4 ≈ 3.25, rounded up)
 *
 * @example
 * const tokens = estimateTokens('');
 * // Returns: 0
 */
export function estimateTokens(text: string): number {
    if (text.length === 0) {
        return 0;
    }
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Truncates text to fit within a maximum token limit while preserving word boundaries.
 * The function ensures the result does not exceed the specified token limit.
 *
 * @param text - The text to truncate
 * @param maxTokens - Maximum number of tokens allowed
 * @returns Truncated text that fits within the token limit
 *
 * @example
 * const truncated = truncateToTokens('Hello world, this is a test', 3);
 * // Returns text truncated to ~12 characters at word boundary
 *
 * @example
 * const truncated = truncateToTokens('Short', 100);
 * // Returns: 'Short' (no truncation needed)
 */
export function truncateToTokens(text: string, maxTokens: number): string {
    if (maxTokens <= 0) {
        return '';
    }

    const currentTokens = estimateTokens(text);
    if (currentTokens <= maxTokens) {
        return text;
    }

    // Calculate approximate character limit
    const maxChars = maxTokens * CHARS_PER_TOKEN;

    // Find the last word boundary before or at maxChars
    const truncated = truncateAtWordBoundary(text, maxChars);

    return truncated;
}

/**
 * Truncates text at a word boundary, ensuring we don't cut in the middle of a word.
 *
 * @param text - The text to truncate
 * @param maxChars - Maximum characters allowed
 * @returns Text truncated at the nearest word boundary
 */
function truncateAtWordBoundary(text: string, maxChars: number): string {
    if (text.length <= maxChars) {
        return text;
    }

    // Find the last whitespace character before or at maxChars
    let lastSpace = -1;
    for (let i = maxChars; i >= 0; i--) {
        if (isWhitespace(text.charCodeAt(i))) {
            lastSpace = i;
            break;
        }
    }

    // If no whitespace found, truncate at maxChars (word is longer than limit)
    if (lastSpace === -1) {
        return text.slice(0, maxChars);
    }

    // Truncate at the word boundary
    return text.slice(0, lastSpace);
}

/**
 * Checks if a character code represents whitespace.
 *
 * @param charCode - The character code to check
 * @returns True if the character is whitespace
 */
function isWhitespace(charCode: number): boolean {
    // Space, tab, newline, carriage return
    return charCode === 32 || charCode === 9 || charCode === 10 || charCode === 13;
}
