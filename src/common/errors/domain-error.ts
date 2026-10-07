export class DomainError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly reference?: string) {
    super(message);
    this.name = 'DomainError';
  }
}
