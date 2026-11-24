"use client";

/**
 * OpenStore — Barcode scanner component.
 *
 * Uses @zxing/browser to scan EAN/UPC/Code128 barcodes from the device camera.
 * Calls onDetected(barcode) on each successful scan.
 *
 * The Scanner inner component is only mounted while the dialog is open so its
 * initial state is "starting" (no setState-in-effect), and the camera is
 * stopped via the effect cleanup on unmount.
 */
import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { Camera, X, Loader2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import Modal, { type ModalState } from "@/components/common/modal.component";

export function BarcodeScannerDialog({
  controller,
  onDetected,
}: {
  controller: ModalState<void>;
  onDetected: (barcode: string) => void;
}) {
  const open = controller.isOpen;

  return (
    <Modal controller={controller} title="Scan product barcode" closable>
      <p className="mb-4 text-sm text-muted-foreground">
        Point the camera at the product barcode. Detected codes auto-fill the cart.
      </p>
        {open && <Scanner onDetected={onDetected} />}

        <div className="flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={controller.closeFn}>
            <X className="mr-1 h-4 w-4" /> Close
          </Button>
        </div>
    </Modal>
  );
}

type ScanStatus = "starting" | "scanning" | "error";

function Scanner({ onDetected }: { onDetected: (barcode: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  // Initial status is "starting" — no setState-in-effect needed.
  const [status, setStatus] = useState<ScanStatus>("starting");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        let deviceId: string | undefined;
        if (devices.length > 0) {
          const back = devices.find((d) => /back|rear|environment/i.test(d.label));
          deviceId = back?.deviceId ?? devices[0].deviceId;
        }
        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          (result) => {
            if (result) {
              const text = result.getText();
              if (text && !cancelled) onDetected(text);
            }
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStatus("scanning");
      } catch (e) {
        console.error("scanner error", e);
        setStatus("error");
        setErrorMsg(
          "Could not access the camera. Allow camera permission and try again. On iOS Safari, use HTTPS.",
        );
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
    // We deliberately do NOT include onDetected so the scanner doesn't restart
    // on every parent re-render. Parents should memoise onDetected.
  }, []);

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-black">
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
      {/* Scan overlay */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-1/3 w-4/5 rounded-md border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
      </div>
      {status === "starting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-xs">Starting camera…</span>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-white">
          <Camera className="h-8 w-8 opacity-50" />
          <span className="text-xs">{errorMsg}</span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2 text-center text-xs text-white/80">
        {status === "scanning"
          ? "Scanning… point at a barcode."
          : status === "error"
            ? "Camera unavailable"
            : "Hold still…"}
      </div>
    </div>
  );
}
