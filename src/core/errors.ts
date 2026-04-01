export class NotificationKitError extends Error {
  status: number;
  constructor(message: string, status: number = 0) {
    super(message);
    this.name = 'NotificationKitError';
    this.status = status;
  }
}
