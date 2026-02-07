"""
US RSS Provider

Provides:
- news: US RSS headlines (SEC + finance RSS feeds)

This is used by the v2 Financial News API (`/api/v1/news/v2/*`) via the Provider Registry.
"""

from .provider import UsRssProvider

__all__ = ["UsRssProvider"]

