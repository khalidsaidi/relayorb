# Hummingbot Adapter (stub)

Implement an adapter that maps Hummingbot gateway/strategy outputs into the RelayOrb schema.

Suggested flow:
- Subscribe to Hummingbot logs and events.
- Normalize fills/orders to `bots/{botId}/events`.
- Listen for commands and forward to the running instance.
