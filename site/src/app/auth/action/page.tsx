"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EmailActionHandler } from "./email-action-handler";

function EmailActionContent() {
  const params = useSearchParams();
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-5 py-16">
      <EmailActionHandler mode={params.get("mode") ?? ""} oobCode={params.get("oobCode") ?? ""} />
    </main>
  );
}

export default function EmailActionPage() {
  return (
    <Suspense fallback={<main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-5 py-16">Checking your link…</main>}>
      <EmailActionContent />
    </Suspense>
  );
}
