import urllib.request
import urllib.parse
import re
import html

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; Termux) AppleWebKit/537.36 (KHTML, like Gecko)"
}

def search_web(query: str, max_results: int = 5) -> str:
    """Search the web using DuckDuckGo and return titles, URLs, and summaries."""
    try:
        data = urllib.parse.urlencode({"q": query}).encode("utf-8")
        req = urllib.request.Request(
            "https://lite.duckduckgo.com/lite/",
            data=data,
            headers={"User-Agent": "w3m/0.5.3"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read().decode("utf-8", errors="ignore")

        links = re.findall(r'<a[^>]+href=[\'\"]([^\'\"]+)[\'\"][^>]+class=[\'\"]result-link[\'\"][^>]*>(.*?)</a>', content)
        snippets = re.findall(r'<td[^>]+class=[\'\"]result-snippet[\'\"][^>]*>(.*?)</td>', content, re.DOTALL)

        if not links:
            return f"No results found for query: '{query}'"

        results = []
        limit = min(max_results, len(links), len(snippets))
        for i in range(limit):
            url, raw_title = links[i]
            title = re.sub(r'<[^>]+>', '', html.unescape(raw_title)).strip()
            snippet = re.sub(r'<[^>]+>', '', html.unescape(snippets[i])).strip()
            results.append(f"[{i+1}] {title}\nURL: {url}\nSummary: {snippet}\n")

        return f"Found {limit} search results for '{query}':\n\n" + "\n".join(results)
    except Exception as e:
        return f"Web search error: {str(e)}"

def fetch_url(url: str, max_chars: int = 4000) -> str:
    """Fetch content of a web page, stripping tags and formatting text."""
    try:
        req = urllib.request.Request(url, headers=DEFAULT_HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")

        # Strip scripts, styles, comments
        text = re.sub(r'<script[^>]*>.*?</script>', ' ', raw, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<style[^>]*>.*?</style>', ' ', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<!--.*?-->', ' ', text, flags=re.DOTALL)
        # Strip all HTML tags
        text = re.sub(r'<[^>]+>', ' ', text)
        text = html.unescape(text)
        # Condense whitespace
        text = re.sub(r'\s+', ' ', text).strip()

        if len(text) > max_chars:
            text = text[:max_chars] + f"\n... [Truncated, showing first {max_chars} characters]"
        return f"Content of {url}:\n\n{text}"
    except Exception as e:
        return f"Error fetching URL '{url}': {str(e)}"
