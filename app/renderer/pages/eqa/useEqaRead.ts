// Mỗi lần đổi phạm vi chỉ nhận phản hồi của yêu cầu còn hiệu lực.
import { useEffect, useState } from 'react';
import { useEqaStore } from '../../store/eqa-store';

export function useEqaRead<T>(key: string, read: () => Promise<T>) {
  const [attempt, retry] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: '' });
  useEffect(() => {
    let alive = true;
    read().then((data) => { if (alive) setState({ key, data }); })
      .catch((e) => { if (alive) setState({ key, error: e instanceof Error ? e.message : 'Không tải được dữ liệu.' }); });
    return () => { alive = false; };
  }, [key, read, attempt]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : undefined, retry: () => retry((n) => n + 1) };
}

export function useEqaRevision() {
  return useEqaStore((s) => s.rounds.map((r) => `${r.id}:${r.version}:${r.status}:${r.updated_at}`).join(','));
}
