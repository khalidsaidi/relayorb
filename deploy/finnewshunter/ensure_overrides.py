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


def ensure_financial_us_rss_provider() -> None:
    """
    Add a US RSS provider to the *Financial Data Layer* (v2 News API).

    This is separate from the legacy crawler tool. The frontend uses `/api/v1/news/v2/*`
    endpoints which rely on `app/financial/providers/*`.
    """
    src_root = Path("/tmp/overrides/financial/providers/us_rss")
    if not src_root.exists():
        raise FileNotFoundError(f"Missing override provider dir: {src_root}")

    dst_root = ROOT / "app/financial/providers/us_rss"
    (dst_root / "fetchers").mkdir(parents=True, exist_ok=True)

    for rel in [
        "__init__.py",
        "provider.py",
        "fetchers/__init__.py",
        "fetchers/news.py",
    ]:
        src = src_root / rel
        dst = dst_root / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")


def ensure_financial_tools_setup_default_providers() -> None:
    """
    Patch `setup_default_providers()` to honor FINNEWS_MARKET.

    - FINNEWS_MARKET=us: register only `us_rss`
    - else: register the upstream CN providers
    """
    path = ROOT / "app/financial/tools.py"
    text = read(path)
    lines = text.splitlines()

    start = None
    for idx, line in enumerate(lines):
        if line.startswith("def setup_default_providers"):
            start = idx
            break
    if start is None:
        raise ValueError("setup_default_providers not found in financial/tools.py")

    # Find end of function by locating next top-level `def ` after start
    end = len(lines)
    for idx in range(start + 1, len(lines)):
        if lines[idx].startswith("def ") and not lines[idx].startswith("def setup_default_providers"):
            end = idx
            break

    replacement = dedent(
        """
        def setup_default_providers():
            \"\"\"
            Register default Providers.

            This function is called at API import time (e.g. `api/v1/news_v2.py`) to ensure
            the global registry is ready.

            Behavior:
            - FINNEWS_MARKET=us: register only `us_rss`
            - else: register upstream CN providers
            \"\"\"
            from app.core.config import settings
            from .registry import get_registry

            market = (getattr(settings, "FINNEWS_MARKET", "cn") or "cn").lower()
            registry = get_registry()

            # Make initialization deterministic: if this runs more than once, reset the registry.
            registry.clear()

            if market == "us":
                from .providers.us_rss import UsRssProvider

                providers = [("us_rss", UsRssProvider)]
            else:
                from .providers.sina import SinaProvider
                from .providers.tencent import TencentProvider
                from .providers.nbd import NbdProvider
                from .providers.eastmoney import EastmoneyProvider
                from .providers.yicai import YicaiProvider
                from .providers.netease import NeteaseProvider

                providers = [
                    ("sina", SinaProvider),
                    ("tencent", TencentProvider),
                    ("nbd", NbdProvider),
                    ("eastmoney", EastmoneyProvider),
                    ("yicai", YicaiProvider),
                    ("163", NeteaseProvider),
                ]

            for name, provider_class in providers:
                try:
                    registry.register(provider_class())
                    logger.debug(f"Registered provider: {name}")
                except Exception as e:
                    logger.warning(f"Failed to register provider {name}: {e}")

            logger.info(f"Registered {len(registry.list_providers())} providers: {registry.list_providers()}")
        """
    ).strip("\n").splitlines()

    lines[start:end] = replacement
    write(path, "\n".join(lines) + "\n")


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


