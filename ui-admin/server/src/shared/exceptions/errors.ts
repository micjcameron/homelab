// Domain error classes (mirrors socialContentGenerator's shared/exceptions style).

export class EntityNotFoundError extends Error {
  constructor(entityName: string, id: string) {
    super(`${entityName} '${id}' not found`);
    this.name = 'EntityNotFoundError';
  }
}

export class CommandExecutionError extends Error {
  constructor(
    message: string,
    public readonly exitCode?: number,
    public readonly stderr?: string,
  ) {
    super(message);
    this.name = 'CommandExecutionError';
  }
}

export class UnknownServiceError extends Error {
  constructor(name: string) {
    super(`Unknown service '${name}'`);
    this.name = 'UnknownServiceError';
  }
}

export class AuthenticationError extends Error {
  constructor() {
    super('Invalid username or password');
    this.name = 'AuthenticationError';
  }
}

export class DatabaseOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseOperationError';
  }
}
