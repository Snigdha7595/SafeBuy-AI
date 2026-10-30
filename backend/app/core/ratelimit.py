import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


class RateLimiter:
    """In-memory sliding window per client IP. Fine for a single-process MVP; use Redis when scaling out."""

    def __init__(self, max_calls: int, window_seconds: float):
        self.max_calls, self.window = max_calls, window_seconds
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.max_calls:
            raise HTTPException(429, "Too many analysis requests. Wait a minute and try again.",
                                headers={"Retry-After": str(int(self.window))})
        q.append(now)

    def reset(self) -> None:
        self.hits.clear()


analyze_limiter = RateLimiter(max_calls=10, window_seconds=60)


def limit_analyze(request: Request) -> None:
    analyze_limiter.check(request.client.host if request.client else "unknown")
