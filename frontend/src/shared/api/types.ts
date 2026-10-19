export interface HealthResponse {
  status: 'ok';
}

export type UserRole = string;

export interface AbilityRule {
  action: string | string[];
  subject: string | string[];
  conditions?: Record<string, unknown>;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  permissions: AbilityRule[];
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  userId: string;
  createdById: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: Pick<UserRecord, 'id' | 'email' | 'firstName' | 'lastName'>;
}

export interface UserRecord {
  id: string;
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl?: string | null;
  customRoleId?: string | null;
  customRole?: { id: string; name: string } | null;
  roleName?: string;
}

export interface UserProfile extends UserRecord {
  birthDate: string | null;
  avatarUrl: string | null;
}

export interface RoleRecord {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  assignedUsers?: number | null;
  permissions: AbilityRule[];
}

export interface PaginatedTasks {
  items: TaskItem[];
  page: number;
  limit: number;
  total: number;
  pageCount: number;
}

export interface TaskDashboardSummary {
  total: number;
  counts: Record<TaskStatus, number>;
  recentTasks: TaskItem[];
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationResponse {
  items: NotificationItem[];
  unreadCount: number;
}
