/**
 * Type declaration for web-tree-sitter dynamic import
 * Compatible with bundler module resolution
 */
declare module 'web-tree-sitter' {
  interface TreeSitterLanguage {
    load(path: string): Promise<unknown>;
  }

  interface TreeSitterConstructor {
    init(): Promise<void>;
    Language: TreeSitterLanguage;
    new(): unknown;
  }

  const TreeSitter: TreeSitterConstructor;
  export default TreeSitter;
}
