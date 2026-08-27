import { KIUBO_ICON_URL } from "@/lib/kiubo-brand-assets";

export function KiuboMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-lockup" aria-label="KIUBO">
      <img className="brand-image" src={KIUBO_ICON_URL} alt="" aria-hidden="true" draggable={false}/>
      {!compact && <span className="brand-word">KIUBO</span>}
    </div>
  );
}
