import sqlite3
from pathlib import Path
from typing import Any, Dict, List

DB_PATH = Path(__file__).parent / "ezus_rodzic.db"

DEFAULT_LEGISLATION: Dict[str, Any] = {
    "rate_single_variant": 81.5,
    "rate_maternity": 100.0,
    "rate_parental": 70.0,
    "maternity_weeks_single": 20,
    "parental_weeks_single": 41,
    "paternity_weeks": 2,
    "deadline_days_81_5": 21,
}

LEGISLATION_KEYS = tuple(DEFAULT_LEGISLATION.keys())


class _Connection:
    """Zamyka połączenie po wyjściu z `with` — na Windows otwarty plik SQLite blokuje reload."""

    def __init__(self) -> None:
        self.conn = sqlite3.connect(DB_PATH, timeout=10)
        self.conn.row_factory = sqlite3.Row

    def __enter__(self) -> sqlite3.Connection:
        return self.conn

    def __exit__(self, exc_type, exc, tb) -> None:
        try:
            if exc_type:
                self.conn.rollback()
            else:
                self.conn.commit()
        finally:
            self.conn.close()


def get_conn() -> _Connection:
    return _Connection()


def init_db() -> None:
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS organizations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                badge TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                phone TEXT NOT NULL,
                website TEXT NOT NULL,
                verified INTEGER DEFAULT 1
            )
        """)
        count = conn.execute("SELECT COUNT(*) FROM organizations").fetchone()[0]
        if count == 0:
            seed_orgs = [
                ("strata", "STRATA I ŻAŁOBA", "Fundacja Ernesta",
                 "Bezpłatne wsparcie psychologiczne i prawne po stracie ciąży i dziecka.",
                 "22 123 00 80", "https://fundacjaernesta.pl", 1),
                ("wczesniactwo", "WCZEŚNIACTWO", "Fundacja Wcześniak",
                 "Informacja, grupy wsparcia i pomoc rodzinom wcześniaków w szpitalach.",
                 "22 231 35 50", "https://wczesniak.pl", 1),
                ("za_zyciem", "WSPARCIE RODZINY", "Fundacja Dajemy Dzieciom Siłę",
                 "Pomoc psychologiczna i prawna dla dzieci oraz opiekunów.",
                 "116 111", "https://fdds.pl", 1),
            ]
            conn.executemany(
                "INSERT INTO organizations (category, badge, name, description, phone, website, verified) VALUES (?, ?, ?, ?, ?, ?, ?)",
                seed_orgs
            )
        conn.execute("""
            CREATE TABLE IF NOT EXISTS legislation_params (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                rate_single_variant REAL NOT NULL,
                rate_maternity REAL NOT NULL,
                rate_parental REAL NOT NULL,
                maternity_weeks_single INTEGER NOT NULL,
                parental_weeks_single INTEGER NOT NULL,
                paternity_weeks INTEGER NOT NULL,
                deadline_days_81_5 INTEGER NOT NULL
            )
        """)
        params_count = conn.execute("SELECT COUNT(*) FROM legislation_params").fetchone()[0]
        if params_count == 0:
            _insert_legislation(conn, DEFAULT_LEGISLATION)
        conn.commit()


def _insert_legislation(conn: sqlite3.Connection, data: Dict[str, Any]) -> None:
    conn.execute(
        """
        INSERT INTO legislation_params (
            id, rate_single_variant, rate_maternity, rate_parental,
            maternity_weeks_single, parental_weeks_single, paternity_weeks, deadline_days_81_5
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        """,
        tuple(data[key] for key in LEGISLATION_KEYS),
    )


def _row_to_params(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "rate_single_variant": float(row["rate_single_variant"]),
        "rate_maternity": float(row["rate_maternity"]),
        "rate_parental": float(row["rate_parental"]),
        "maternity_weeks_single": int(row["maternity_weeks_single"]),
        "parental_weeks_single": int(row["parental_weeks_single"]),
        "paternity_weeks": int(row["paternity_weeks"]),
        "deadline_days_81_5": int(row["deadline_days_81_5"]),
    }


def list_organizations(query: str = "") -> List[Dict[str, Any]]:
    with get_conn() as conn:
        if query.strip():
            like = f"%{query.strip()}%"
            rows = conn.execute(
                "SELECT * FROM organizations WHERE name LIKE ? OR description LIKE ? OR badge LIKE ? ORDER BY id ASC",
                (like, like, like)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM organizations ORDER BY id ASC").fetchall()
        return [dict(r) for r in rows]


def add_organization(data: Dict[str, Any]) -> Dict[str, Any]:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO organizations (category, badge, name, description, phone, website, verified) VALUES (?, ?, ?, ?, ?, ?, 1)",
            (data["category"], data["badge"], data["name"], data["description"], data["phone"], data["website"])
        )
        conn.commit()
        row = conn.execute("SELECT * FROM organizations WHERE id = ?", (cur.lastrowid,)).fetchone()
        return dict(row)


def delete_organization(org_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM organizations WHERE id = ?", (org_id,))
        conn.commit()
        return cur.rowcount > 0


def get_legislation_params() -> Dict[str, Any]:
    init_db()
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM legislation_params WHERE id = 1").fetchone()
        if row is None:
            _insert_legislation(conn, DEFAULT_LEGISLATION)
            conn.commit()
            return dict(DEFAULT_LEGISLATION)
        return _row_to_params(row)


def update_legislation_params(data: Dict[str, Any]) -> Dict[str, Any]:
    current = get_legislation_params()
    merged = {key: data.get(key, current[key]) for key in LEGISLATION_KEYS}
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE legislation_params SET
                rate_single_variant = ?,
                rate_maternity = ?,
                rate_parental = ?,
                maternity_weeks_single = ?,
                parental_weeks_single = ?,
                paternity_weeks = ?,
                deadline_days_81_5 = ?
            WHERE id = 1
            """,
            tuple(merged[key] for key in LEGISLATION_KEYS),
        )
        conn.commit()
    return get_legislation_params()


def reset_legislation_params() -> Dict[str, Any]:
    init_db()
    with get_conn() as conn:
        conn.execute("DELETE FROM legislation_params")
        _insert_legislation(conn, DEFAULT_LEGISLATION)
        conn.commit()
    return dict(DEFAULT_LEGISLATION)
