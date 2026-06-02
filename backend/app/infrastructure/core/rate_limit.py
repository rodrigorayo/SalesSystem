from slowapi import Limiter
from slowapi.util import get_remote_address

# This global limiter will track login attempts using the client IP
limiter = Limiter(key_func=get_remote_address)
