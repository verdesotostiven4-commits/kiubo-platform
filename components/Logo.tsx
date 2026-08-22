const KIUBO_ICON_URL="https://cdn.phototourl.com/free/2026-08-22-d66f0865-834f-4fad-aba9-d7d2de485042.jpg";

export function KiuboMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-lockup" aria-label="KIUBO">
      <img className="brand-image" src={KIUBO_ICON_URL} alt="" aria-hidden="true" draggable={false}/>
      {!compact && <span className="brand-word">KIUBO</span>}
    </div>
  );
}
