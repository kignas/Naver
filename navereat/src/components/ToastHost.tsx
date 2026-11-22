import { useToastStore } from '../store/toastStore';
import { Icon } from './Icon';

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => dismiss(t.id)}>
          <Icon
            name={t.type === 'error' ? 'solid:triangle-exclamation' : 'solid:circle-check'}
            size={14}
          />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
