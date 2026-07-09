export type ComponentStatus = 'idle' | 'success' | 'error' | 'warning';

export const STATUS_VARIABLES: Record<ComponentStatus, Record<string, string>> = {
  idle: { '--current-status': 'transparent' },
  success: { '--current-status': 'var(--success)' },
  error: { '--current-status': 'var(--destructive)' },
  warning: { '--current-status': 'var(--warning)' },
};
