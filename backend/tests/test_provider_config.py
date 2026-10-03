from pathlib import Path

import pytest

from app.core.config import ENV_FILE, Settings
from app.services.rag_service import _valid_api_key


def test_repository_env_path_is_absolute_and_independent_of_cwd(tmp_path, monkeypatch):
    repository_root = Path(__file__).resolve().parents[2]
    backend_root = repository_root / "backend"
    assert ENV_FILE == repository_root / ".env"
    assert ENV_FILE.is_absolute()

    synthetic_env = tmp_path / ".env"
    synthetic_env.write_text("OPENROUTER_API_KEY=sk-or-v1-" + "a" * 130, encoding="utf-8")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    for cwd in (repository_root, backend_root):
        monkeypatch.chdir(cwd)
        assert Settings(_env_file=synthetic_env).openrouter_api_key == "sk-or-v1-" + "a" * 130


def test_process_environment_overrides_env_file(tmp_path, monkeypatch):
    synthetic_env = tmp_path / ".env"
    synthetic_env.write_text("OPENROUTER_API_KEY=sk-or-v1-" + "a" * 130, encoding="utf-8")
    override = "sk-or-v1-" + "b" * 130
    monkeypatch.setenv("OPENROUTER_API_KEY", override)
    assert Settings(_env_file=synthetic_env).openrouter_api_key == override


@pytest.mark.parametrize(
    ("key", "valid"),
    [
        ("sk-or-v1-" + "a" * 130, True),
        (None, False),
        ("", False),
        (" ", False),
        ("sk-or-v1-" + "a" * 64 + " " + "a" * 65, False),
        ("sk-or-v1-" + "a" * 130 + "\x01", False),
    ],
)
def test_api_key_validation_accepts_normal_key_and_rejects_whitespace_or_control(key, valid):
    assert _valid_api_key(key) is valid
