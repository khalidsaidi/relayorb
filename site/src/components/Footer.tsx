import { links } from "@/lib/site";
import { TrackedLink } from "@/components/TrackedLink";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-800/80 bg-slate-950/60">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-3 px-6 py-8 text-sm text-slate-300">
        <span>RelayOrb</span>
        <span className="opacity-50">|</span>
        <TrackedLink
          href={links.github}
          variant="link"
          eventName="outbound_github"
          eventParams={{ label: "footer", location: "footer" }}
        >
          GitHub
        </TrackedLink>
        <span className="opacity-50">|</span>
        <TrackedLink href={links.prodModule} variant="link">
          Terraform prod
        </TrackedLink>
        <span className="opacity-50">|</span>
        <TrackedLink href={links.demoModule} variant="link">
          Terraform demo
        </TrackedLink>
        <span className="opacity-50">|</span>
        <TrackedLink href="/privacy" variant="link">
          Privacy
        </TrackedLink>
      </div>
    </footer>
  );
}
