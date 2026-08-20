export function KiuboMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-lockup" aria-label="KIUBO">
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-eye" />
        <span className="brand-smile">⌣</span>
      </span>
      {!compact && <span className="brand-word">KIUBO</span>}
    </div>
  );
}
