import { useEffect, useState } from 'react';
import axios from 'axios';
import { apiClient } from '../../shared/api/client';
import type { HealthResponse } from '../../shared/api/types';

type HealthState = 'checking' | 'online' | 'offline';

export function HealthPanel() {
  const [state, setState] = useState<HealthState>('checking');

  useEffect(() => {
    const controller = new AbortController();

    apiClient
      .get<HealthResponse>('/health', { signal: controller.signal })
      .then(({ data }) => setState(data.status === 'ok' ? 'online' : 'offline'))
      .catch((error: unknown) => {
        if (!axios.isCancel(error)) {
          setState('offline');
        }
      });

    return () => controller.abort();
  }, []);

  const label = {
    checking: 'Checking API connection',
    online: 'API connected',
    offline: 'API unavailable',
  }[state];

  return (
    <div className={`health-indicator health-${state}`} role="status" aria-live="polite">
      <span className="health-dot" aria-hidden="true" />
      {label}
    </div>
  );
}
