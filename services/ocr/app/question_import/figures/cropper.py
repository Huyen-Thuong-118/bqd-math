from __future__ import annotations

import io

from PIL import Image

from ..models.document import DocumentPage
from ..models.geometry import PageRegion
from ..models.result import AssetRecord
from ..storage.assets import AssetStorage


async def crop_region(
    page: DocumentPage,
    region: PageRegion,
    *,
    storage: AssetStorage,
    document_id: str,
    kind: str,
    name: str,
) -> AssetRecord:
    with Image.open(page.rendered_path) as image:
        pixel = region.bbox.to_pixels(
            page.width, page.height, image.width, image.height
        )
        box = (
            max(0, int(pixel.x0)),
            max(0, int(pixel.y0)),
            min(image.width, int(pixel.x1 + 0.999)),
            min(image.height, int(pixel.y1 + 0.999)),
        )
        if box[2] <= box[0] or box[3] <= box[1]:
            raise ValueError("empty crop region")
        cropped = image.crop(box).convert("RGB")
        output = io.BytesIO()
        cropped.save(output, format="WEBP", quality=95, method=6)
    return await storage.save(
        output.getvalue(),
        document_id=document_id,
        kind=kind,
        extension="webp",
        name=name,
        page=page.number,
    )
