/**
 * @fileoverview Symbol types for GenDocs extension.
 * This module defines symbol kinds, modifiers, visibility, and the base symbol interface.
 * Imports only from types/base.ts - Layer 0 of the type system.
 *
 * @module types/symbols
 */

import type { SymbolID, SourceLocation } from './base.js';

// ============================================================
// Symbol Kind Types
// ============================================================

/**
 * Kind of symbol extracted from source code.
 * Matches VS Code SymbolKind semantically but uses string literals
 * for better serialization and readability.
 *
 * @example
 * const kind: SymbolKind = 'function';
 */
export type SymbolKind =
    | 'module'
    | 'namespace'
    | 'class'
    | 'interface'
    | 'type'
    | 'enum'
    | 'function'
    | 'method'
    | 'property'
    | 'variable'
    | 'constant'
    | 'constructor'
    | 'field'
    | 'event';

// ============================================================
// Symbol Modifier Types
// ============================================================

/**
 * Modifier applied to a symbol.
 * Derived from semantic token modifiers provided by language servers.
 * These modifiers affect how symbols behave and should be documented.
 *
 * @example
 * const modifiers: readonly SymbolModifier[] = ['static', 'readonly'];
 */
export type SymbolModifier =
    | 'static'
    | 'readonly'
    | 'abstract'
    | 'async'
    | 'generator'
    | 'optional'
    | 'override'
    | 'final'
    | 'virtual'
    | 'deprecated';

// ============================================================
// Visibility Types
// ============================================================

/**
 * Visibility level of a symbol.
 * Determines whether a symbol is part of the public API surface.
 *
 * - `public`: Accessible from anywhere
 * - `protected`: Accessible from subclasses
 * - `private`: Accessible only within the defining scope
 * - `internal`: Accessible within the same module/package
 *
 * @example
 * const visibility: Visibility = 'public';
 */
export type Visibility = 'public' | 'protected' | 'private' | 'internal';

// ============================================================
// Symbol Base Interface
// ============================================================

/**
 * Base interface for all extracted symbols.
 * Contains the common properties shared by all symbol types.
 * All properties are readonly to ensure immutability.
 *
 * @example
 * const symbol: SymbolBase = {
 *   id: 'MyClass#myMethod' as SymbolID,
 *   name: 'myMethod',
 *   kind: 'method',
 *   location: {
 *     uri: 'file:///path/to/file.ts' as FileURI,
 *     range: { start: { line: 10, character: 2 }, end: { line: 15, character: 3 } }
 *   },
 *   modifiers: ['public', 'async'],
 *   visibility: 'public'
 * };
 */
export interface SymbolBase {
    /** Unique identifier for this symbol within the workspace */
    readonly id: SymbolID;

    /** Name of the symbol as it appears in source code */
    readonly name: string;

    /** Kind of symbol (function, class, interface, etc.) */
    readonly kind: SymbolKind;

    /** Source location where this symbol is defined */
    readonly location: SourceLocation;

    /** Modifiers applied to this symbol (static, readonly, async, etc.) */
    readonly modifiers: readonly SymbolModifier[];

    /** Visibility level of this symbol */
    readonly visibility: Visibility;
}
