from datetime import datetime, timedelta, timezone

# Bolivia (La Paz) is UTC-4:00 (No Daylight Saving Time)
BOLIVIA_TZ = timezone(timedelta(hours=-4))

def now_bolivia() -> datetime:
    """Returns CURRENT time in Bolivia."""
    return datetime.now(BOLIVIA_TZ)

def bolivia_to_utc(dt: datetime) -> datetime:
    """Converts a Bolivia-local datetime (naive or aware) to UTC."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=BOLIVIA_TZ)
    return dt.astimezone(timezone.utc)

def utc_to_bolivia(dt: datetime) -> datetime:
    """Converts a UTC datetime to Bolivia local time."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(BOLIVIA_TZ)

def get_day_range_bolivia(date_str: str) -> tuple[datetime, datetime]:
    """
    Given a YYYY-MM-DD string, returns the (start_utc, end_utc) 
    that matches that entire calendar day in Bolivia time.
    """
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    
    # 00:00:00 Bolivia Local
    start_local = dt.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=BOLIVIA_TZ)
    # 23:59:59.999 Bolivia Local
    end_local = dt.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=BOLIVIA_TZ)
    
    # Convert both to UTC for MongoDB queries
    return (start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc))

def get_range_bolivia(start_str: str, end_str: str) -> tuple[datetime, datetime]:
    """
    Given two YYYY-MM-DD strings, returns the (start_utc, end_utc)
    covering the entire period.
    """
    s_dt = datetime.strptime(start_str, "%Y-%m-%d")
    e_dt = datetime.strptime(end_str, "%Y-%m-%d")
    
    start_local = s_dt.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=BOLIVIA_TZ)
    end_local = e_dt.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=BOLIVIA_TZ)
    
    return (start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc))

# Aliases for better DX and backward compatibility
get_now_bolivia = now_bolivia
convert_to_bolivia = utc_to_bolivia
