from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from abc import ABC, abstractmethod
import socket

# Prioritize IPv4 over IPv6 to avoid Termux/Android DNS & socket connection timeouts
try:
    _orig_getaddrinfo = socket.getaddrinfo
    def _ipv4_first_getaddrinfo(*args, **kwargs):
        res = _orig_getaddrinfo(*args, **kwargs)
        return sorted(res, key=lambda x: 0 if x[0] == socket.AF_INET else 1)
    socket.getaddrinfo = _ipv4_first_getaddrinfo
except Exception:
    pass


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: Dict[str, Any]
    thought_signature: Optional[str] = None
    raw_part: Optional[Dict[str, Any]] = None

@dataclass
class ProviderResponse:
    text: Optional[str] = None
    tool_calls: List[ToolCall] = field(default_factory=list)
    raw_response: Optional[Dict[str, Any]] = None

class BaseProvider(ABC):
    def __init__(self, api_key: str, model: str, temperature: float = 0.3, max_tokens: int = 700):
        self.api_key = api_key
        self.model = model
        self.temperature = float(temperature)
        self.max_tokens = int(max_tokens)

    @abstractmethod
    def generate(self, messages: List[Dict[str, Any]], system_prompt: str) -> ProviderResponse:
        """Send chat messages and return ProviderResponse with text and/or tool_calls."""
        pass

