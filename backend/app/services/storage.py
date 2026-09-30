from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile


UPLOAD_ROOT = Path("data/uploads")


class UploadTooLargeError(Exception):
    pass


async def save_upload(
    file: UploadFile,
    *,
    max_bytes: int,
) -> tuple[str, int]:
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

    suffix = Path(file.filename or "").suffix.lower()
    storage_name = f"{uuid4()}{suffix}"
    destination = UPLOAD_ROOT / storage_name

    size = 0

    try:
        with destination.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)

                if size > max_bytes:
                    raise UploadTooLargeError

                output.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await file.seek(0)

    return str(destination), size