def ensure_stocks_api_us_market() -> None:
    """
    FinnewsHunter upstream assumes CN tickers (SH/SZ) across the Stocks API.

    RelayOrb runs FINNEWS_MARKET=us, so we:
    - Normalize stock_code as a plain ticker (e.g. BBAI) without SH/SZ prefixing.
    - Ensure targeted crawl upserts a Stock row so the "Stocks" page can list it.
    """
    path = ROOT / "app/api/v1/stocks.py"
    text = read(path)

    if "from ...core.config import settings" not in text:
        text = ensure_insert_after_line(text, "from ...core.database import get_db", "from ...core.config import settings")

    if "def normalize_stock_code(" not in text:
        helper = dedent(
            """


            def normalize_stock_code(stock_code: str) -> tuple[str, str]:
                \"\"\"Normalize stock codes for both CN (SH/SZ) and US (plain tickers).\"\"\"
                code = (stock_code or "").upper().strip()
                market = (getattr(settings, "FINNEWS_MARKET", "cn") or "cn").lower()
                if market == "us":
                    return code, code
                if code.startswith("SH") or code.startswith("SZ"):
                    return code, code[2:]
                short_code = code
                code = f"SH{code}" if code.startswith("6") else f"SZ{code}"
                return code, short_code
            """
        ).rstrip("\n")
        text = ensure_insert_after_line(text, "router = APIRouter()", helper)

    # Replace common "标准化股票代码" blocks with the helper.
    # Pattern A: code only
    text = re.sub(
        r"(\s*# 标准化股票代码\s*\n\s*)code\s*=\s*stock_code\.upper\(\)\s*\n\s*if\s+not\s+\(code\.startswith\(\"SH\"\)\s+or\s+code\.startswith\(\"SZ\"\)\):\s*\n\s*code\s*=\s*f\"SH\{code\}\"\s*if\s*code\.startswith\(\"6\"\)\s*else\s*f\"SZ\{code\}\"",
        r"\1code, _short_code = normalize_stock_code(stock_code)",
        text,
        flags=re.M,
    )

    # Pattern B: code + short_code
    text = re.sub(
        r"(\s*# 标准化股票代码\s*\n\s*)code\s*=\s*stock_code\.upper\(\)\s*\n\s*if\s+code\.startswith\(\"SH\"\)\s+or\s+code\.startswith\(\"SZ\"\):\s*\n\s*short_code\s*=\s*code\[2:\]\s*\n\s*else:\s*\n\s*short_code\s*=\s*code\s*\n\s*code\s*=\s*f\"SH\{code\}\"\s*if\s*code\.startswith\(\"6\"\)\s*else\s*f\"SZ\{code\}\"",
        r"\1code, short_code = normalize_stock_code(stock_code)",
        text,
        flags=re.M,
    )

    # Ensure the US ticker is upserted into the stocks table on targeted crawl start.
    marker = "logger.info(f\"触发定向爬取任务:"
    if "US market: ensure the ticker exists in the stocks table" not in text and marker in text:
        insert = dedent(
            """
            # US market: ensure the ticker exists in the stocks table so the UI can browse it.
            market = (getattr(settings, "FINNEWS_MARKET", "cn") or "cn").lower()
            if market == "us":
                existing_stock = await db.execute(select(Stock).where(Stock.code == code).limit(1))
                if existing_stock.scalar_one_or_none() is None:
                    db.add(Stock(code=code, name=request.stock_name or code, full_code=code, market="US", status="active"))
            """
        ).rstrip("\n")
        # Insert with the same indentation as the logger line inside the handler.
        text = ensure_insert_after_line(text, marker, "        " + insert.replace("\n", "\n        "))

    write(path, text)


