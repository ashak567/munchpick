'use client';

/**
 * Re-exports the unified responsive coordinator logic for backward compatibility
 * with existing page references.
 */

export * from './ResponsiveCoordinator';
export { useResponsiveCoordinator as useLayoutCoordinator } from './ResponsiveCoordinator';
