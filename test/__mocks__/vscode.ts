/**
 * Mock VS Code API for testing
 * This provides minimal stubs for VS Code types used in tests
 */

export enum SymbolKind {
    File = 0,
    Module = 1,
    Namespace = 2,
    Package = 3,
    Class = 4,
    Method = 5,
    Property = 6,
    Field = 7,
    Constructor = 8,
    Enum = 9,
    Interface = 10,
    Function = 11,
    Variable = 12,
    Constant = 13,
    String = 14,
    Number = 15,
    Boolean = 16,
    Array = 17,
    Object = 18,
    Key = 19,
    Null = 20,
    EnumMember = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25,
}

export class Position {
    constructor(
        public readonly line: number,
        public readonly character: number
    ) { }
}

export class Range {
    constructor(
        public readonly start: Position,
        public readonly end: Position
    ) { }
}

export class Uri {
    private constructor(
        public readonly scheme: string,
        public readonly authority: string,
        public readonly path: string,
        public readonly query: string,
        public readonly fragment: string
    ) { }

    /**
     * Creates a Uri from a file system path.
     * @param path - The file system path
     * @returns A new Uri with file scheme
     */
    static file(path: string): Uri {
        return new Uri('file', '', path, '', '');
    }

    /**
     * Parses a string URI into a Uri object.
     * @param value - The URI string to parse
     * @returns A new Uri parsed from the string
     */
    static parse(value: string): Uri {
        // Simple parse - extract path from file:// URI
        const path = value.replace(/^file:\/\//, '');
        return new Uri('file', '', path, '', '');
    }

    /**
     * Joins path segments to a base Uri.
     * @param base - The base Uri to join to
     * @param pathSegments - Path segments to append
     * @returns A new Uri with joined path
     */
    static joinPath(base: Uri, ...pathSegments: string[]): Uri {
        const basePath = base.path.replace(/\/$/, '');
        const joined = [basePath, ...pathSegments].join('/');
        return new Uri(base.scheme, base.authority, joined, base.query, base.fragment);
    }

    /**
     * Converts the Uri to a string representation.
     * @returns The Uri as a string
     */
    toString(): string {
        return `${this.scheme}://${this.path}`;
    }

    /**
     * Gets the file system path of the Uri.
     * @returns The file system path
     */
    get fsPath(): string {
        return this.path;
    }
}

export class Location {
    constructor(
        public readonly uri: Uri,
        public readonly range: Range
    ) { }
}

export const commands = {
    executeCommand: async <T>(_command: string, ..._args: unknown[]): Promise<T | undefined> => {
        return undefined;
    },
    registerCommand: (_command: string, _callback: (...args: unknown[]) => unknown) => {
        return { dispose: () => { } };
    },
};

export const window = {
    showInformationMessage: async (_message: string) => undefined,
    showWarningMessage: async (_message: string) => undefined,
    showErrorMessage: async (_message: string) => undefined,
    createOutputChannel: (_name: string) => ({
        appendLine: (_value: string) => { },
        append: (_value: string) => { },
        clear: () => { },
        show: () => { },
        hide: () => { },
        dispose: () => { },
    }),
    createStatusBarItem: () => ({
        text: '',
        tooltip: '',
        command: undefined,
        show: () => { },
        hide: () => { },
        dispose: () => { },
    }),
    withProgress: async <T>(
        _options: unknown,
        task: (progress: unknown) => Promise<T>
    ): Promise<T> => {
        return task({ report: () => { } });
    },
};

export const workspace = {
    workspaceFolders: undefined as unknown[] | undefined,
    getConfiguration: (_section?: string) => ({
        get: <T>(_key: string, defaultValue?: T): T | undefined => defaultValue,
        update: async () => { },
        has: () => false,
        inspect: () => undefined,
    }),
    fs: {
        readFile: async (_uri: Uri): Promise<Uint8Array> => new Uint8Array(),
        writeFile: async (_uri: Uri, _content: Uint8Array): Promise<void> => { },
        stat: async (_uri: Uri) => ({ type: 1, ctime: 0, mtime: 0, size: 0 }),
        createDirectory: async (_uri: Uri): Promise<void> => { },
    },
    openTextDocument: async (_uri: Uri) => ({
        getText: () => '',
        uri: _uri,
        languageId: 'typescript',
    }),
};

export const languages = {
    registerCodeLensProvider: () => ({ dispose: () => { } }),
    registerCompletionItemProvider: () => ({ dispose: () => { } }),
    registerWorkspaceSymbolProvider: () => ({ dispose: () => { } }),
    createDiagnosticCollection: () => ({
        set: () => { },
        delete: () => { },
        clear: () => { },
        dispose: () => { },
    }),
};

export enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3,
}

export class Diagnostic {
    constructor(
        public readonly range: Range,
        public readonly message: string,
        public readonly severity?: DiagnosticSeverity
    ) { }
}

export enum StatusBarAlignment {
    Left = 1,
    Right = 2,
}

export enum ProgressLocation {
    SourceControl = 1,
    Window = 10,
    Notification = 15,
}

export class EventEmitter<T> {
    private listeners: ((e: T) => void)[] = [];

    event = (listener: (e: T) => void) => {
        this.listeners.push(listener);
        return { dispose: () => { } };
    };

    fire(data: T) {
        this.listeners.forEach((l) => l(data));
    }

    dispose() {
        this.listeners = [];
    }
}

export class CancellationTokenSource {
    token = {
        isCancellationRequested: false,
        onCancellationRequested: () => ({ dispose: () => { } }),
    };

    cancel() {
        this.token.isCancellationRequested = true;
    }

    dispose() { }
}