def ensure_targeted_stock_crawl_us() -> None:
    """
    Upstream targeted crawl is CN-only (akshare + BochaAI). In US mode it hard-fails with:
      "BochaAI API Key 未配置"

    Replace the targeted crawl task with a deterministic US implementation:
    - SEC EDGAR Atom feed (ticker -> CIK via SEC company_tickers.json)
    - US RSS feeds (settings.US_RSS_FEEDS) filtered by ticker mention
    """
    path = ROOT / "app/tasks/crawl_tasks.py"
    text = read(path)

    if "RelayOrb US targeted crawl helpers" in text:
        return

    replacement = dedent(
        """
        # --- RelayOrb US targeted crawl helpers ---
        _SEC_TICKER_TO_CIK = None
        _SEC_TICKER_TO_CIK_LOADED_AT = None


        def _sec_load_ticker_cik_map():
            \"\"\"Load SEC ticker->CIK map with a lightweight in-process cache.\"\"\"
            global _SEC_TICKER_TO_CIK, _SEC_TICKER_TO_CIK_LOADED_AT
            now = datetime.utcnow()
            if _SEC_TICKER_TO_CIK is not None and _SEC_TICKER_TO_CIK_LOADED_AT and (now - _SEC_TICKER_TO_CIK_LOADED_AT) < timedelta(hours=12):
                return _SEC_TICKER_TO_CIK

            import requests

            url = "https://www.sec.gov/files/company_tickers.json"
            ua = getattr(settings, "SEC_USER_AGENT", None) or "RelayOrb/1.0 (support@relayorb.com)"
            resp = requests.get(url, timeout=20, headers={"User-Agent": ua, "Accept": "application/json"})
            resp.raise_for_status()
            data = resp.json() or {}

            mapping = {}
            for entry in data.values():
                try:
                    ticker = str(entry.get("ticker") or "").strip().upper()
                    cik = str(entry.get("cik_str") or "").strip()
                    if ticker and cik:
                        mapping[ticker] = cik.zfill(10)
                except Exception:
                    continue

            _SEC_TICKER_TO_CIK = mapping
            _SEC_TICKER_TO_CIK_LOADED_AT = now
            return mapping


        def _sec_fetch_company_atom(cik: str):
            \"\"\"Fetch EDGAR Atom entries for a company CIK.\"\"\"
            import requests
            import feedparser
            from dateutil import parser as date_parser

            ua = getattr(settings, "SEC_USER_AGENT", None) or "RelayOrb/1.0 (support@relayorb.com)"
            url = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&count=40&output=atom"
            resp = requests.get(url, timeout=20, headers={"User-Agent": ua, "Accept": "application/atom+xml,application/xml"})
            resp.raise_for_status()

            parsed = feedparser.parse(resp.content)
            out = []
            for entry in (parsed.entries or [])[:40]:
                title = (entry.get("title") or "").strip()
                link = (entry.get("link") or "").strip()
                summary = (entry.get("summary") or entry.get("description") or "").strip()
                published_raw = entry.get("published") or entry.get("updated") or None
                published = None
                if published_raw:
                    try:
                        published = date_parser.parse(published_raw)
                        if getattr(published, "tzinfo", None):
                            published = published.astimezone(tz=None).replace(tzinfo=None)
                    except Exception:
                        published = None

                if title and link:
                    out.append({"title": title, "url": link, "content": summary, "published": published})
            return out


        @celery_app.task(bind=True, name="app.tasks.crawl_tasks.targeted_stock_crawl_task")
        def targeted_stock_crawl_task(
            self,
            stock_code: str,
            stock_name: str,
            days: int = 30,
            task_record_id: int = None
        ):
            \"\"\"
            US targeted crawl (RelayOrb):
            - SEC EDGAR Atom feed (filings)
            - US RSS feeds (headlines)
            \"\"\"
            db = get_sync_db_session()
            task_record = None

            try:
                market = (getattr(settings, "FINNEWS_MARKET", "cn") or "cn").lower()
                if market != "us":
                    raise ValueError("targeted_stock_crawl_task expects FINNEWS_MARKET=us")

                ticker = (stock_code or "").upper().strip()
                if not ticker:
                    raise ValueError("stock_code is required")

                # 1) Get or create task record
                if task_record_id:
                    task_record = db.query(CrawlTask).filter(CrawlTask.id == task_record_id).first()
                    if task_record:
                        task_record.status = TaskStatus.RUNNING
                        task_record.started_at = datetime.utcnow()
                        db.commit()
                        db.refresh(task_record)
                    else:
                        task_record = None

                if not task_record:
                    task_record = CrawlTask(
                        celery_task_id=self.request.id,
                        mode=CrawlMode.TARGETED,
                        status=TaskStatus.RUNNING,
                        source="targeted",
                        config={
                            "stock_code": ticker,
                            "stock_name": stock_name,
                            "days": days,
                        },
                        started_at=datetime.utcnow(),
                    )
                    db.add(task_record)
                    db.commit()
                    db.refresh(task_record)

                # Ensure the stock is present in the stocks table for browsing.
                from ..models.stock import Stock
                existing_stock = db.execute(select(Stock).where(Stock.code == ticker)).scalar_one_or_none()
                if not existing_stock:
                    db.add(Stock(code=ticker, name=stock_name or ticker, full_code=ticker, market="US", status="active"))
                    db.commit()

                logger.info(f"[Task {task_record.id}] 🎯 US targeted crawl: {ticker} ({days}d)")
                start_time = datetime.utcnow()

                all_news = []
                sources = {"sec": 0, "us_rss": 0}

                # 2) SEC filings (best-effort)
                task_record.progress = {"current": 10, "total": 100, "message": "Fetching SEC filings..."}
                db.commit()
                try:
                    m = _sec_load_ticker_cik_map()
                    cik = m.get(ticker)
                    if cik:
                        for entry in _sec_fetch_company_atom(cik):
                            all_news.append(
                                NewsItem(
                                    title=entry["title"],
                                    content=entry.get("content") or "",
                                    url=entry["url"],
                                    source="SEC EDGAR",
                                    publish_time=entry.get("published"),
                                    stock_codes=[ticker],
                                )
                            )
                            sources["sec"] += 1
                except Exception as e:
                    logger.warning(f"[Task {task_record.id}] SEC fetch failed: {e}")

                # 3) RSS headlines filtered by ticker
                task_record.progress = {"current": 35, "total": 100, "message": "Fetching RSS headlines..."}
                db.commit()
                try:
                    import re
                    from ..tools.us_rss_crawler import UsRssCrawlerTool

                    patt = re.compile(rf"\\b{re.escape(ticker)}\\b", re.IGNORECASE)
                    rss_items = UsRssCrawlerTool().crawl()
                    for item in rss_items or []:
                        text = f"{item.title} {item.content or ''}"
                        if patt.search(text):
                            all_news.append(
                                NewsItem(
                                    title=item.title,
                                    content=item.content or "",
                                    url=item.url,
                                    source=item.source or "us_rss",
                                    publish_time=item.publish_time,
                                    stock_codes=[ticker],
                                )
                            )
                            sources["us_rss"] += 1
                except Exception as e:
                    logger.warning(f"[Task {task_record.id}] RSS fetch failed: {e}")

                # 4) Save (dedupe by URL)
                task_record.progress = {"current": 70, "total": 100, "message": "Saving items..."}
                db.commit()

                saved_count = 0
                duplicate_count = 0
                for news_item in all_news:
                    existing = db.execute(select(News).where(News.url == news_item.url)).scalar_one_or_none()
                    if existing:
                        duplicate_count += 1
                        if existing.stock_codes is None:
                            existing.stock_codes = []
                        if ticker not in existing.stock_codes:
                            existing.stock_codes = existing.stock_codes + [ticker]
                            db.commit()
                        continue

                    news = News(
                        title=clean_text_for_db(news_item.title),
                        content=clean_text_for_db(news_item.content),
                        raw_html=clean_text_for_db(news_item.raw_html),
                        url=clean_text_for_db(news_item.url),
                        source=clean_text_for_db(news_item.source),
                        publish_time=news_item.publish_time,
                        author=clean_text_for_db(news_item.author),
                        keywords=news_item.keywords,
                        stock_codes=news_item.stock_codes or [ticker],
                    )
                    db.add(news)
                    saved_count += 1

                db.commit()

                end_time = datetime.utcnow()
                execution_time = (end_time - start_time).total_seconds()

                task_record.status = TaskStatus.COMPLETED
                task_record.completed_at = end_time
                task_record.execution_time = execution_time
                task_record.crawled_count = len(all_news)
                task_record.saved_count = saved_count
                task_record.result = {
                    "stock_code": ticker,
                    "stock_name": stock_name,
                    "total_found": len(all_news),
                    "saved": saved_count,
                    "duplicates": duplicate_count,
                    "sources": sources,
                }
                task_record.progress = {"current": 100, "total": 100, "message": f\"Done: +{saved_count} new items\"}
                db.commit()

                return {
                    "task_id": task_record.id,
                    "status": "completed",
                    "stock_code": ticker,
                    "crawled": len(all_news),
                    "saved": saved_count,
                    "duplicates": duplicate_count,
                    "execution_time": execution_time,
                    "timestamp": datetime.utcnow().isoformat(),
                }

            except Exception as e:
                logger.error(f\"[Task {task_record.id if task_record else 'unknown'}] US targeted crawl failed: {e}\", exc_info=True)
                if task_record:
                    task_record.status = TaskStatus.FAILED
                    task_record.completed_at = datetime.utcnow()
                    task_record.error_message = str(e)[:1000]
                    task_record.progress = {"current": 0, "total": 100, "message": f\"Failed: {str(e)[:100]}\"}
                    db.commit()
                raise
            finally:
                db.close()
        """
    ).strip("\n")

    pattern = re.compile(
        r"@celery_app\\.task\\(bind=True, name=\"app\\.tasks\\.crawl_tasks\\.targeted_stock_crawl_task\"\\)\\n"
        r"def targeted_stock_crawl_task\\(.*?\\n"
        r"@celery_app\\.task\\(bind=True, name=\"app\\.tasks\\.crawl_tasks\\.build_knowledge_graph_task\"\\)",
        re.S,
    )
    m = pattern.search(text)
    if not m:
        raise ValueError("Failed to locate targeted_stock_crawl_task block for replacement")

    # Keep the build_knowledge_graph_task decorator line (and whatever follows) intact.
    text = pattern.sub(replacement + "\n\n@celery_app.task(bind=True, name=\"app.tasks.crawl_tasks.build_knowledge_graph_task\")", text, count=1)
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
    ensure_financial_us_rss_provider()
    ensure_financial_tools_setup_default_providers()
    ensure_crawl_tasks()
    ensure_celery_schedule()
    ensure_news_api()
    ensure_embeddings_disabled()
    ensure_vector_storage()
    ensure_init_stocks()
    ensure_stocks_api_us_market()
    ensure_targeted_stock_crawl_us()
    ensure_requirements()


if __name__ == "__main__":
    main()
