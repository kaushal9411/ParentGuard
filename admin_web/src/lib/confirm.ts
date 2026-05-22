/**
 * Wrappers around SweetAlert2 so every confirm/toast uses one consistent style.
 * Import `confirmDialog` for yes/no prompts and `toast` for notifications.
 */
import Swal from 'sweetalert2';

// ── Confirm dialog (replaces window.confirm) ──────────────────────────────────

interface ConfirmOpts {
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  /** 'danger' (default red) | 'warning' (amber) | 'info' (blue) */
  type?: 'danger' | 'warning' | 'info';
  theme?: 'light' | 'dark';
}

export async function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  const isDark = opts.theme === 'dark';
  const colors = {
    danger:  { btn: '#ef4444', icon: 'error'   as const },
    warning: { btn: '#f59e0b', icon: 'warning' as const },
    info:    { btn: '#6366f1', icon: 'question' as const },
  };
  const c = colors[opts.type ?? 'danger'];

  const result = await Swal.fire({
    title: opts.title,
    text:  opts.text,
    icon:  c.icon,
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? 'Yes, proceed',
    cancelButtonText:  opts.cancelText  ?? 'Cancel',
    confirmButtonColor: c.btn,
    cancelButtonColor:  isDark ? '#374151' : '#9ca3af',
    background:    isDark ? '#111827' : '#ffffff',
    color:         isDark ? '#f9fafb' : '#111827',
    iconColor:     c.btn,
    reverseButtons: true,
    customClass: {
      popup:         isDark ? 'swal-dark' : '',
      confirmButton: 'swal-confirm-btn',
      cancelButton:  'swal-cancel-btn',
    },
  });
  return result.isConfirmed;
}

// ── Info/result dialog (two-step: after action, ask follow-up) ────────────────

export async function stepConfirm(opts: {
  title: string; text?: string;
  confirmText?: string; cancelText?: string;
  theme?: 'light' | 'dark';
}): Promise<boolean> {
  const isDark = opts.theme === 'dark';
  const result = await Swal.fire({
    title: opts.title,
    text:  opts.text,
    icon:  'success',
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? 'Yes',
    cancelButtonText:  opts.cancelText  ?? 'No, keep it',
    confirmButtonColor: '#ef4444',
    cancelButtonColor:  isDark ? '#374151' : '#9ca3af',
    background: isDark ? '#111827' : '#ffffff',
    color:      isDark ? '#f9fafb' : '#111827',
    reverseButtons: true,
  });
  return result.isConfirmed;
}
