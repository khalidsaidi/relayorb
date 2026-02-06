type BrokerAccountKey = "acct1" | "acct2" | "acct3"
type AssetClass = "stock" | "crypto" | "forex" | string

export const BROKER_UID_MAP: Record<BrokerAccountKey, string> = {
  acct1: "enEopK5vNkMWZrXJAllC9bX4cgu1",
  acct2: "TpMgVF4dkfRoiiGPsntwHNdnQpd2",
  acct3: "hhGFeCQGuwR32Jtswzik0k2v9rU2",
}

const BROKER_UID_LOOKUP: Record<string, BrokerAccountKey> = {
  [BROKER_UID_MAP.acct1]: "acct1",
  [BROKER_UID_MAP.acct2]: "acct2",
  [BROKER_UID_MAP.acct3]: "acct3",
}

export function getBrokerAccountKeyForUid(uid?: string | null): BrokerAccountKey | null {
  if (!uid) return null
  return BROKER_UID_LOOKUP[uid] ?? null
}

export function buildAssetKey(assetClass: AssetClass, symbol: string) {
  return `${assetClass}:${symbol.toUpperCase()}`
}

export function normalizeSymbolForId(symbol: string) {
  return symbol.toUpperCase().replace(/[\\/]/g, "_")
}

export function buildTradeProposalId(
  brokerAccountKey: BrokerAccountKey,
  assetClass: AssetClass,
  symbol: string
) {
  const safeSymbol = normalizeSymbolForId(symbol)
  return `${brokerAccountKey}_${assetClass}_${safeSymbol}`
}
