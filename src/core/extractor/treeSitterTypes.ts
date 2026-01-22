/**
 * @fileoverview Type definitions and constants for tree-sitter extraction.
 * Layer 3 - imports from types/ (Layer 0).
 *
 * @module core/extractor/treeSitterTypes
 */

import type { Range } from '../../types/base.js';

// ============================================================
// Types
// ============================================================

/**
 * Documentation comment extracted from source code.
 */
export interface DocComment {
    /** The text content of the comment */
    readonly text: string;
    /** The range of the comment in the source */
    readonly range: Range;
    /** The symbol this comment is associated with, or null */
    readonly associatedSymbol: string | null;
}

/**
 * Tree-sitter syntax node type.
 */
export interface SyntaxNode {
    readonly type: string;
    readonly text: string;
    readonly startPosition: { row: number; column: number };
    readonly endPosition: { row: number; column: number };
    readonly children: readonly SyntaxNode[];
    readonly namedChildren: readonly SyntaxNode[];
    readonly parent: SyntaxNode | null;
    readonly previousSibling: SyntaxNode | null;
    childForFieldName(name: string): SyntaxNode | null;
}

/**
 * Tree-sitter tree type.
 */
export interface Tree {
    readonly rootNode: SyntaxNode;
}

// ============================================================
// Constants
// ============================================================

/**
 * Languages supported by tree-sitter extraction.
 * Maps VS Code language IDs to tree-sitter grammar names.
 */
export const SUPPORTED_LANGUAGES: ReadonlyMap<string, string> = new Map([
    ['javascript', 'javascript'],
    ['typescript', 'typescript'],
    ['typescriptreact', 'tsx'],
    ['javascriptreact', 'javascript'],
    ['python', 'python'],
    ['rust', 'rust'],
    ['go', 'go'],
    ['c', 'c'],
    ['cpp', 'cpp'],
    ['java', 'java'],
    ['ruby', 'ruby'],
    ['php', 'php'],
    ['csharp', 'c_sharp'],
    ['swift', 'swift'],
    ['kotlin', 'kotlin'],
    ['scala', 'scala']
]);

/**
 * Node types that represent symbol definitions by language.
 */
export const SYMBOL_NODE_TYPES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
    ['javascript', new Set([
        'function_declaration', 'class_declaration', 'method_definition',
        'variable_declaration', 'lexical_declaration', 'arrow_function',
        'export_statement', 'function_expression'
    ])],
    ['typescript', new Set([
        'function_declaration', 'class_declaration', 'method_definition',
        'interface_declaration', 'type_alias_declaration', 'enum_declaration',
        'variable_declaration', 'lexical_declaration', 'arrow_function',
        'export_statement', 'function_signature', 'method_signature'
    ])],
    ['python', new Set(['function_definition', 'class_definition', 'decorated_definition'])],
    ['rust', new Set([
        'function_item', 'struct_item', 'enum_item', 'impl_item',
        'trait_item', 'type_item', 'const_item', 'static_item', 'mod_item'
    ])],
    ['go', new Set([
        'function_declaration', 'method_declaration', 'type_declaration',
        'const_declaration', 'var_declaration'
    ])],
    ['java', new Set([
        'class_declaration', 'interface_declaration', 'method_declaration',
        'constructor_declaration', 'field_declaration', 'enum_declaration'
    ])]
]);

/**
 * Comment node types by language.
 */
export const COMMENT_NODE_TYPES: ReadonlyMap<string, ReadonlySet<string>> = new Map([
    ['javascript', new Set(['comment'])],
    ['typescript', new Set(['comment'])],
    ['python', new Set(['comment', 'string'])],
    ['rust', new Set(['line_comment', 'block_comment'])],
    ['go', new Set(['comment'])],
    ['java', new Set(['line_comment', 'block_comment'])]
]);
