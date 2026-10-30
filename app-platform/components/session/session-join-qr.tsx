"use client";

import { QRCodeSVG } from "qrcode.react";
import { isLocalHostname } from "@/lib/session/app-origin";

type SessionJoinQrProps = {
  /** Absolute URL, e.g. https://app.unmutelabs.com/join/ABC234 */
  joinUrl: string;
};

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Join QR for the shared screen. Pure black on pure white rather than the
 * navy-on-warm-white palette: scan reliability at projector distance depends on
 * module contrast, and off-white backgrounds cost margin under room light.
 */
export function SessionJoinQr({ joinUrl }: SessionJoinQrProps) {
  const hostname = hostnameOf(joinUrl);
  const unreachableFromPhones = hostname !== "" && isLocalHostname(hostname);

  return (
    <div className="mb-5 flex flex-col items-center gap-3">
      <div className="rounded-lg border border-cloud-grey bg-white p-4 shadow-sm">
        <QRCodeSVG
          value={joinUrl}
          size={208}
          level="M"
          marginSize={4}
          bgColor="#FFFFFF"
          fgColor="#000000"
          role="img"
          aria-label={`QR code that opens ${joinUrl}`}
          className="h-48 w-48 sm:h-56 sm:w-56"
        />
      </div>
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-steel-blue">
        Scan with your phone camera
      </p>
      {unreachableFromPhones ? (
        <p className="max-w-sm text-center font-body text-xs text-slate">
          Local development: this code points at{" "}
          <span className="font-mono">{hostname}</span>, which a phone can only
          reach on the same network. Set APP_ORIGIN to test scanning.
        </p>
      ) : null}
    </div>
  );
}
