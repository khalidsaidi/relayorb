import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
import { useTranslation } from "react-i18next"
import { resolveOpenbbApiUrl } from "@/lib/runtime-urls"

export default function OpenbbPage() {
  const { t } = useTranslation()
  const apiUrl = useMemo(() => resolveOpenbbApiUrl(), [])
  const docsUrl = apiUrl ? `${apiUrl}/docs` : ""

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("openbb.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>{t("openbb.subtitle")}</div>
          <div className="rounded-lg border bg-muted/40 p-3 text-xs">
            {apiUrl ? apiUrl : t("openbb.notConfigured")}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!docsUrl}
              onClick={() => window.open(docsUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("openbb.openDocs")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!apiUrl}
              onClick={() => window.open(apiUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("openbb.openApi")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {docsUrl ? (
        <Card className="h-[75vh] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("openbb.docsTitle")}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(docsUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("openbb.openInNew")}
            </Button>
          </CardHeader>
          <CardContent className="h-[calc(75vh-64px)] p-0">
            <iframe
              title="OpenBB API Docs"
              src={docsUrl}
              className="h-full w-full border-0"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
