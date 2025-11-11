import { EventEmitter } from 'events';
import { Server as HttpServer } from 'http';
import { Application } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { IndexSystem, Logger, Validator, WriteMutex, Collection, QueryResult } from './utilities';

/**
 * Configuration options for JSLiteDB
 */
export interface JSLiteDBOptions {
  /** Folder path for storage (each collection gets its own JSON file) (default: "./data") */
  folderPath?: string;
  /** Autosave interval in milliseconds (0 disables autosave) */
  autoSaveInterval?: number;
  /** Enable REST API server */
  enableServer?: boolean;
  /** Server port */
  serverPort?: number;
  /** Enable real-time sync via WebSocket */
  enableRealtime?: boolean;
  /** Optional API key for authentication */
  apiKey?: string;
  /** Enable automatic indexing for performance */
  enableIndexing?: boolean;
  /** Enable lazy loading for large datasets */
  lazyLoading?: boolean;
  /** Maximum items to keep in memory when lazy loading is enabled */
  maxMemoryItems?: number;
  /** Enable request/response logging */
  enableLogging?: boolean;
  /** Enable write queue for better concurrency (batches operations) */
  enableWriteQueue?: boolean;
  /** Write queue flush interval in milliseconds */
  queueFlushInterval?: number;
}

/**
 * Query result item
 */
export interface QueryResultItem<T = any> {
  key: string;
  value: T;
}

/**
 * Sort configuration for queries
 */
export interface SortConfig {
  field: string;
  direction?: 'asc' | 'desc';
}

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  limit?: number;
  skip?: number;
}

/**
 * Query configuration
 */
export interface QueryConfig extends PaginationConfig {
  filter?: (value: any, key: string) => boolean;
  sort?: SortConfig;
}

/**
 * API response structure
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
  totalCount?: number;
  pagination?: {
    limit: number | null;
    skip: number;
    hasMore: boolean;
  };
}

/**
 * Health check response
 */
export interface HealthResponse {
  success: boolean;
  status: string;
  uptime: number;
  realtime: boolean;
  collections: number;
  totalDocuments: number;
  folderPath: string;
  memoryUsage: {
    rss: string;
    heapUsed: string;
    heapTotal: string;
  };
  features: {
    indexing: boolean;
    lazyLoading: boolean;
    realtime: boolean;
  };
}

/**
 * WebSocket events
 */
export interface WebSocketEvents {
  'data:init': (data: any) => void;
  'data:changed': (event: {
    action: 'set' | 'delete' | 'clear' | 'push' | 'pull' | 'add';
    key?: string;
    value?: any;
    number?: number;
    newValue?: any;
    timestamp: number;
  }) => void;
}



/**
 * JSLiteDB events
 */
export interface JSLiteDBEvents {
  'collection:insert': (event: { collection: string; id: string; document: any }) => void;
  'collection:update': (event: { collection: string; id: string; document: any }) => void;
  'collection:delete': (event: { collection: string; id: string; document: any }) => void;
  'collection:dropped': (event: { collection: string }) => void;
  'database:cleared': () => void;
  'backup': (event: { backupPath: string }) => void;
  'restore': (event: { backupPath: string }) => void;
  'server:started': (event: { port: number }) => void;
  'server:stopped': () => void;
  'client:connected': (event: { socketId: string }) => void;
  'client:disconnected': (event: { socketId: string; reason?: string }) => void;
}

/**
 * Main JSLiteDB class
 */
export declare class JSLiteDB extends EventEmitter {
  public readonly folderPath: string;
  public readonly autoSaveInterval: number;
  public readonly enableIndexing: boolean;
  public readonly lazyLoading: boolean;
  public readonly maxMemoryItems: number;
  public readonly enableLogging: boolean;
  public readonly enableWriteQueue: boolean;
  public readonly queueFlushInterval: number;
  public readonly enableServer: boolean;
  public readonly serverPort: number;
  public readonly enableRealtime: boolean;
  public readonly apiKey: string | null;
  public readonly isServerRunning: boolean;

  public readonly app: Application | null;
  public readonly server: HttpServer | null;
  public readonly io: SocketIOServer | null;

  constructor(options?: JSLiteDBOptions);

  // Collection-based methods
  /**
   * Get a collection interface for document operations
   */
  collection(name: string): Collection;

  /**
   * Get all collection names
   */
  collections(): Promise<string[]>;

  /**
   * Drop an entire collection
   */
  dropCollection(collectionName: string): Promise<boolean>;

  /**
   * Clear all collections and data
   */
  clear(): Promise<boolean>;

  /**
   * Get total document count across all collections
   */
  count(): Promise<number>;

  /**
   * Initialize the database explicitly
   */
  init(): Promise<void>;

  /**
   * Close the database and cleanup resources
   */
  close(): Promise<void>;

  /**
   * Get database statistics
   */
  getStats(): Promise<any>;

  // Indexing methods
  /**
   * Create an index for a specific field to optimize queries
   */
  createIndex(field: string): void;

  /**
   * Drop an existing index
   */
  dropIndex(field: string): void;

  /**
   * Get all indexed fields
   */
  getIndexes(): string[];

  // Server methods
  /**
   * Start REST API server with real-time sync
   */
  startServer(port?: number): Promise<void>;

  /**
   * Stop the REST API server
   */
  stopServer(): Promise<void>;

  // Backup & restore
  /**
   * Backup data to a file
   */
  backup(backupPath: string): Promise<void>;

  /**
   * Restore data from a backup file
   */
  restore(backupPath: string): Promise<void>;

  // Save
  /**
   * Save data to disk
   */
  save(): Promise<void>;

  // Event emitter methods
  on<K extends keyof JSLiteDBEvents>(event: K, listener: JSLiteDBEvents[K]): this;
  emit<K extends keyof JSLiteDBEvents>(event: K, ...args: Parameters<JSLiteDBEvents[K]>): boolean;
  off<K extends keyof JSLiteDBEvents>(event: K, listener: JSLiteDBEvents[K]): this;
  once<K extends keyof JSLiteDBEvents>(event: K, listener: JSLiteDBEvents[K]): this;
  removeAllListeners<K extends keyof JSLiteDBEvents>(event?: K): this;
}

export default JSLiteDB;

// Export utility classes
export { IndexSystem, Logger, Validator, WriteMutex, Collection, QueryResult };

// Utility types for common patterns
export type JSLiteDocument<T = any> = {
  [key: string]: T;
};

export type FilterFunction<T = any> = (value: T, key: string) => boolean;

export type AggregationOperation = 'count' | 'sum' | 'avg' | 'min' | 'max';

export type QueryOperator = '=' | '==' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'contains' | 'startsWith' | 'endsWith';