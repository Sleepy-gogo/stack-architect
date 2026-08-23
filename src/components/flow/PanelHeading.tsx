export function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="px-1.5 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
      {children}
    </h3>
  )
}
