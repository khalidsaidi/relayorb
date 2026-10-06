import Link from "next/link";
import { NotFoundTracker } from "@/components/NotFoundTracker";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-16 pb-24 text-slate-100 sm:px-8">
      <NotFoundTracker />
      <h1 className="text-3xl font-semibold sm:text-5xl">Page not found</h1>
      <p className="mt-4 text-slate-300">
        That page doesn&apos;t exist. Try the <Link className="text-cyan-200" href="/">home page</Link>,
        the <Link className="text-cyan-200" href="/docs">docs</Link>, or the{" "}
        <Link className="text-cyan-200" href="/guides">guides</Link>.
      </p>
    </main>
  );
}
