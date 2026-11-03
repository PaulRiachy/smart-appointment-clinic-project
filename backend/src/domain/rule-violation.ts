export type RuleFailureKind = 'invalid' | 'unauthenticated' | 'forbidden' | 'notFound' | 'conflict' | 'failed';
export class RuleViolation extends Error {
    constructor(readonly kind: RuleFailureKind, message: string) { super(message); }
}
