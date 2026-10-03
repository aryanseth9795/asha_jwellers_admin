/**
 * App-wide banners and confirm dialogs (notifications spec §3.1). Pure — no react-native import — so it is unit-tested.
 * Screens call notify.* and confirm(); ToastHost / ConfirmHost draw from this store.
 */
export type ToastKind = "success" | "error" | "info";
export type ConfirmTone = "danger" | "warning" | "primary";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  duration: number;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** null = single-button acknowledgement. */
  cancelLabel?: string | null;
  tone?: ConfirmTone;
  /** Ionicons glyph name; defaults by tone. */
  icon?: string;
}

export interface ConfirmRequest {
  id: number;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string | null;
  tone: ConfirmTone;
  icon: string;
}

export interface NotifyState {
  toast: Toast | null;
  confirms: ConfirmRequest[];
  /** The toast host that draws banners: the last registered one still mounted. */
  activeHost: number | null;
}

export const DURATIONS: Record<ToastKind, number> = { success: 2200, info: 2800, error: 3500 };

export const CONFIRM_ICONS: Record<ConfirmTone, string> = {
  danger: "trash-outline",
  warning: "alert-circle-outline",
  primary: "help-circle-outline",
};

/** What Android back or a backdrop tap means: Cancel, or OK when there is no Cancel button. */
export const dismissResult = (request: ConfirmRequest): boolean => request.cancelLabel === null;

export const createNotifier = () => {
  let state: NotifyState = { toast: null, confirms: [], activeHost: null };
  let nextId = 1;
  const hosts: number[] = [];
  const resolvers = new Map<number, (ok: boolean) => void>();
  const listeners = new Set<() => void>();

  const set = (patch: Partial<NotifyState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  return {
    getState: (): NotifyState => state,

    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    show: (kind: ToastKind, title: string, message?: string): Toast => {
      const toast: Toast = { id: nextId++, kind, title, message, duration: DURATIONS[kind] };
      set({ toast });
      return toast;
    },

    dismiss: (id: number): void => {
      if (state.toast?.id === id) set({ toast: null });
    },

    confirm: (options: ConfirmOptions): Promise<boolean> => {
      const tone = options.tone ?? "primary";
      const request: ConfirmRequest = {
        id: nextId++,
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? "OK",
        cancelLabel: options.cancelLabel === undefined ? "Cancel" : options.cancelLabel,
        tone,
        icon: options.icon ?? CONFIRM_ICONS[tone],
      };
      return new Promise<boolean>((resolve) => {
        resolvers.set(request.id, resolve);
        set({ confirms: [...state.confirms, request] });
      });
    },

    answer: (id: number, ok: boolean): void => {
      const resolve = resolvers.get(id);
      if (!resolve) return;
      resolvers.delete(id);
      set({ confirms: state.confirms.filter((c) => c.id !== id) });
      resolve(ok);
    },

    registerToastHost: (): { id: number; release: () => void } => {
      const id = nextId++;
      hosts.push(id);
      set({ activeHost: id });
      return {
        id,
        release: () => {
          const index = hosts.indexOf(id);
          if (index < 0) return;
          hosts.splice(index, 1);
          set({ activeHost: hosts.length > 0 ? hosts[hosts.length - 1] : null });
        },
      };
    },
  };
};

export type Notifier = ReturnType<typeof createNotifier>;

/** The app's one notifier. */
export const notifier = createNotifier();

export const notify = {
  success: (title: string, message?: string) => notifier.show("success", title, message),
  error: (title: string, message?: string) => notifier.show("error", title, message),
  info: (title: string, message?: string) => notifier.show("info", title, message),
};

export const confirm = (options: ConfirmOptions): Promise<boolean> => notifier.confirm(options);
