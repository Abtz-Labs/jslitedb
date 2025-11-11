/**
 * TypeScript definitions for JSLiteDB utilities
 */

/**
 * IndexSystem for optimized field-based queries
 */
export declare class IndexSystem {
  public readonly field: string;
  public readonly index: Map<any, Set<string>>;

  constructor(field: string);

  add(key: string, value: any): void;
  remove(key: string, value: any): void;
  get(value: any): Set<string>;
  clear(): void;
  size(): number;
  getIndexedValues(): any[];
  hasValue(value: any): boolean;
  getStats(): {
    field: string;
    uniqueValues: number;
    totalDocuments: number;
    distribution: Record<string, number>;
  };
}

/**
 * Logger for structured logging
 */
export declare class Logger {
  public readonly level: string;
  public readonly enableConsole: boolean;
  public readonly logFile?: string;

  constructor(options?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    enableConsole?: boolean;
    logFile?: string;
  });

  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
  debug(message: string, meta?: Record<string, any>): void;
  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void;
  getLevel(): string;
  shouldLog(level: string): boolean;
  child(context: Record<string, any>): Logger;
}

/**
 * Validator for input validation
 */
export declare class Validator {
  static validatePagination(limit?: any, skip?: any): { valid: boolean; error?: string };
  static validateFieldName(field: any): { valid: boolean; error?: string };
  static validateSortDirection(direction: any): { valid: boolean; error?: string };
  static validateQueryOperator(operator: any): { valid: boolean; error?: string };
  static validateAggregationOperation(operation: any): { valid: boolean; error?: string };
  static validateFilePath(filePath: any): { valid: boolean; error?: string };
  static sanitizeString(input: string): string;
  static validateBatch(
    params: Record<string, any>,
    rules: Record<string, { type: 'field' }>
  ): { valid: boolean; errors?: string[] };
}

/**
 * WriteMutex for thread-safe file operations
 */
export declare class WriteMutex {
  public readonly locked: boolean;
  public readonly queue: Function[];

  constructor();

  acquire(): Promise<void>;
  release(): void;
  getStatus(): { locked: boolean; queueLength: number };
}

/**
 * Collection class for document operations
 */
export declare class Collection {
  public readonly db: any;
  public readonly name: string;

  constructor(db: any, name: string);

  insert(document: any): Promise<any & { id: string }>;
  insert(id: string | number, document: any): Promise<any & { id: string }>;
  update(id: string | number, document: any): Promise<any>;
  findById(id: string | number): Promise<any | null>;
  find(options?: {
    filter?: (document: any, id: string) => boolean;
    limit?: number;
    skip?: number;
  }): Promise<Array<any & { id: string }>>;
  findOne(filter: (document: any, id: string) => boolean): Promise<(any & { id: string }) | null>;
  delete(id: string | number): Promise<boolean>;
  count(options?: ((document: any, id: string) => boolean) | { filter?: (document: any, id: string) => boolean }): Promise<number>;
  stream(): AsyncGenerator<any, void, unknown>;
  aggregate(operations: Array<{
    type: 'match' | 'sort' | 'limit' | 'skip' | 'group';
    filter?: (document: any) => boolean;
    field?: string;
    direction?: 'asc' | 'desc';
    count?: number;
  }>): Promise<any>;
}

/**
 * Query result item
 */
export interface QueryResultItem<T = any> {
  key: string;
  value: T;
}

/**
 * Query result class with chainable methods
 */
export declare class QueryResult<T = any> {
  public readonly results: QueryResultItem<T>[];

  constructor(results: QueryResultItem<T>[]);

  sort(field: string, direction?: 'asc' | 'desc'): QueryResult<T>;
  limit(count: number): QueryResult<T>;
  skip(count: number): QueryResult<T>;
  count(): number;
  first(): QueryResultItem<T> | undefined;
  last(): QueryResultItem<T> | undefined;
  toArray(): QueryResultItem<T>[];
  values(): T[];
  keys(): string[];
  filter(predicate: (value: T, key: string) => boolean): QueryResult<T>;
  map<U>(mapper: (value: T, key: string) => U): U[];
}