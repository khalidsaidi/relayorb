#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path
from textwrap import dedent

ROOT = Path("/app/backend")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def ensure_insert_after_line(text: str, marker: str, insertion: str) -> str:
    if insertion.strip() in text:
        return text
    lines = text.splitlines()
    for idx, line in enumerate(lines):
        if marker in line:
            lines.insert(idx + 1, insertion.rstrip("\n"))
            return "\n".join(lines) + "\n"
    raise ValueError(f"Marker not found: {marker}")


def ensure_replace(text: str, pattern: str, repl: str, flags: int = 0) -> str:
    if re.search(pattern, text, flags):
        return re.sub(pattern, repl, text, flags=flags)
    return text


def ensure_config_settings() -> None:
    path = ROOT / "app/core/config.py"
    text = read(path)
    insertion_block = dedent(
        """
        # 市场范围配置
        FINNEWS_MARKET: str = Field(default="cn", description="市场范围（cn/us）")
        FINNEWS_DISABLE_EMBEDDINGS: bool = Field(default=False, description="禁用 embedding 以降低依赖")
        FINNEWS_DISABLE_MILVUS: bool = Field(default=False, description="禁用 Milvus 向量存储")
        US_RSS_FEEDS: str = Field(
            default=(
                "https://www.cnbc.com/id/100003114/device/rss/rss.html,"
                "https://feeds.marketwatch.com/marketwatch/topstories/,"
                "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US,"
                "https://feeds.finance.yahoo.com/rss/2.0/headline?s=SPY&region=US&lang=en-US"
            ),
            description="US market RSS feeds (comma-separated)",
        )
        CRAWL_INTERVAL_US: int = Field(default=120, description="US RSS 爬取间隔（秒）")
        """
    ).strip("\n")

    lines = text.splitlines()

    # Remove previously injected block (regardless of indentation)
    start_idx = None
    end_idx = None
    for idx, line in enumerate(lines):
        if "# 市场范围配置" in line:
            start_idx = idx
        if start_idx is not None and "CRAWL_INTERVAL_US" in line:
            end_idx = idx
            break
    if start_idx is not None and end_idx is not None:
        del lines[start_idx : end_idx + 1]

    # Determine insertion indentation
    indent = ""
    marker = "FRONTEND_REFETCH_INTERVAL"
    insert_at = None
    for idx, line in enumerate(lines):
        if marker in line:
            indent = line[: len(line) - len(line.lstrip())]
            insert_at = idx + 1
            break
    if insert_at is None:
        marker = "model_config = SettingsConfigDict"
        for idx, line in enumerate(lines):
            if marker in line:
                indent = line[: len(line) - len(line.lstrip())]
                insert_at = idx
                break
    if insert_at is None:
        insert_at = len(lines)

    block_lines = [(indent + line if line else "") for line in insertion_block.splitlines()]
    lines[insert_at:insert_at] = block_lines
    text = "\n".join(lines) + "\n"
    write(path, text)


def ensure_tools_init() -> None:
    path = ROOT / "app/tools/__init__.py"
    text = read(path)
    if "UsRssCrawlerTool" not in text:
        text = ensure_insert_after_line(text, "from .eastmoney_crawler import EastmoneyCrawlerTool", "from .us_rss_crawler import UsRssCrawlerTool")
        # __all__ list
        if "__all__" in text and "UsRssCrawlerTool" not in text:
            text = ensure_insert_after_line(text, "\"EastmoneyCrawlerTool\"", "    \"UsRssCrawlerTool\",")
    write(path, text)


def ensure_us_rss_crawler() -> None:
    target = ROOT / "app/tools/us_rss_crawler.py"
    if target.exists():
        return
    source = Path("/tmp/overrides/us_rss_crawler.py")
    target.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")


def ensure_crawl_tasks() -> None:
    path = ROOT / "app/tasks/crawl_tasks.py"
    text = read(path)
    if "UsRssCrawlerTool" not in text:
        text = ensure_insert_after_line(text, "EastmoneyCrawlerTool,", "    UsRssCrawlerTool,")
    if '"us_rss"' not in text:
        text = ensure_insert_after_line(text, '"eastmoney": EastmoneyCrawlerTool,', '        "us_rss": UsRssCrawlerTool,')
    if 'CRAWL_INTERVAL_US' not in text:
        text = ensure_insert_after_line(text, '"eastmoney": 60,  # 东方财富', '                    "us_rss": settings.CRAWL_INTERVAL_US,')
    write(path, text)


