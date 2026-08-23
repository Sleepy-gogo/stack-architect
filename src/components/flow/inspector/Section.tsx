export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}
