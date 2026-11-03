export type OutcomeKind = 'ok' | 'created' | 'invalid' | 'unauthenticated' | 'forbidden' | 'notFound' | 'conflict' | 'failed';
export interface OperationResult {
    kind: OutcomeKind;
    data?: unknown;
    message?: string;
    error?: string;
}
export function result(kind: OutcomeKind, value: Omit<OperationResult, 'kind'>): OperationResult {
    return { kind, ...value };
}
export class ApplicationError extends Error {
    constructor(readonly kind: OutcomeKind, message: string) { super(message); }
}
