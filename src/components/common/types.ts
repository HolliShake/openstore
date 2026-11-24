export type ModalState<T> = {
  isOpen: boolean;
  data: T | undefined;
  openFn: (data?: T) => void;
  closeFn: () => void;
};
