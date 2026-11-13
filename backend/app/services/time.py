from datetime import date, datetime, timedelta, timezone

# Nepal has no daylight saving time, so a fixed offset is exact (and needs no tzdata package on Windows).
KATHMANDU = timezone(timedelta(hours=5, minutes=45))


def kathmandu_today() -> date:
    return datetime.now(KATHMANDU).date()
