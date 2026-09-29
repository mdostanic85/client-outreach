export default function AppLoading() {
  return (
    <main className="animate-enter mx-auto flex w-full max-w-[1320px] flex-1 flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8 lg:px-12 lg:py-14">
      <header className="border-border space-y-4 border-b pb-8">
        <div className="bg-muted/40 h-3 w-20 animate-pulse rounded" />
        <div className="bg-muted/50 h-9 w-52 max-w-full animate-pulse rounded-lg" />
        <div className="bg-muted/30 h-4 w-80 max-w-full animate-pulse rounded" />
      </header>
      <div className="bg-card border-border h-72 animate-pulse rounded-[18px] border" />
    </main>
  );
}
