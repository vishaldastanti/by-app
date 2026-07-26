import { Request, Response } from 'express';
import { cloudinary } from '../config/cloudinary';

export const uploadImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image provided' });
    }

    const allowedFolders = ['avatars', 'homestays', 'documents', 'general', 'transports', 'packages', 'reviews'];
    const requestedFolder = req.query.folder as string;
    const subFolder = (requestedFolder && allowedFolders.includes(requestedFolder)) ? `/${requestedFolder}` : '/general';
    const folderPath = `bihar_yaatra${subFolder}`;

    const originalName = req.file.originalname || 'document';
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9.-]/g, '_');
    const publicId = `${Date.now()}_${sanitizedName}`;

    // Upload to Cloudinary using upload_stream
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: folderPath, 
          resource_type: 'auto',
          public_id: publicId
        },
        (error, result) => {
          if (error) return reject(error);
          if (result) resolve(result);
        }
      );
      
      uploadStream.end(req.file!.buffer);
    });

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      url: result.secure_url,
    });
  } catch (error: any) {
    console.error('Image upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message || 'Unknown error',
    });
  }
};
