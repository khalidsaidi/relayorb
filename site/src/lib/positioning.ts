export const homepagePersonaDescription =
  "Control plane for production AI agents. Versioned tool routing, schema validation, and audit logs for teams operating dozens of agents and tools.";

export const whoItsFor = [
  {
    title: "SRE / platform engineers running production AI agents",
    body: [
      "Your team is operating five or more internal agents that collectively call dozens of tools.",
      "You need schema validation, versioning, and audit logs on every tool call. Ad-hoc wiring breaks at this scale. RelayOrb is the control plane.",
    ],
  },
  {
    title: "Engineering leads accountable for agent reliability",
    body: [
      "You need to know which agent called which tool with which version when something fails.",
      "You need to roll a tool version forward or back without redeploying every agent. RelayOrb gives you that pivot point.",
    ],
  },
  {
    title: "Teams replacing in-house tool routers",
    body: [
      "You built your own gateway between agents and tools because nothing off-the-shelf existed.",
      "Now it's tech debt. RelayOrb replaces it with versioned routing, OIDC-protected endpoints, and observable invocation state.",
    ],
  },
] as const;

export const whoItIsntFor = [
  "Solo developers and small teams. If you're wiring one agent to a handful of tools, ad-hoc wiring is correct. The control-plane overhead isn't worth it until you're managing many-to-many agent-to-tool relationships.",
  "Anyone without production AI agents in flight. RelayOrb solves a problem you don't have yet. Come back when you do.",
  "Hobbyists exploring agent frameworks. Start with the underlying frameworks (LangChain, LlamaIndex, plain MCP). RelayOrb sits one layer up; you'll feel its value only after the layer below is in active use.",
] as const;
