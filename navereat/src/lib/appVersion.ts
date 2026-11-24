import pkg from '../../package.json';

export const APP_VERSION = (pkg as { version?: string }).version ?? '1.0.0';
