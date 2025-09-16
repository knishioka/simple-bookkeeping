/**
 * Playwright Configuration Module Exports
 * Central export point for all Playwright configuration modules
 */

// Export from modes (except getGlobalTimeout which conflicts with timeouts)
export {
  ModeConfig,
  isCI,
  isDebug,
  getTestMode,
  modeConfigs,
  getCurrentModeConfig,
  getGlobalTimeout as getModeGlobalTimeout,
} from './modes';

// Export all from other modules
export * from './projects';
export * from './reporters';
export * from './auth-config';
export * from './timeouts';
export * from './validation';

// Export constants
export * from '../constants';
