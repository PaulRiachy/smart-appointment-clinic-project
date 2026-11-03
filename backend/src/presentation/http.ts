import type { Request, Response } from 'express';
import type { Actor, OperationInput, QueuePublisher, UseCase } from '../application/ports';
import { ApplicationError, type OperationResult, type OutcomeKind } from '../application/result';
import { RuleViolation } from '../domain/rule-violation';
export const statusCodes: Record<OutcomeKind, number> = {
    ok: 200, created: 201, invalid: 400, unauthenticated: 401, forbidden: 403, notFound: 404, conflict: 409, failed: 500,
};
export interface AuthenticatedRequest extends Request {
    user?: Actor;
}
export function sendResult(res: Response, outcome: OperationResult): Response {
    const { kind, ...body } = outcome;
    return res.status(statusCodes[kind]).json({ success: kind === 'ok' || kind === 'created', ...body });
}
export function appointmentError(res: Response, error: unknown): Response {
    if (error instanceof ApplicationError || error instanceof RuleViolation) {
        return res.status(statusCodes[error.kind]).json({ success: false, message: error.message });
    }
    const message = error instanceof Error ? error.message : 'Request failed.';
    const status = message.includes('no longer available') || message.includes('currently being booked') ? 409 : 400;
    return res.status(status).json({ success: false, message });
}
export function adapt(useCase: UseCase, mapError?: typeof appointmentError, queuePublisher?: (io: unknown) => QueuePublisher) {
    return async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
        const input: OperationInput = {
            body: req.body, params: req.params, query: req.query, actor: req.user,
            ...(queuePublisher ? { queueEvents: () => queuePublisher(req.app.get('io')) } : {}),
        };
        try {
            return sendResult(res, await useCase(input));
        }
        catch (error) {
            if (mapError)
                return mapError(res, error);
            throw error;
        }
    };
}
