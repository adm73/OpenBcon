from contextlib import contextmanager

from psycopg import connect
from psycopg.rows import dict_row

from .config import EnvironmentMode, database_dsn_for_mode, get_settings


@contextmanager
def get_connection(mode: EnvironmentMode = "test"):
    settings = get_settings()
    connection = connect(database_dsn_for_mode(settings, mode), row_factory=dict_row)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
