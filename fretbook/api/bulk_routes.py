"""Bulk import endpoint for multiple files or .zip archives."""

from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from fretbook.api.deps import context, principal
from fretbook.api.errors import api_error
from fretbook.api.routes import _prefer, _safe_name, _spool, bulk_job_kind
from fretbook.api.schemas import AUTH_RESPONSES
from fretbook.auth.base import Principal
from fretbook.context import AppContext
from fretbook.importers.base import ImportError
from fretbook.importers.zip_safety import safe_extract_zip

router = APIRouter()


class BulkImportJobItem(BaseModel):
    job_id: str
    filename: str


class BulkImportAccepted(BaseModel):
    batch_id: str
    total_files: int
    jobs: list[BulkImportJobItem] = Field(default_factory=list)


@router.post(
    "/api/imports/bulk",
    status_code=202,
    response_model=BulkImportAccepted,
    tags=["imports"],
    responses=AUTH_RESPONSES,
)
async def import_bulk(
    files: list[UploadFile] = File(...),
    duplicates: Literal["skip", "keep_both", "replace"] = Form(default="skip"),
    ctx: AppContext = Depends(context),
    user: Principal = Depends(principal),
) -> JSONResponse:
    """Import multiple files or a .zip archive at once.

    Each valid file is queued as a background job.
    Options:
    - duplicates: "skip", "keep_both", or "replace"
    """
    if not files:
        raise api_error(400, "upload.empty", "no files provided")

    batch_id = uuid.uuid4().hex
    jobs: list[BulkImportJobItem] = []

    for file in files:
        filename = file.filename or "upload"
        is_zip = filename.lower().endswith(".zip")

        if is_zip:
            # Stage the zip archive
            staging_zip = ctx.settings.inbox_dir / f"bulk-{uuid.uuid4().hex}-{_safe_name(filename)}"
            await _spool(file, staging_zip, ctx.settings.max_upload_bytes)
            dest_dir = ctx.settings.inbox_dir / f"bulk-unpacked-{uuid.uuid4().hex}"

            try:
                extracted = safe_extract_zip(staging_zip, dest_dir)
            except ImportError as exc:
                staging_zip.unlink(missing_ok=True)
                raise api_error(400, exc.key, str(exc), **exc.params) from exc
            finally:
                staging_zip.unlink(missing_ok=True)

            for item in extracted:
                job_id = ctx.jobs.enqueue(
                    user.user_id,
                    bulk_job_kind(ctx, item.path, item.filename),
                    {
                        "path": str(item.path),
                        "filename": item.filename,
                        "kind": None,
                        "prefer": _prefer(ctx, user),
                        "on_duplicate": duplicates,
                        "batch_id": batch_id,
                    },
                )
                jobs.append(BulkImportJobItem(job_id=job_id, filename=item.filename))
        else:
            # Stage single file
            staging_file = ctx.settings.inbox_dir / f"bulk-{uuid.uuid4().hex}-{_safe_name(filename)}"
            await _spool(file, staging_file, ctx.settings.max_upload_bytes)

            job_id = ctx.jobs.enqueue(
                user.user_id,
                bulk_job_kind(ctx, staging_file, filename),
                {
                    "path": str(staging_file),
                    "filename": filename,
                    "kind": None,
                    "prefer": _prefer(ctx, user),
                    "on_duplicate": duplicates,
                    "batch_id": batch_id,
                },
            )
            jobs.append(BulkImportJobItem(job_id=job_id, filename=filename))

    return JSONResponse(
        {
            "batch_id": batch_id,
            "total_files": len(jobs),
            "jobs": [j.model_dump() for j in jobs],
        },
        status_code=202,
    )
