import { X } from 'lucide-react';
import React, { useMemo } from 'react';

import type { ModalState } from '@/components/common/types';
export type { ModalState };
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function useModal<T>(): ModalState<T> {
  const [isOpen, setIsOpen] = React.useState(false);
  const [data, setData] = React.useState<T | undefined>(undefined);

  const openFn = React.useCallback((nextData: T | undefined) => {
    setData(nextData);
    setIsOpen(true);
  }, []);

  const closeFn = React.useCallback(() => {
    setData(undefined);
    setIsOpen(false);
  }, []);

  return useMemo(
    () =>
      Object.freeze<ModalState<T>>({
        get data() {
          return data;
        },
        get isOpen() {
          return isOpen;
        },
        openFn,
        closeFn,
      }),
    [data, isOpen, openFn, closeFn],
  );
}

type ModalComponentProps<T> = {
  controller: ModalState<T>;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'half' | 'full';
  className?: string;
  children?: React.ReactNode;
  closable?: boolean;
  windowType?: 'mac' | 'linux';
};

export default function Modal<T>({
  controller,
  title = 'Modal',
  className = '',
  size = 'md',
  closable = false,
  windowType = 'linux',
  children = undefined,
}: ModalComponentProps<T>): React.ReactNode {
  const sizeClasses = useMemo(() => {
    switch (size) {
      case 'sm':
        return '!max-w-sm';
      case 'md':
        return '!max-w-md';
      case 'lg':
        return '!max-w-lg';
      case 'xl':
        return '!max-w-xl';
      case '2xl':
        return '!max-w-2xl';
      case '3xl':
        return '!max-w-3xl';
      case '4xl':
        return '!max-w-4xl';
      case '5xl':
        return '!max-w-5xl';
      case 'half':
        return '!max-w-[65vw]';
      case 'full':
        return '!max-w-[95vw] max-h-[95vh]';
      default:
        return '!max-w-md';
    }
  }, [size]);

  const handlePointerDownOutside = (e: Event) => {
    if (!closable) e.preventDefault();
  };

  const handleEscapeKeyDown = (e: KeyboardEvent) => {
    if (!closable) {
      e.preventDefault();
    }
  };

  return (
    <Dialog open={controller.isOpen} onOpenChange={controller.closeFn} modal>
      <DialogContent
        showCloseButton={false}
        data-window-type={windowType}
        className={cn(
          'p-0 overflow-hidden flex flex-col bg-card',
          windowType === 'mac'
            ? 'rounded-2xl border border-border/50 shadow-2xl shadow-black/5 dark:shadow-black/20'
            : 'rounded-xl border border-border/70 shadow-[0_18px_55px_-18px_rgba(15,23,42,0.28)] ring-1 ring-primary/10 dark:shadow-[0_18px_55px_-18px_rgba(0,0,0,0.65)] dark:ring-primary/15',
          'transition-all duration-300 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          sizeClasses,
          size !== 'full' && 'max-h-[85vh]',
          className
        )}
        onPointerDownOutside={handlePointerDownOutside}
        onEscapeKeyDown={handleEscapeKeyDown}
        aria-describedby={undefined}
      >
        {title && (
          <div
            className={cn(
              'relative flex items-center justify-center px-4 py-2.5 backdrop-blur-sm',
              windowType === 'mac'
                ? 'border-b border-border/50 bg-muted/30'
                : 'border-b border-border/60 bg-muted/20'
            )}
          >
            <div className="absolute left-4 flex items-center gap-1.5">
              <button
                type="button"
                className={cn(
                  'group relative flex size-3 cursor-pointer items-center justify-center transition-all duration-200',
                  windowType === 'mac'
                    ? 'rounded-full bg-red-400 hover:bg-red-500'
                    : 'rounded-[3px] bg-foreground/10 shadow-[0_0_0_3px_hsl(var(--background)),0_0_0_4px_hsl(var(--border))] hover:bg-foreground/20'
                )}
                onClick={controller.closeFn}
                aria-label="Close modal"
              >
                <X
                  className={cn(
                    'size-2 transition-opacity',
                    windowType === 'mac'
                      ? 'text-red-900 opacity-0 group-hover:opacity-100'
                      : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                  )}
                />
              </button>
              <span
                className={cn(
                  'size-3',
                  windowType === 'mac'
                    ? 'rounded-full bg-amber-400/80'
                    : 'rounded-[3px] bg-foreground/10'
                )}
              />
              <span
                className={cn(
                  'size-3',
                  windowType === 'mac'
                    ? 'rounded-full bg-emerald-400/80'
                    : 'rounded-[3px] bg-foreground/10'
                )}
              />
            </div>

            <DialogTitle
              className={cn(
                'text-[13px] font-semibold leading-none tracking-tight select-none',
                windowType === 'mac' ? 'text-muted-foreground' : 'text-foreground'
              )}
            >
              {title}
            </DialogTitle>
            <div className="absolute right-4 w-13" />
          </div>
        )}

        {/* Content */}
        <div className={cn('flex-1 overflow-y-auto bg-card', size === 'full' ? 'p-8' : 'p-6')}>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}