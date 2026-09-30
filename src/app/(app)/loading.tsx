export default function AppLoading() {
  return (
    <main className="mx-auto flex w-full max-w-[1290px] flex-1 flex-col gap-6 px-4 pt-4 pb-12 sm:gap-8 sm:px-5 sm:pt-6 lg:px-8 lg:pt-8">
      <header className="space-y-3">
        <div className="bg-card h-8 w-52 max-w-full animate-pulse rounded-full motion-reduce:animate-none" />
        <div className="bg-card h-4 w-80 max-w-full animate-pulse rounded-full motion-reduce:animate-none" />
      </header>
      <div className="bg-card h-72 animate-pulse rounded-card motion-reduce:animate-none" />
    </main>
  );
}