def ensure_celery_schedule() -> None:
    path = ROOT / "app/core/celery_app.py"
    text = read(path)
    if "FINNEWS_MARKET" in text and "beat_schedule =" in text and "crawl-us-rss" in text:
        return

    conf_marker = "celery_app.conf.update("
    idx = text.find(conf_marker)
    if idx == -1:
        raise ValueError("celery_app.conf.update not found")

    # find beat_schedule dictionary inside conf.update
    bs_idx = text.find("beat_schedule", idx)
    if bs_idx == -1:
        raise ValueError("beat_schedule not found in celery_app.conf.update")

    brace_start = text.find("{", bs_idx)
    if brace_start == -1:
        raise ValueError("beat_schedule dict not found")

    # find matching brace
    depth = 0
    end = brace_start
    while end < len(text):
        ch = text[end]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                break
        end += 1
    if depth != 0:
        raise ValueError("unbalanced beat_schedule dict")

    beat_body = text[brace_start:end + 1]

    # remove existing beat_schedule block inside update
    after_idx = end + 1
    if after_idx < len(text) and text[after_idx] == ',':
        after_idx += 1
    replacement_indent = re.search(r"(^[ \t]*)beat_schedule", text[bs_idx:], re.M)
    indent = replacement_indent.group(1) if replacement_indent else "    "
    text = text[:bs_idx] + f"{indent}beat_schedule=beat_schedule," + text[after_idx:]

    # build conditional schedule
    beat_lines = dedent(beat_body).strip().splitlines()
    beat_lines[0] = "beat_schedule = " + beat_lines[0]
    beat_lines = ["    " + line for line in beat_lines]
    cn_schedule = "\n".join(beat_lines)

    us_schedule = dedent(
        """
        beat_schedule = {
            "crawl-us-rss-every-2min": {
                "task": "app.tasks.crawl_tasks.realtime_crawl_task",
                "schedule": crontab(minute="*/2"),
                "args": ("us_rss",),
            }
        }
        """
    ).strip().splitlines()
    us_schedule = "\n".join(["    " + line for line in us_schedule])

    schedule_block = (
        "# 根据市场配置调度\n"
        "market = (settings.FINNEWS_MARKET or \"cn\").lower()\n"
        "if market == \"us\":\n"
        f"{us_schedule}\n"
        "else:\n"
        f"{cn_schedule}\n\n"
    )

    text = text.replace(conf_marker, schedule_block + conf_marker, 1)
    write(path, text)


def ensure_news_api() -> None:
    path = ROOT / "app/api/v1/news.py"
    text = read(path)
    if "UsRssCrawlerTool" not in text:
        text = text.replace("from ...tools import SinaCrawlerTool", "from ...tools import SinaCrawlerTool, UsRssCrawlerTool")
    if "us_rss" not in text:
        text = text.replace(
            "source: str = Field(default=\"sina\", description=\"新闻源（sina, jrj, cnstock）\")",
            "source: str = Field(default=\"sina\", description=\"新闻源（sina, us_rss 等）\")",
        )
        text = text.replace(
            "if source == \"sina\":\n        crawler = SinaCrawlerTool()\n    else:\n        logger.error(f\"Unsupported source: {source}\")\n        return",
            "if source == \"sina\":\n        crawler = SinaCrawlerTool()\n    elif source == \"us_rss\":\n        crawler = UsRssCrawlerTool()\n    else:\n        logger.error(f\"Unsupported source: {source}\")\n        return",
        )
    write(path, text)


def ensure_embeddings_disabled() -> None:
    path = ROOT / "app/services/embedding_service.py"
    text = read(path)
    if "FINNEWS_DISABLE_EMBEDDINGS" not in text:
        insert = dedent(
            """
            self.disabled = bool(settings.FINNEWS_DISABLE_EMBEDDINGS)
            if self.disabled:
                logger.warning("Embeddings disabled by FINNEWS_DISABLE_EMBEDDINGS")
                self.enable_cache = False
                self.provider_instance = None
                return
            """
        ).rstrip("\n")
        marker = "self.base_url = base_url or settings.EMBEDDING_BASE_URL"
        text = ensure_insert_after_line(text, marker, "        " + insert.replace("\n", "\n        "))
    if "if self.disabled" not in text:
        text = text.replace("# 检查缓存", "if self.disabled:\n            return []\n\n        # 检查缓存", 1)
        text = text.replace("# 检查缓存", "if self.disabled:\n            return []\n\n        # 检查缓存", 1)
        text = text.replace("if not texts:\n            return []", "if not texts:\n            return []\n\n        if self.disabled:\n            return [[] for _ in texts]", 1)
    write(path, text)


def ensure_vector_storage() -> None:
    path = ROOT / "app/storage/vector_storage.py"
    text = read(path)
    if "class NullVectorStorage" not in text:
        insert = dedent(
            """


            class NullVectorStorage:
                \"\"\"No-op vector storage when Milvus is disabled.\"\"\"

                def connect(self):
                    return None

                def create_collection(self, drop_existing: bool = False):
                    return None

                def load_collection(self):
                    return None

                def store_embedding(self, news_id: int, embedding, text: str) -> int:
                    return news_id

                def store_embeddings_batch(self, news_ids, embeddings, texts):
                    return news_ids

                def search_similar(self, query_embedding, top_k: int = 10, filter_expr=None):
                    return []

                def delete_by_news_id(self, news_id: int):
                    return None

                def status(self):
                    return {"vector_count": 0, "collection": "disabled", "dim": 0}
            """
        ).rstrip("\n")
        text = text.replace("logger = logging.getLogger(__name__)", "logger = logging.getLogger(__name__)" + insert)
    if "FINNEWS_DISABLE_MILVUS" in text:
        write(path, text)
        return
    pattern = re.compile(r"if _vector_storage is None:\n(\s+)_vector_storage = VectorStorage\(\)")
    match = pattern.search(text)
    if match:
        indent = match.group(1)
        replacement = (
            "if _vector_storage is None:\n"
            f"{indent}if settings.FINNEWS_DISABLE_MILVUS:\n"
            f"{indent}    logger.warning(\"Milvus disabled by FINNEWS_DISABLE_MILVUS\")\n"
            f"{indent}    _vector_storage = NullVectorStorage()\n"
            f"{indent}else:\n"
            f"{indent}    _vector_storage = VectorStorage()"
        )
        text = pattern.sub(replacement, text)
    write(path, text)


