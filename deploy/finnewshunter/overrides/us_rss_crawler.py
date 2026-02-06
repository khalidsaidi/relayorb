"""
US RSS crawler tool
"""
import logging
from datetime import datetime, timezone
from typing import List
from urllib.parse import urlparse

import feedparser
import requests
from dateutil import parser as date_parser

from .crawler_base import BaseCrawler, NewsItem
from ..core.config import settings

logger = logging.getLogger(__name__)


class UsRssCrawlerTool(BaseCrawler):
    """Fetch US market headlines from configured RSS feeds."""

    def __init__(self):
        super().__init__(name="us_rss", description="US RSS financial news crawler")

    def crawl(self, start_page: int = 1, end_page: int = 1) -> List[NewsItem]:
        feeds = [f.strip() for f in settings.US_RSS_FEEDS.split(",") if f.strip()]
        if not feeds:
            logger.warning("No US_RSS_FEEDS configured")
            return []

        items: List[NewsItem] = []
        for feed_url in feeds:
            try:
                response = requests.get(
                    feed_url,
                    timeout=12,
                    headers={
                        "User-Agent": "RelayOrb/1.0 (support@relayorb.com)",
                        "Accept": "application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
                    },
                )
                response.raise_for_status()
                parsed = feedparser.parse(response.content)
                feed_title = parsed.feed.get("title") if hasattr(parsed, "feed") else None
                source = feed_title or urlparse(feed_url).netloc
                for entry in parsed.entries[:50]:
                    title = (entry.get("title") or "").strip()
                    link = entry.get("link") or entry.get("id") or ""
                    if not title or not link:
                        continue
                    summary = entry.get("summary") or entry.get("description") or ""
                    published = entry.get("published") or entry.get("updated")
                    publish_time = None
                    if published:
                        try:
                            parsed_dt = date_parser.parse(published)
                            if parsed_dt.tzinfo:
                                parsed_dt = parsed_dt.astimezone(timezone.utc).replace(tzinfo=None)
                            publish_time = parsed_dt
                        except Exception:
                            publish_time = None
                    if publish_time is None:
                        publish_time = datetime.utcnow()
                    items.append(
                        NewsItem(
                            title=title,
                            content=summary,
                            url=link,
                            source=source,
                            publish_time=publish_time,
                        )
                    )
            except Exception as e:
                logger.warning(f"Failed to parse RSS feed {feed_url}: {e}")

        logger.info(f"US RSS crawler fetched {len(items)} items")
        return items


if __name__ == "__main__":
    crawler = UsRssCrawlerTool()
    news = crawler.crawl()
    print(f"Fetched {len(news)} RSS items")
