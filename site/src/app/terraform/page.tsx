import { CodeBlock } from "@/components/CodeBlock";
import { TrackedLink } from "@/components/TrackedLink";
import { links, terraformDemoSnippet, terraformProdSnippet } from "@/lib/site";

export const metadata = {
  title: "RelayOrb Terraform",
  description: "RelayOrb Terraform module usage for prod and demo.",
};

export default function TerraformPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-20 sm:px-8">
      <section data-analytics-section="terraform_intro">
        <h1 className="text-4xl font-semibold">Deploy with Terraform</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Two Terraform Registry modules are available: production posture and
          anonymous demo posture.
        </p>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2" data-analytics-section="terraform_modules">
        <article className="rounded-2xl border border-indigo-400/30 bg-slate-950/70 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xl font-medium">Prod module</h2>
            <TrackedLink
              href={links.prodModule}
              variant="secondary"
              className="text-xs"
              eventName="cta_click"
              eventParams={{ cta: "open_module_prod", location: "terraform_prod" }}
            >
              Open module
            </TrackedLink>
          </div>
          <CodeBlock
            title="khalidsaidi/relayorb/google"
            code={terraformProdSnippet}
            snippetId="copy_tf_prod"
          />
        </article>

        <article className="rounded-2xl border border-cyan-400/30 bg-slate-950/70 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xl font-medium">Demo module</h2>
            <TrackedLink
              href={links.demoModule}
              variant="secondary"
              className="text-xs"
              eventName="cta_click"
              eventParams={{ cta: "open_module_demo", location: "terraform_demo" }}
            >
              Open module
            </TrackedLink>
          </div>
          <CodeBlock
            title="khalidsaidi/relayorb-demo/google"
            code={terraformDemoSnippet}
            snippetId="copy_tf_demo"
          />
        </article>
      </div>
    </main>
  );
}
