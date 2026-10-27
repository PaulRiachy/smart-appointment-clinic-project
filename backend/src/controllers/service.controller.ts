import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { UserRole } from '@app/shared';
import { Service } from '../models/service.model';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';


function isValidServicePayload(body: unknown): body is {
  name: string;
  description: string;
  duration: number;
  price: number;
} {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const value = body as Record<string, unknown>;

  return (
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.description === 'string' &&
    typeof value.duration === 'number' &&
    Number.isInteger(value.duration) &&
    value.duration > 0 &&
    typeof value.price === 'number' &&
    Number.isFinite(value.price) &&
    value.price >= 0
  );
}

export async function listServices(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const isAdmin = authReq.user?.role === UserRole.ADMIN;

    const services = await Service.find(
      isAdmin ? {} : { active: true },
    )
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error('Failed to list services:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to load services.',
    });
  }
}

export async function createService(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!isValidServicePayload(req.body)) {
      res.status(400).json({
        success: false,
        message:
          'Name and description are required. Duration must be a positive integer and price must be non-negative.',
      });
      return;
    }

    const name = req.body.name.trim();
    const description = req.body.description.trim();

    const existingService = await Service.findOne({
      name: { $regex: `^${escapeRegExp(name)}$`, $options: 'i' },
    }).lean();

    if (existingService) {
      res.status(409).json({
        success: false,
        message: 'A service with this name already exists.',
      });
      return;
    }

    const service = await Service.create({
      name,
      description,
      duration: req.body.duration,
      price: req.body.price,
      active: true,
    });

    res.status(201).json({
      success: true,
      message: 'Service created successfully.',
      data: service,
    });
  } catch (error) {
    console.error('Failed to create service:', error);

    if (
      error instanceof mongoose.Error.ValidationError ||
      (error instanceof Error && error.name === 'ValidationError')
    ) {
      res.status(400).json({
        success: false,
        message: 'Invalid service data.',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create service.',
    });
  }
}

export async function updateService(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid service ID.',
      });
      return;
    }

    if (!isValidServicePayload(req.body)) {
      res.status(400).json({
        success: false,
        message:
          'Name and description are required. Duration must be a positive integer and price must be non-negative.',
      });
      return;
    }

    const name = req.body.name.trim();
    const description = req.body.description.trim();

    const duplicate = await Service.findOne({
      _id: { $ne: id },
      name: { $regex: `^${escapeRegExp(name)}$`, $options: 'i' },
    }).lean();

    if (duplicate) {
      res.status(409).json({
        success: false,
        message: 'A service with this name already exists.',
      });
      return;
    }

    const service = await Service.findByIdAndUpdate(
      id,
      {
        $set: {
          name,
          description,
          duration: req.body.duration,
          price: req.body.price,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!service) {
      res.status(404).json({
        success: false,
        message: 'Service not found.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Service updated successfully.',
      data: service,
    });
  } catch (error) {
    console.error('Failed to update service:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update service.',
    });
  }
}

export async function updateServiceStatus(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid service ID.',
      });
      return;
    }

    const service = await Service.findById(id);

    if (!service) {
      res.status(404).json({
        success: false,
        message: 'Service not found.',
      });
      return;
    }

    if (
      req.body.active !== undefined &&
      typeof req.body.active !== 'boolean'
    ) {
      res.status(400).json({
        success: false,
        message: 'The active field must be a boolean.',
      });
      return;
    }

    service.active =
      typeof req.body.active === 'boolean'
        ? req.body.active
        : !service.active;

    await service.save();

    res.status(200).json({
      success: true,
      message: service.active
        ? 'Service activated successfully.'
        : 'Service deactivated successfully.',
      data: service,
    });
  } catch (error) {
    console.error('Failed to update service status:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update service status.',
    });
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}