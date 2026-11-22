// auth snapshots — 进程内会话快照（login 写入，/me 读取）。
// 语义镜像 nextjs user-snapshot / membership-snapshot（服务器内存 Map）：
// 单进程 Fastify 同款生命周期；miss 一律 401 可恢复态，禁 demo 字面量兜底
// （ADR-0019）。user 身份只来自 login 真实映射（镜像 rails resolve_user）。
export interface SnapshotUser {
  id: string;
  username: string;
  displayName?: string;
  roleCode?: string;
}

export interface SnapshotTenant {
  tenantId: string;
  code: string;
  name: string;
  roleIds: string[];
}

const users = new Map<string, SnapshotUser>();
const memberships = new Map<string, SnapshotTenant[]>();

export function putUserSnapshot(userId: string, user: SnapshotUser): void {
  users.set(userId, user);
}

export function getUserSnapshot(userId: string): SnapshotUser | undefined {
  return users.get(userId);
}

export function putMembershipSnapshot(userId: string, tenants: SnapshotTenant[]): void {
  memberships.set(userId, tenants);
}

export function getMembershipSnapshot(userId: string): SnapshotTenant[] | undefined {
  return memberships.get(userId);
}
