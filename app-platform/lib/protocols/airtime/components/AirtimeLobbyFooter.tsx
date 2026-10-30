import { iconCreditLine } from "../icon-credits";

export function AirtimeLobbyFooter() {
  return (
    <footer className="mx-auto max-w-2xl px-5 pb-8 pt-4">
      <p className="text-center font-body text-[11px] text-slate">{iconCreditLine()}</p>
    </footer>
  );
}
