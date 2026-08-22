from __future__ import annotations

import os
import subprocess
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
RESULT = ROOT / "docs" / "SUPABASE_RUN_RESULT.txt"
URL = os.environ.get("SUPABASE_DB_URL", "")
EXPECTED_TABLES = (
    "platform_admins","tenants","tenant_members","branches","tenant_member_branches",
    "plans","plan_features","subscriptions","tenant_feature_overrides","tenant_settings",
    "tenant_branding","sync_entities","sync_receipts",
)
EXPECTED_FUNCTIONS = (
    "is_platform_admin","has_tenant_access","has_tenant_role","has_branch_access",
    "tenant_can_operate","tenant_feature_enabled","can_sync_entity","apply_sync_operations",
    "pull_sync_changes","platform_provision_tenant","can_manage_tenant_users",
    "platform_set_tenant_plan","platform_set_tenant_status","can_assign_tenant_role",
    "branch_belongs_to_tenant","normalize_sync_payload",
)


def safe_error(text: str) -> str:
    try:
        pw = urlparse(URL).password
        if pw:
            text = text.replace(pw, "<redacted>")
    except Exception:
        pass
    return text.replace("\n", " | ")[:5000]


def run_psql(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["psql", URL, "-v", "ON_ERROR_STOP=1", *args],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )


def scalar(sql: str) -> tuple[int, str, str]:
    proc = run_psql("-Atc", sql)
    return proc.returncode, proc.stdout.strip(), proc.stderr


def line(lines: list[str], key: str, value: object) -> None:
    lines.append(f"{key}={value}")


def main() -> None:
    lines: list[str] = ["KIUBO Supabase bootstrap result"]
    if not URL:
        line(lines, "secret", "missing")
        line(lines, "status", "FAILED_SECRET_MISSING")
        RESULT.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return

    line(lines, "secret", "present")
    line(lines, "placeholder", "yes" if "[YOUR-PASSWORD]" in URL else "no")
    try:
        parsed = urlparse(URL)
        line(lines, "scheme", parsed.scheme)
        line(lines, "host", parsed.hostname)
        line(lines, "port", parsed.port)
        line(lines, "user", parsed.username)
        line(lines, "database", (parsed.path or "").lstrip("/"))
        line(lines, "password_present", "yes" if parsed.password else "no")
    except Exception as exc:
        line(lines, "parse_error", f"{type(exc).__name__}:{exc}")

    conn = run_psql("-Atc", "select 1;")
    if conn.returncode != 0:
        line(lines, "status", "FAILED_CONNECTION")
        line(lines, "error", safe_error(conn.stderr))
        RESULT.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return
    line(lines, "connection", "ok")

    table_list = ",".join(repr(x) for x in EXPECTED_TABLES)
    code, count, err = scalar(
        f"select count(*) from information_schema.tables where table_schema='public' and table_name in ({table_list});"
    )
    if code != 0:
        line(lines, "status", "FAILED_SCHEMA_CHECK")
        line(lines, "error", safe_error(err))
        RESULT.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return

    line(lines, "tables_before", f"{count}/13")
    if count not in {"0", "13"}:
        line(lines, "status", "FAILED_PARTIAL_SCHEMA")
        RESULT.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return

    if count == "0":
        migrations = [
            ROOT / "supabase/migrations/0001_core_multitenant.sql",
            ROOT / "supabase/migrations/0002_sync_substrate.sql",
            ROOT / "supabase/migrations/0003_platform_provisioning.sql",
            ROOT / "supabase/migrations/0004_security_guardrails.sql",
            ROOT / "supabase/migrations/0005_sync_payload_guardrails.sql",
        ]
        combined = ROOT / ".kiubo_all_migrations.sql"
        combined.write_text("\n\n".join(p.read_text(encoding="utf-8") for p in migrations), encoding="utf-8")
        proc = run_psql("-1", "-f", str(combined))
        combined.unlink(missing_ok=True)
        if proc.returncode != 0:
            line(lines, "status", "FAILED_MIGRATION")
            line(lines, "error", safe_error(proc.stderr))
            RESULT.write_text("\n".join(lines) + "\n", encoding="utf-8")
            return
        line(lines, "migration", "applied_0001_0005")
    else:
        line(lines, "migration", "skipped_schema_already_present")

    code, tables, err = scalar(
        f"select count(*) from information_schema.tables where table_schema='public' and table_name in ({table_list});"
    )
    if code != 0:
        line(lines, "status", "FAILED_VERIFY")
        line(lines, "error", safe_error(err))
        RESULT.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return

    fn_list = ",".join(repr(x) for x in EXPECTED_FUNCTIONS)
    _, functions, fn_err = scalar(
        f"select count(distinct proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ({fn_list});"
    )
    _, rls, rls_err = scalar(
        f"select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ({table_list}) and c.relrowsecurity;"
    )
    if fn_err or rls_err:
        line(lines, "status", "FAILED_VERIFY")
        line(lines, "error", safe_error(fn_err or rls_err))
    else:
        line(lines, "tables_after", f"{tables}/13")
        line(lines, "functions", f"{functions}/16")
        line(lines, "rls", f"{rls}/13")
        line(lines, "status", "SUCCESS" if (tables, functions, rls) == ("13", "16", "13") else "FAILED_VERIFY")

    RESULT.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
