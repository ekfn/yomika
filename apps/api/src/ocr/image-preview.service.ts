import { Injectable } from "@nestjs/common";
import sharp from "sharp";

export type ImagePreview = {
  buffer: Buffer;
  widthPx: number;
  heightPx: number;
};

@Injectable()
export class ImagePreviewService {
  async createPngPreview(imageBuffer: Buffer): Promise<ImagePreview> {
    const preview = await sharp(imageBuffer)
      .resize({
        width: 400,
        height: 600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: preview.data,
      widthPx: preview.info.width,
      heightPx: preview.info.height,
    };
  }
}
