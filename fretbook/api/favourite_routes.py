from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from fretbook.api.deps import context, principal, require_song
from fretbook.api.schemas import AUTH_RESPONSES, Favourite
from fretbook.auth.base import Principal
from fretbook.context import AppContext

router = APIRouter()


class FavouriteBody(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    favourite: bool


@router.put("/api/songs/{song_id}/favourite", response_model=Favourite, tags=["songs"], responses=AUTH_RESPONSES)
def set_favourite(
    song_id: str, body: FavouriteBody, ctx: AppContext = Depends(context), user: Principal = Depends(principal)
) -> JSONResponse:
    require_song(ctx, user.user_id, song_id, write=True)
    ctx.songs.set_favourite(user.user_id, song_id, body.favourite)
    return JSONResponse({"favourite": body.favourite})