def ensure_init_stocks() -> None:
    path = ROOT / "app/scripts/init_stocks.py"
    text = read(path)
    if "market_mode" not in text:
        text = ensure_insert_after_line(text, "logger = logging.getLogger(__name__)", "market_mode = os.getenv(\"FINNEWS_MARKET\", \"cn\").lower()")

    if "US market mode" not in text:
        pattern = re.compile(r"# 导入依赖\ntry:.*?exit\(1\)", re.S)
        replacement = dedent(
            """
            # 导入依赖
            if market_mode == "us":
                AKSHARE_AVAILABLE = False
                logger.info("US market mode: skipping akshare")
            else:
                try:
                    import akshare as ak
                    import pandas as pd
                    AKSHARE_AVAILABLE = True
                    logger.info("akshare loaded successfully")
                except ImportError:
                    AKSHARE_AVAILABLE = False
                    logger.error("akshare not installed! Run: pip install akshare")
                    exit(1)
            """
        ).strip("\n")
        text, count = pattern.subn(replacement, text)

    if "get_us_fallback_stocks" not in text:
        insert = dedent(
            """

            def get_us_fallback_stocks() -> list:
                \"\"\"US fallback list used when FINNEWS_MARKET=us.\"\"\"
                return [
                    {"code": "AAPL", "name": "Apple Inc", "full_code": "AAPL", "market": "US", "status": "active"},
                    {"code": "MSFT", "name": "Microsoft Corp", "full_code": "MSFT", "market": "US", "status": "active"},
                    {"code": "AMZN", "name": "Amazon.com Inc", "full_code": "AMZN", "market": "US", "status": "active"},
                    {"code": "NVDA", "name": "NVIDIA Corp", "full_code": "NVDA", "market": "US", "status": "active"},
                    {"code": "GOOGL", "name": "Alphabet Inc", "full_code": "GOOGL", "market": "US", "status": "active"},
                    {"code": "META", "name": "Meta Platforms", "full_code": "META", "market": "US", "status": "active"},
                    {"code": "TSLA", "name": "Tesla Inc", "full_code": "TSLA", "market": "US", "status": "active"},
                    {"code": "JPM", "name": "JPMorgan Chase", "full_code": "JPM", "market": "US", "status": "active"},
                    {"code": "BAC", "name": "Bank of America", "full_code": "BAC", "market": "US", "status": "active"},
                    {"code": "SPY", "name": "SPDR S&P 500 ETF", "full_code": "SPY", "market": "US", "status": "active"},
                ]
            """
        ).rstrip("\n")
        if "async def fetch_all_stocks" in text:
            text = text.replace("async def fetch_all_stocks", insert + "\n\nasync def fetch_all_stocks", 1)
        else:
            text = text + insert

    if "FINNEWS_MARKET" not in text or "get_us_fallback_stocks" not in text:
        pass

    if "if market_mode == \"us\":\n        return get_us_fallback_stocks()" not in text and "async def fetch_all_stocks" in text:
        text = text.replace("async def fetch_all_stocks() -> list:\n    \"\"\"从 akshare 获取全部 A 股信息\"\"\"", "async def fetch_all_stocks() -> list:\n    \"\"\"从 akshare 获取全部 A 股信息\"\"\"\n    if market_mode == \"us\":\n        return get_us_fallback_stocks()", 1)

    if "market_mode == \"us\" and not stocks_data" not in text:
        text = text.replace(
            "stocks_data = get_fallback_stocks()",
            "stocks_data = get_fallback_stocks()\n\n    if market_mode == \"us\" and not stocks_data:\n        stocks_data = get_us_fallback_stocks()",
            1,
        )

    write(path, text)


def ensure_requirements() -> None:
    path = ROOT / "requirements.txt"
    text = read(path)
    if "feedparser" not in text:
        text = text.rstrip("\n") + "\nfeedparser>=6.0.11\n"
        write(path, text)


def main():
    ensure_config_settings()
    ensure_tools_init()
    ensure_us_rss_crawler()
    ensure_crawl_tasks()
    ensure_celery_schedule()
    ensure_news_api()
    ensure_embeddings_disabled()
    ensure_vector_storage()
    ensure_init_stocks()
    ensure_requirements()


if __name__ == "__main__":
    main()
