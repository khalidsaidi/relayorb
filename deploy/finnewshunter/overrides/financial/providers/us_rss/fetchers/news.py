"""
US RSS News Fetcher

Implements the Provider TET pipeline:
- Transform Query: choose feeds, apply limit and user filters
- Extract Data: fetch and parse RSS entries
- Transform Data: normalize to `NewsData`
"""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import feedparser
import requests
from dateutil import parser as date_parser

from ...base import BaseFetcher
from ....models.news import NewsQueryParams, NewsData, NewsSentiment
from app.core.config import settings

logger = logging.getLogger(__name__)


class UsRssNewsFetcher(BaseFetcher):
    """
    Fetch US market headlines from configured RSS feeds.
    """

    query_model = NewsQueryParams
    data_model = NewsData

    HEADERS = {
        "User-Agent": "RelayOrb/1.0 (support@relayorb.com)",
        "Accept": "application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    def transform_query(self, params: NewsQueryParams) -> Dict[str, Any]:
        feeds = [f.strip() for f in (getattr(settings, "US_RSS_FEEDS", "") or "").split(",") if f.strip()]
        return {
            "feeds": feeds,
            "limit": int(params.limit or 50),
            "keywords": params.keywords,
            "stock_codes": params.stock_codes,
        }

    async def extract_data(self, query: Dict[str, Any]) -> List[Dict[str, Any]]:
        # `requests` + `feedparser` are sync; run them off the event loop.
        return await asyncio.to_thread(self._extract_sync, query)

    def transform_data(self, raw_data: List[Dict[str, Any]], params: NewsQueryParams) -> List[NewsData]:
        out: List[NewsData] = []
        keywords = [k.strip().lower() for k in (params.keywords or []) if k and k.strip()]
        stock_codes = [s.strip().upper() for s in (params.stock_codes or []) if s and s.strip()]

        for item in raw_data or []:
            title = (item.get("title") or "").strip()
            url = (item.get("url") or "").strip()
            content = (item.get("content") or "").strip()
            if not title or not url:
                continue

            text = f"{title}\n{content}".lower()

            if keywords and not any(k in text for k in keywords):
                continue

            # If the caller filters by stock codes, match against title/content (case-insensitive).
            if stock_codes and not any(code.lower() in text for code in stock_codes):
                continue

            publish_time = self._parse_publish_time(item.get("published"))
            source = (item.get("source") or "").strip() or urlparse(url).netloc
            extracted = self._extract_tickers(title + " " + content)

            out.append(
                NewsData(
                    id=NewsData.generate_id(url),
                    title=title,
                    content=content,
                    source=source,
                    source_url=url,
                    publish_time=publish_time,
                    stock_codes=extracted,
                    sentiment=NewsSentiment.NEUTRAL,
                    extra={
                        "provider": "us_rss",
                        "feed_url": item.get("feed_url"),
                        "raw_published": item.get("published_raw"),
                    },
                )
            )

            if params.limit and len(out) >= params.limit:
                break

        return out

    def _extract_sync(self, query: Dict[str, Any]) -> List[Dict[str, Any]]:
        feeds: List[str] = query.get("feeds") or []
        limit = int(query.get("limit") or 50)
        if not feeds:
            logger.warning("[us_rss] No US_RSS_FEEDS configured; returning empty set.")
            return []

        items: List[Dict[str, Any]] = []
        per_feed_limit = min(50, max(10, limit))

        for feed_url in feeds:
            try:
                resp = requests.get(feed_url, timeout=12, headers=self.HEADERS)
                resp.raise_for_status()

                parsed = feedparser.parse(resp.content)
                feed_title = parsed.feed.get("title") if hasattr(parsed, "feed") else None
                source = feed_title or urlparse(feed_url).netloc

                for entry in (parsed.entries or [])[:per_feed_limit]:
                    title = (entry.get("title") or "").strip()
                    link = (entry.get("link") or entry.get("id") or "").strip()
                    if not title or not link:
                        continue

                    summary = (entry.get("summary") or entry.get("description") or "").strip()
                    published_raw = entry.get("published") or entry.get("updated") or None

                    items.append(
                        {
                            "title": title,
                            "url": link,
                            "content": summary,
                            "published_raw": published_raw,
                            "published": published_raw,
                            "source": source,
                            "feed_url": feed_url,
                        }
                    )
            except Exception as e:
                logger.warning(f"[us_rss] Failed to fetch/parse feed {feed_url}: {e}")

            if len(items) >= limit:
                break

        return items[:limit]

    def _parse_publish_time(self, published: Optional[str]) -> datetime:
        if not published:
            return datetime.utcnow()
        try:
            parsed_dt = date_parser.parse(published)
            if parsed_dt.tzinfo:
                parsed_dt = parsed_dt.astimezone(timezone.utc).replace(tzinfo=None)
            return parsed_dt
        except Exception:
            return datetime.utcnow()

    def _extract_tickers(self, text: str) -> List[str]:
        """
        Best-effort extraction for US tickers from headlines.
        We intentionally avoid naive `\\b[A-Z]{1,5}\\b` matching because it produces too many false positives.
        """
        tickers: set[str] = set()
        for m in re.finditer(r"\\$([A-Z]{1,5})\\b", text):
            tickers.add(m.group(1))
        for m in re.finditer(r"\\(([A-Z]{1,5})\\)", text):
            tickers.add(m.group(1))
        for m in re.finditer(r"\\b(?:NASDAQ|NYSE|AMEX)[:\\s]+([A-Z]{1,5})\\b", text, re.IGNORECASE):
            tickers.add(m.group(1).upper())
        return sorted(tickers)

