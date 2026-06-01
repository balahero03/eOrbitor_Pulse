// ─── Pagination ─────────────────────────────────────────────────────────────

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

// ─── User ───────────────────────────────────────────────────────────────────

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'SALES_MANAGER'
  | 'SALES_EXEC'
  | 'SUPPORT'
  | 'VIEWER';

export type UserListItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department?: string;
  isActive: boolean;
  managerId?: string;
  manager?: { id: string; firstName: string; lastName: string };
  createdAt: string;
};

// ─── Lead ───────────────────────────────────────────────────────────────────

export type LeadStatus =
  | 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'REJECTED' | 'CONVERTED'
  | 'WON' | 'LOST' | 'SUSPECT' | 'PROSPECT' | 'NEGOTIATION'
  | 'COMMIT' | 'DROPPED' | 'ON_HOLD';

export type LeadSource =
  | 'WEBSITE' | 'REFERRAL' | 'WALKIN' | 'CALL' | 'EMAIL' | 'ADVERTISEMENT';

export type LeadListItem = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company: string;
  source: LeadSource;
  status: LeadStatus;
  leadScore: number;
  quoteNo?: string;
  quoteValue?: number;
  rfqDate?: string;
  followUpDate?: string;
  remarks?: string;
  assignedTo: { firstName: string; lastName: string };
  broughtBy?: { firstName: string; lastName: string };
  linkedCustomer?: { id: string; companyName: string };
  createdAt: string;
  updatedAt: string;
};

// ─── Customer ───────────────────────────────────────────────────────────────

export type CustomerCategory = 'PROSPECT' | 'ACTIVE' | 'INACTIVE' | 'LOST';

export type CustomerListItem = {
  id: string;
  companyName: string;
  gstNumber: string;
  industry?: string;
  customerCategory: CustomerCategory;
  annualRevenue?: number;
  createdAt: string;
};

// ─── Deal ───────────────────────────────────────────────────────────────────

export type DealStage =
  | 'SUSPECT' | 'PROSPECT' | 'APPROACH' | 'NEGOTIATION' | 'CLOSURE' | 'ONGOING';

export type DealListItem = {
  id: string;
  title: string;
  value: number;
  stage: DealStage;
  probability: number;
  expectedCloseDate?: string;
  assignedTo: { firstName: string; lastName: string };
  customer?: { id: string; companyName: string };
  createdAt: string;
};

// ─── Task ───────────────────────────────────────────────────────────────────

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TaskListItem = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  assignedTo: { firstName: string; lastName: string };
  createdAt: string;
};

// ─── Quotation ───────────────────────────────────────────────────────────────

export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export type QuotationListItem = {
  id: string;
  quotationNumber: string;
  status: QuotationStatus;
  totalAmount: number;
  validUntil?: string;
  customer?: { id: string; companyName: string };
  createdBy: { firstName: string; lastName: string };
  createdAt: string;
};

// ─── Order ───────────────────────────────────────────────────────────────────

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'FULFILLED' | 'INVOICED' | 'COMPLETED';
export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED';

export type OrderListItem = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  customer?: { id: string; companyName: string };
  createdAt: string;
};

// ─── Ticket ──────────────────────────────────────────────────────────────────

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TicketListItem = {
  id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo?: { firstName: string; lastName: string };
  createdBy: { firstName: string; lastName: string };
  customer?: { id: string; companyName: string };
  createdAt: string;
};

// ─── Dashboard KPIs ──────────────────────────────────────────────────────────

export type AdminDashboardData = {
  role: 'SUPER_ADMIN' | 'ADMIN';
  kpis: {
    totalLeads: number;
    totalCustomers: number;
    activeDeals: number;
    dealsPipelineValue: number;
    openTickets: number;
    overdueTasks: number;
    ytdRevenue: number;
    monthRevenue: number;
    totalUsers: number;
    pendingApprovals: number;
  };
  pipeline: Array<{ stage: string; value: number; count: number }>;
  recentActivity: Array<{ id: string; action: string; entity: string; createdAt: string }>;
};

export type ManagerDashboardData = {
  role: 'SALES_MANAGER';
  kpis: {
    teamLeads: number;
    teamActiveDeals: number;
    teamPipelineValue: number;
    teamWonThisMonth: number;
    teamOverdueTasks: number;
    teamMembersCount: number;
  };
  teamLeaderboard: Array<{
    userId: string;
    name: string;
    wonThisMonth: number;
    activeLeads: number;
    pipelineValue: number;
  }>;
  upcomingFollowUps: Array<{ id: string; name: string; company: string; followUpDate: string; assigneeName: string }>;
};

export type SalesExecDashboardData = {
  role: 'SALES_EXEC';
  kpis: {
    myLeads: number;
    myActiveDeals: number;
    myPipelineValue: number;
    myWonThisMonth: number;
    myOverdueTasks: number;
    myTodayFollowUps: number;
  };
  todayFollowUps: Array<{ id: string; name: string; company: string; followUpDate: string }>;
  overdueTasks: Array<{ id: string; title: string; dueDate: string; priority: string }>;
};

export type SupportDashboardData = {
  role: 'SUPPORT';
  kpis: {
    openTickets: number;
    myAssignedTickets: number;
    resolvedToday: number;
    urgentTickets: number;
  };
  myTickets: Array<{ id: string; title: string; status: TicketStatus; priority: TicketPriority; customer?: string; createdAt: string }>;
};
