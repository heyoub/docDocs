/**
 * @fileoverview Indexes generated module schemas into IntelliSense providers.
 *
 * @module core/pipeline/indexGeneratedSchema
 */

import type { FileURI, ModuleSchema } from '../../types/index.js';
import { updateDocCache } from '../../providers/completion.js';
import { updateSymbolCache } from '../../providers/symbols.js';

/**
 * Updates completion and workspace-symbol provider caches for a generated schema.
 */
export function indexSchemaInProviders(uri: FileURI, schema: ModuleSchema): void {
    updateDocCache(uri, schema);
    updateSymbolCache(uri, schema);
}
