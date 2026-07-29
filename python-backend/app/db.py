from contextlib import contextmanager

from psycopg import connect
from psycopg.rows import dict_row

from .config import get_settings


@contextmanager
def get_connection():
    settings = get_settings()
    connection = connect(settings.db_dsn, row_factory=dict_row)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
