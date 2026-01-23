/**
 * Type declaration for vectordb (LanceDB)
 * The module is dynamically imported and uses local type definitions in db.ts
 */
declare module 'vectordb' {
  const vectordb: {
    connect(path: string): Promise<unknown>;
  };
  export = vectordb;
}
