import { useCallback, useEffect, useState } from 'react';

export function useLiveFeed(onTick) {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState(null);

  const stableOnTick = useCallback(
    (payload) => {
      if (onTick) onTick(payload);
    },
    [onTick]
  );

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/live/ws`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.live_mode !== undefined && !payload.type) {
          setStatus(payload);
        } else {
          setStatus((prev) => ({ ...prev, last_tick: payload.timestamp, traffic: payload.data_sources?.traffic }));
          stableOnTick(payload);
        }
      } catch {
        /* ignore malformed messages */
      }
    };

    return () => ws.close();
  }, [stableOnTick]);

  return { connected, status };
}
