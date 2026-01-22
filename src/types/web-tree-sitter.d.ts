/**
 * @fileoverview Type declarations for web-tree-sitter module.
 * This provides minimal type definitions for the dynamic import.
 */

declare module 'web-tree-sitter' {
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

    export interface Tree {
        readonly rootNode: SyntaxNode;
    }

    export interface Language {
        // Language instance
    }

    export interface Parser {
        setLanguage(language: Language): void;
        parse(input: string): Tree;
    }

    interface TreeSitterStatic {
        init(): Promise<void>;
        Language: {
            load(path: string): Promise<Language>;
        };
        new(): Parser;
    }

    const TreeSitter: TreeSitterStatic;
    export default TreeSitter;
}
