import { useCallback, useEffect, useRef, useState } from 'react';
import api, { errMsg } from '../api/client';

/**
 * GET helper with loading/error state. Re-fetches when `url` or `params` change.
 * Returns { data, meta, loading, error, reload, setData }.
 */
export default function useFetch(url, params, { skip = false } = {}) {
  const [state, setState] = useState({ data: null, meta: null, loading: Boolean(url) && !skip, error: null });
  const key = JSON.stringify(params || {});
  const reqId = useRef(0);

  const load = useCallback(async () => {
    if (!url || skip) return;
    const id = ++reqId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await api.get(url, { params: JSON.parse(key) });
      if (id === reqId.current) setState({ data: res.data.data, meta: res.data.meta || null, loading: false, error: null });
    } catch (err) {
      if (id === reqId.current) setState((s) => ({ ...s, loading: false, error: errMsg(err) }));
    }
  }, [url, key, skip]);

  useEffect(() => {
    load();
  }, [load]);

  const setData = (updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  return { ...state, reload: load, setData };
}

/** Debounces a value. */
export function useDebounce(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
