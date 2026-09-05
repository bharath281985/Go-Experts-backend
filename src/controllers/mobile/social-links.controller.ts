import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getSocialLinks = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const links = await prisma.socialLink.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, links });
  } catch (error) {
    console.error('Error fetching social links:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const addSocialLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { platform, url } = req.body;

    if (!platform || !url) {
      res.status(400).json({ success: false, message: 'Platform and URL are required' });
      return;
    }

    const link = await prisma.socialLink.create({
      data: {
        userId,
        platform,
        url,
      },
    });

    res.json({ success: true, link, message: 'Social link added successfully' });
  } catch (error) {
    console.error('Error adding social link:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateSocialLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { platform, url } = req.body;

    // Check if link exists and belongs to user
    const existingLink = await prisma.socialLink.findUnique({
      where: { id },
    });

    if (!existingLink) {
      res.status(404).json({ success: false, message: 'Social link not found' });
      return;
    }

    if (existingLink.userId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const updatedLink = await prisma.socialLink.update({
      where: { id },
      data: {
        platform: platform ?? existingLink.platform,
        url: url ?? existingLink.url,
      },
    });

    res.json({ success: true, link: updatedLink, message: 'Social link updated successfully' });
  } catch (error) {
    console.error('Error updating social link:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteSocialLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Check if link exists and belongs to user
    const existingLink = await prisma.socialLink.findUnique({
      where: { id },
    });

    if (!existingLink) {
      res.status(404).json({ success: false, message: 'Social link not found' });
      return;
    }

    if (existingLink.userId !== userId) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    await prisma.socialLink.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Social link deleted successfully' });
  } catch (error) {
    console.error('Error deleting social link:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
