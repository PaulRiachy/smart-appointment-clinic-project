export function isValidServicePayload(body: unknown): body is {
    name: string;
    description: string;
    duration: number;
    price: number;
} {
    if (!body || typeof body !== 'object') {
        return false;
    }
    const value = body as Record<string, unknown>;
    return (typeof value.name === 'string' &&
        value.name.trim().length > 0 &&
        typeof value.description === 'string' &&
        typeof value.duration === 'number' &&
        Number.isInteger(value.duration) &&
        value.duration > 0 &&
        typeof value.price === 'number' &&
        Number.isFinite(value.price) &&
        value.price >= 0);
}
