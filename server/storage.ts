import {
  users,
  customers,
  orders,
  materials,
  statusHistory,
  timeEntries,
  notifications,
  aiAnalysis,
  type User,
  type UpsertUser,
  type Customer,
  type InsertCustomer,
  type Order,
  type InsertOrder,
  type Material,
  type InsertMaterial,
  type StatusHistory,
  type TimeEntry,
  type Notification,
  type InsertNotification,
  type AIAnalysis,
  type OrderWithDetails,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, ne, and, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

// Interface for storage operations
export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Customer operations
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  getCustomerByPhone(phone: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer>;
  upsertCustomer(customer: InsertCustomer): Promise<Customer>;

  // Order operations
  getOrders(): Promise<OrderWithDetails[]>;
  getAllOrders(): Promise<OrderWithDetails[]>;
  getOrder(id: string): Promise<OrderWithDetails | undefined>;
  getOrderByTrackingId(trackingId: string): Promise<OrderWithDetails | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order>;
  getOrdersByStatus(status: string): Promise<OrderWithDetails[]>;
  getOrdersByCustomer(customerId: string): Promise<OrderWithDetails[]>;

  // Material operations
  getMaterialsByOrder(orderId: string): Promise<Material[]>;
  createMaterial(material: InsertMaterial): Promise<Material>;
  updateMaterial(id: string, material: Partial<InsertMaterial>): Promise<Material>;

  // Status history operations
  createStatusHistory(data: {
    orderId: string;
    fromStatus?: string;
    toStatus: string;
    changedBy: string;
    reason?: string;
  }): Promise<StatusHistory>;

  // Time entry operations
  createTimeEntry(data: {
    orderId: string;
    userId: string;
    duration: number;
    task: string;
    notes?: string;
    startTime: Date;
    endTime: Date;
  }): Promise<TimeEntry>;

  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: string, data: Partial<Notification>): Promise<Notification>;
  getPendingNotifications(): Promise<Notification[]>;

  // AI Analysis operations
  saveAIAnalysis(data: { metrics: any; alerts: any }): Promise<AIAnalysis>;
  getLatestAIAnalysis(): Promise<AIAnalysis | undefined>;

  // Analytics operations
  getWorkloadMetrics(): Promise<{
    totalOrders: number;
    totalHours: number;
    averageComplexity: number;
    onTimePercentage: number;
  }>;

    // Custom Auth methods
    createUser(userData: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
    }): Promise<User>;
    getUserByEmail(email: string): Promise<User | null>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    const id = randomUUID();
    const [result] = await db
      .insert(users)
      .values({
        id,
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
      })
      .returning();
    return result;
  }

  async getUserByEmail(email: string) {
    const [result] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return result || null;
  }

  // Customer operations
  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.email, email));
    return customer;
  }

  async createCustomer(customerData: any) {
    try {
      console.log('Storage createCustomer called with:', customerData);
      
      const customerToInsert = {
        id: customerData.id || randomUUID(),
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone || null,
        address: customerData.address || null,
        preferences: customerData.preferences || {},
        createdAt: customerData.createdAt || new Date(),
        updatedAt: new Date(),
      };

      console.log('Inserting customer with data:', customerToInsert);
      
      const [customer] = await db
        .insert(customers)
        .values(customerToInsert)
        .returning();
      
      console.log('Customer inserted successfully:', customer);
      return customer;
    } catch (error) {
      console.error('Storage createCustomer error:', error);
      
      // Provide more specific error information
      if (error instanceof Error) {
        if (error.message.includes('UNIQUE constraint')) {
          throw new Error('A customer with this email already exists');
        }
        throw new Error(`Database error: ${error.message}`);
      }
      
      throw new Error('Failed to create customer in database');
    }
  }

  async updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer> {
    const [updatedCustomer] = await db
      .update(customers)
      .set({ ...customer, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return updatedCustomer;
  }

  async getCustomerByPhone(phone: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.phone, phone));
    return customer;
  }

  async upsertCustomer(customerData: InsertCustomer): Promise<Customer> {
    // Try to find existing customer by email or phone
    let existingCustomer = null;
    if (customerData.email) {
      existingCustomer = await this.getCustomerByEmail(customerData.email);
    }
    if (!existingCustomer && customerData.phone) {
      existingCustomer = await this.getCustomerByPhone(customerData.phone);
    }

    if (existingCustomer) {
      // Update existing customer
      return await this.updateCustomer(existingCustomer.id, customerData);
    } else {
      // Create new customer
      return await this.createCustomer(customerData);
    }
  }

  // Order operations
  async getOrders(): Promise<OrderWithDetails[]> {
    const startTime = Date.now();

    try {
      // Simplified query with shorter timeout
      const result = await db
        .select({
          id: orders.id,
          trackingId: orders.trackingId,
          orderType: orders.orderType,
          status: orders.status,
          dueDate: orders.dueDate,
          estimatedHours: orders.estimatedHours,
          price: orders.price,
          description: orders.description,
          priority: orders.priority,
          notes: orders.notes,
          createdAt: orders.createdAt,
          updatedAt: orders.updatedAt,
          invoiceNumber: orders.invoiceNumber,
          assignedToId: orders.assignedToId,
          customer: {
            id: customers.id,
            name: customers.name,
            email: customers.email,
            phone: customers.phone,
            address: customers.address,
            preferences: customers.preferences,
            createdAt: customers.createdAt,
            updatedAt: customers.updatedAt,
          },
        })
        .from(orders)
        .leftJoin(customers, eq(orders.customerId, customers.id))
        .orderBy(desc(orders.createdAt))
        .limit(100); // Reduced limit for faster queries

      const endTime = Date.now();
      console.log(`getOrders query completed: ${endTime - startTime}ms`);

      return result as OrderWithDetails[];
    } catch (error) {
      console.error('Database error in getOrders:', error);
      // Return empty array instead of throwing to prevent app crash
      return [];
    }
  }

  async getAllOrders(): Promise<OrderWithDetails[]> {
    return this.getOrders();
  }

  async getOrder(id: string): Promise<OrderWithDetails | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;

    const customer = await db.select().from(customers).where(eq(customers.id, order.customerId)).then(r => r[0]);
    const assignedTo = order.assignedToId ? await db.select().from(users).where(eq(users.id, order.assignedToId)).then(r => r[0]) : undefined;
    const orderMaterials = await this.getMaterialsByOrder(order.id);
    const orderHistory = await db.select().from(statusHistory).where(eq(statusHistory.orderId, order.id));

    return {
      ...order,
      customer: customer!,
      assignedTo,
      materials: orderMaterials,
      statusHistory: orderHistory,
    };
  }

  async getOrderByTrackingId(trackingId: string): Promise<OrderWithDetails | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.trackingId, trackingId));
    if (!order) return undefined;

    const customer = await db.select().from(customers).where(eq(customers.id, order.customerId)).then(r => r[0]);
    const assignedTo = order.assignedToId ? await db.select().from(users).where(eq(users.id, order.assignedToId)).then(r => r[0]) : undefined;
    const orderMaterials = await this.getMaterialsByOrder(order.id);
    const orderHistory = await db.select().from(statusHistory).where(eq(statusHistory.orderId, order.id));

    return {
      ...order,
      customer: customer!,
      assignedTo,
      materials: orderMaterials,
      statusHistory: orderHistory,
    };
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    // Generate ID if not provided
    const orderWithId = {
      ...order,
      id: order.id || randomUUID()
    };
    
    const [newOrder] = await db
      .insert(orders)
      .values(orderWithId)
      .returning();
    return newOrder;
  }

  async updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order> {
    const [updatedOrder] = await db
      .update(orders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updatedOrder;
  }

  async getOrdersByStatus(status: string): Promise<OrderWithDetails[]> {
    const ordersList = await db
      .select()
      .from(orders)
      .where(eq(orders.status, status as any))
      .orderBy(desc(orders.createdAt));

    const ordersWithDetails: OrderWithDetails[] = [];

    for (const order of ordersList) {
      const customer = await db.select().from(customers).where(eq(customers.id, order.customerId)).then(r => r[0]);
      const assignedTo = order.assignedToId ? await db.select().from(users).where(eq(users.id, order.assignedToId)).then(r => r[0]) : undefined;
      const orderMaterials = await this.getMaterialsByOrder(order.id);
      const orderHistory = await db.select().from(statusHistory).where(eq(statusHistory.orderId, order.id));

      ordersWithDetails.push({
        ...order,
        customer: customer!,
        assignedTo,
        materials: orderMaterials,
        statusHistory: orderHistory,
      });
    }

    return ordersWithDetails;
  }

  async getOrdersByCustomer(customerId: string): Promise<OrderWithDetails[]> {
    const ordersList = await db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt));

    const ordersWithDetails: OrderWithDetails[] = [];

    for (const order of ordersList) {
      const customer = await db.select().from(customers).where(eq(customers.id, order.customerId)).then(r => r[0]);
      const assignedTo = order.assignedToId ? await db.select().from(users).where(eq(users.id, order.assignedToId)).then(r => r[0]) : undefined;
      const orderMaterials = await this.getMaterialsByOrder(order.id);
      const orderHistory = await db.select().from(statusHistory).where(eq(statusHistory.orderId, order.id));

      ordersWithDetails.push({
        ...order,
        customer: customer!,
        assignedTo,
        materials: orderMaterials,
        statusHistory: orderHistory,
      });
    }

    return ordersWithDetails;
  }

  async getOrdersWithDetails(): Promise<OrderWithDetails[]> {
    return this.getOrders();
  }

  // Material operations
  async getMaterialsByOrder(orderId: string): Promise<Material[]> {
    return await db.select().from(materials).where(eq(materials.orderId, orderId));
  }

  async createMaterial(material: InsertMaterial): Promise<Material> {
    const [newMaterial] = await db
      .insert(materials)
      .values(material)
      .returning();
    return newMaterial;
  }

  async updateMaterial(id: string, material: Partial<InsertMaterial>): Promise<Material> {
    const [updatedMaterial] = await db
      .update(materials)
      .set({ ...material, updatedAt: new Date() })
      .where(eq(materials.id, id))
      .returning();
    return updatedMaterial;
  }

  // Status history operations
  async createStatusHistory(data: {
    orderId: string;
    fromStatus?: string;
    toStatus: string;
    changedBy: string;
    reason?: string;
  }): Promise<StatusHistory> {
    const [newHistory] = await db
      .insert(statusHistory)
      .values({
        id: randomUUID(),
        ...data
      })
      .returning();
    return newHistory;
  }

  // Time entry operations
  async createTimeEntry(data: {
    orderId: string;
    userId: string;
    duration: number;
    task: string;
    notes?: string;
    startTime: Date;
    endTime: Date;
  }): Promise<TimeEntry> {
    const [newTimeEntry] = await db
      .insert(timeEntries)
      .values(data)
      .returning();
    return newTimeEntry;
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return newNotification;
  }

  async updateNotification(id: string, data: Partial<Notification>): Promise<Notification> {
    const [updatedNotification] = await db
      .update(notifications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    return updatedNotification;
  }

  async getPendingNotifications(): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.status, 'PENDING'))
      .orderBy(desc(notifications.createdAt));
  }

  // AI Analysis operations
  async saveAIAnalysis(data: { metrics: any; alerts: any }): Promise<AIAnalysis> {
    const [analysis] = await db
      .insert(aiAnalysis)
      .values({
        id: crypto.randomUUID(), // Add explicit ID generation
        metrics: data.metrics,
        alerts: data.alerts,
      })
      .returning();
    return analysis;
  }

  async getLatestAIAnalysis(): Promise<AIAnalysis | undefined> {
    try {
      const [analysis] = await db
        .select()
        .from(aiAnalysis)
        .orderBy(desc(aiAnalysis.createdAt))
        .limit(1);
      return analysis;
    } catch (error) {
      console.error('Error fetching latest AI analysis:', error);
      return undefined;
    }
  }

  // Search operations
  async searchOrders(query: string): Promise<OrderWithDetails[]> {
    try {
      const allOrders = await this.getOrders();
      const lowerQuery = query.toLowerCase();
      
      return allOrders.filter(order => 
        order.trackingId.toLowerCase().includes(lowerQuery) ||
        order.customer?.name?.toLowerCase().includes(lowerQuery) ||
        order.description?.toLowerCase().includes(lowerQuery) ||
        order.status.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      console.error('Error searching orders:', error);
      return [];
    }
  }

  // Analytics operations
  async getWorkloadMetrics(): Promise<{
    totalOrders: number;
    totalHours: number;
    averageComplexity: number;
    onTimePercentage: number;
    statusCounts: Record<string, number>;
  }> {
    try {
      // Exclude Mystery/Unclaimed and completed orders from active workload metrics
      const allOrders = await db.select().from(orders);
      const activeOrders = allOrders.filter(order => 
        order.status !== 'MYSTERY_UNCLAIMED' && 
        order.status !== 'COMPLETED' && 
        order.status !== 'PICKED_UP'
      );
      const totalOrders = activeOrders.length;
      const totalHours = activeOrders.reduce((sum, order) => sum + (order.estimatedHours || 0), 0);
      const averageComplexity = totalHours / totalOrders || 0;

      const completedOrders = activeOrders.filter(order => order.status === 'COMPLETED');
      const onTimeOrders = completedOrders.filter(order => {
        if (!order.dueDate) return true;
        return new Date() <= order.dueDate;
      });
      const onTimePercentage = completedOrders.length > 0 ? (onTimeOrders.length / completedOrders.length) * 100 : 100;

      // Calculate status counts
      const statusCounts: Record<string, number> = {};
      activeOrders.forEach(order => {
        statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
      });

      return {
        totalOrders,
        totalHours,
        averageComplexity,
        onTimePercentage,
        statusCounts,
      };
    } catch (error) {
      console.error('Error in getWorkloadMetrics:', error);
      return {
        totalOrders: 0,
        totalHours: 0,
        averageComplexity: 0,
        onTimePercentage: 100,
        statusCounts: {},
      };
    }
  }
}

export const storage = new DatabaseStorage();
