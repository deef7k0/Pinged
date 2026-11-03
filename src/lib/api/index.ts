/**
 * Everything that talks to Supabase.
 *
 * Split by domain, re-exported here so callers keep importing from
 * `@/lib/api` regardless of which file a function lives in.
 */
export * from './account';
export * from './awards';
export * from './blocks';
export * from './core';
export * from './discover';
export * from './engagement';
export * from './events';
export * from './friends';
export * from './gaming';
export * from './wall';
export * from './labels';
export * from './lists';
export * from './notifications';
export * from './physical';
export * from './pings';
export * from './pins';
export * from './progress';
export * from './ratings';
export * from './reports';
export * from './similarity';
export * from './songs';
export * from './storage';
export * from './types';
