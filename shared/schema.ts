import { pgTable, text, integer, timestamp, jsonb, real, date, index, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// USERS TABLE
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  timeEntries: many(timeEntries),
}));

// CUSTOMERS TABLE
export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  phone: text("phone"),
  address: text("address"),
  preferences: jsonb("preferences").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("customers_email_idx").on(table.email),
  phoneIdx: index("customers_phone_idx").on(table.phone),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
  notifications: many(notifications),
}));

// ORDER STATUS ENUM
export const orderStatusEnum = [
  "ORDER_PROCESSED",
  "MATERIALS_ORDERED",
  "MATERIALS_ARRIVED",
  "FRAME_CUT",
  "MAT_CUT",
  "PREPPED",
  "READY_FOR_PICKUP",
  "COMPLETED",
  "PICKED_UP",
  "MYSTERY_UNCLAIMED"
] as const;

export type OrderStatus = typeof orderStatusEnum[number];

// PRIORITY ENUM
export const priorityEnum = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type Priority = typeof priorityEnum[number];

// ORDER TYPE ENUM
export const orderTypeEnum = ["FRAME", "MAT", "SHADOWBOX"] as const;
export type OrderType = typeof orderTypeEnum[number];

// ORDERS TABLE
export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  trackingId: text("tracking_id").unique().notNull(),
  customerId: text("customer_id").references(() => customers.id).notNull(),
  assignedToId: text("assigned_to_id").references(() => users.id),
  description: text("description").notNull(),
  notes: text("notes"),
  internalNotes: text("internal_notes"),
  status: text("status").notNull().default("ORDER_PROCESSED"),
  priority: text("priority").notNull().default("MEDIUM"),
  orderType: text("order_type").notNull(),
  dueDate: date("due_date").notNull(),
  estimatedHours: real("estimated_hours").notNull().default(0),
  actualHours: real("actual_hours"),
  price: real("price").notNull(),
  deposit: real("deposit"),
  complexity: integer("complexity").notNull().default(5),
  invoiceNumber: text("invoice_number"),
  artworkReceivedDate: date("artwork_received_date"),
  completedAt: timestamp("completed_at"),
  dimensions: jsonb("dimensions").default({ width: null, height: null, depth: null }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  trackingIdIdx: index("orders_tracking_id_idx").on(table.trackingId),
  customerIdIdx: index("orders_customer_id_idx").on(table.customerId),
  statusIdx: index("orders_status_idx").on(table.status),
  dueDateIdx: index("orders_due_date_idx").on(table.dueDate),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  assignedTo: one(users, {
    fields: [orders.assignedToId],
    references: [users.id],
  }),
  materials: many(materials),
  statusHistory: many(statusHistory),
  timeEntries: many(timeEntries),
  notifications: many(notifications),
}));

// MATERIALS TABLE
export const materials = pgTable("materials", {
  id: text("id").primaryKey(),
  orderId: text("order_id").references(() => orders.id).notNull(),
  type: text("type").notNull(),
  subtype: text("subtype"),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull(),
  supplier: text("supplier"),
  cost: real("cost").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("materials_order_id_idx").on(table.orderId),
}));

export const materialsRelations = relations(materials, ({ one }) => ({
  order: one(orders, {
    fields: [materials.orderId],
    references: [orders.id],
  }),
}));

// STATUS HISTORY TABLE
export const statusHistory = pgTable("status_history", {
  id: text("id").primaryKey(),
  orderId: text("order_id").references(() => orders.id).notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedBy: text("changed_by").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("status_history_order_id_idx").on(table.orderId),
}));

export const statusHistoryRelations = relations(statusHistory, ({ one }) => ({
  order: one(orders, {
    fields: [statusHistory.orderId],
    references: [orders.id],
  }),
}));

// TIME ENTRIES TABLE
export const timeEntries = pgTable("time_entries", {
  id: text("id").primaryKey(),
  orderId: text("order_id").references(() => orders.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
  duration: real("duration").notNull(),
  task: text("task").notNull(),
  notes: text("notes"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  orderIdIdx: index("time_entries_order_id_idx").on(table.orderId),
  userIdIdx: index("time_entries_user_id_idx").on(table.userId),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  order: one(orders, {
    fields: [timeEntries.orderId],
    references: [orders.id],
  }),
  user: one(users, {
    fields: [timeEntries.userId],
    references: [users.id],
  }),
}));

// NOTIFICATION ENUMS
export const notificationTypeEnum = [
  "ORDER_CREATED",
  "ORDER_UPDATED",
  "ORDER_COMPLETED",
  "ORDER_READY",
  "ORDER_DELAYED"
] as const;
export type NotificationType = typeof notificationTypeEnum[number];

export const notificationChannelEnum = ["EMAIL", "SMS", "PUSH"] as const;
export type NotificationChannel = typeof notificationChannelEnum[number];

export const notificationStatusEnum = ["PENDING", "SENT", "FAILED"] as const;
export type NotificationStatus = typeof notificationStatusEnum[number];

// NOTIFICATIONS TABLE
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").references(() => customers.id).notNull(),
  orderId: text("order_id").references(() => orders.id),
  type: text("type").notNull(),
  channel: text("channel").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  customerIdIdx: index("notifications_customer_id_idx").on(table.customerId),
  statusIdx: index("notifications_status_idx").on(table.status),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  customer: one(customers, {
    fields: [notifications.customerId],
    references: [customers.id],
  }),
  order: one(orders, {
    fields: [notifications.orderId],
    references: [orders.id],
  }),
}));

// AI ANALYSIS TABLE
export const aiAnalysis = pgTable("ai_analysis", {
  id: text("id").primaryKey(),
  metrics: jsonb("metrics").notNull(),
  alerts: jsonb("alerts").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// TYPES
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

export type Material = typeof materials.$inferSelect;
export type InsertMaterial = typeof materials.$inferInsert;

export type StatusHistory = typeof statusHistory.$inferSelect;

export type TimeEntry = typeof timeEntries.$inferSelect;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export type AIAnalysis = typeof aiAnalysis.$inferSelect;

// COMPOSITE TYPES
export interface OrderWithDetails extends Order {
  customer: Customer;
  assignedTo?: User;
  materials: Material[];
  statusHistory: StatusHistory[];
}

export interface WorkloadAnalysis {
  totalOrders: number;
  totalHours: number;
  averageComplexity: number;
  onTimePercentage: number;
  statusCounts: Record<string, number>;
  alerts?: any[];
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ZOD VALIDATION SCHEMAS
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export const insertCustomerSchema = createInsertSchema(customers, {
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const insertOrderSchema = createInsertSchema(orders, {
  description: z.string().min(1),
  orderType: z.enum(orderTypeEnum),
  priority: z.enum(priorityEnum).optional(),
  status: z.string().optional(),
  price: z.number().min(0),
  estimatedHours: z.number().min(0),
});

export const insertMaterialSchema = createInsertSchema(materials, {
  type: z.string().min(1),
  quantity: z.number().min(0),
  unit: z.string().min(1),
  cost: z.number().min(0),
});

export const insertNotificationSchema = createInsertSchema(notifications, {
  type: z.enum(notificationTypeEnum),
  channel: z.enum(notificationChannelEnum),
  subject: z.string().min(1),
  content: z.string().min(1),
});
