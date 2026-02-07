"""
US RSS Provider
"""

from typing import Dict, Type

from ..base import BaseProvider, BaseFetcher, ProviderInfo
from .fetchers.news import UsRssNewsFetcher


class UsRssProvider(BaseProvider):
    """
    US RSS headlines provider (SEC + common finance RSS feeds).

    This is a "market headlines" provider. It is intentionally simple and deterministic:
    - Fetches configured RSS feeds from `settings.US_RSS_FEEDS`
    - Normalizes each entry to `NewsData`
    """

    @property
    def info(self) -> ProviderInfo:
        return ProviderInfo(
            name="us_rss",
            display_name="US RSS (Headlines)",
            description="US market headlines from configured RSS feeds (SEC + finance news).",
            website="https://www.sec.gov",
            requires_credentials=False,
            priority=1,
        )

    @property
    def fetchers(self) -> Dict[str, Type[BaseFetcher]]:
        return {
            "news": UsRssNewsFetcher,
        }

