import { Store } from "lucide-react";

type LoadingScreenProps = {
  storeName: string;
  message: string;
};

export function LoadingScreen({ storeName, message }: LoadingScreenProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl animate-pulse" />
        <div className="absolute -left-20 top-1/4 h-56 w-56 rounded-full bg-chart-2/10 blur-3xl" />
        <div className="absolute -right-20 bottom-1/4 h-64 w-64 rounded-full bg-chart-4/10 blur-3xl" />
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="relative z-10 flex w-[min(22rem,calc(100%-2rem))] flex-col items-center rounded-3xl border bg-card/75 px-8 py-10 text-center shadow-2xl shadow-primary/5 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-300"
      >
        <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-primary/15" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
          <div className="absolute inset-2 rounded-full bg-primary/10 animate-pulse" />
          <Store className="relative h-8 w-8 text-primary" />
        </div>

        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {storeName}
        </p>
        <h1 className="mt-2 text-lg font-semibold tracking-tight">{message}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Please wait a moment</p>

        <div aria-hidden="true" className="mt-6 flex items-center gap-1.5">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60"
              style={{ animationDelay: `${dot * 140}ms` }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
