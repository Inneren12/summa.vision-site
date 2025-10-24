/** Return stable instance id for logs (can be overridden with INSTANCE_ID). */
export function getInstanceId(): string {
  return process.env.INSTANCE_ID || `node-${process.pid}`;
}
