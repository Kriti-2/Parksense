import { useCallback, useEffect, useState, useRef } from 'react';

export function useLiveFeed(onTick) {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState(null);

  // Store onTick in a mutable ref so the WebSocket does not re-open when onTick changes
  const onTickRef = useRef(onTick);
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

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
          if (onTickRef.current) {
            onTickRef.current(payload);
          }
        }
      } catch {
        /* ignore malformed messages */
      }
    };

    return () => ws.close();
  }, []); // Empty array → connection opened exactly once on mount

  return { connected, status };
}
