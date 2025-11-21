
import { storage } from "../storage";
import { db } from "../db";
import { orders, materialOrderHistory } from "../../shared/schema";
import { eq, and, gte } from "drizzle-orm";
import { randomUUID } from "crypto";

interface OrderingAttempt {
  orderId: string;
  materials: string[];
  authorizedBy?: string;
  timestamp: Date;
  bypassed: boolean;
  reason?: string;
}

interface DuplicateOrderCheck {
  isDuplicate: boolean;
  existingOrders: any[];
  requiresOverride: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class MaterialOrderingService {
  private static readonly MANAGEMENT_OVERRIDE_CODE = 'MGMT_OVERRIDE_2025_MATERIALS';
  private static readonly DUPLICATE_THRESHOLD_HOURS = 24;
  private static readonly MAX_DAILY_ORDERS_PER_VENDOR = 5;

  // Check for duplicate material orders
  async checkDuplicateOrders(orderIds: string[]): Promise<DuplicateOrderCheck> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - this.DUPLICATE_THRESHOLD_HOURS);

      // Get recent material ordering history
      const recentOrders = await db
        .select()
        .from(materialOrderHistory)
        .where(gte(materialOrderHistory.orderedAt, cutoffTime));

      // Check for exact order ID matches
      const duplicateOrderIds = orderIds.filter(orderId => 
        recentOrders.some(order => order.orderId === orderId)
      );

      // Check for similar material patterns
      const orderDetails = await Promise.all(
        orderIds.map(id => storage.getOrder(id))
      );

      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      let requiresOverride = false;

      if (duplicateOrderIds.length > 0) {
        riskLevel = 'CRITICAL';
        requiresOverride = true;
      } else if (this.checkSimilarMaterials(orderDetails, recentOrders)) {
        riskLevel = 'HIGH';
        requiresOverride = true;
      } else if (this.checkVendorOrderLimits(orderDetails, recentOrders)) {
        riskLevel = 'MEDIUM';
        requiresOverride = true;
      }

      return {
        isDuplicate: duplicateOrderIds.length > 0,
        existingOrders: recentOrders.filter(order => 
          duplicateOrderIds.includes(order.orderId)
        ),
        requiresOverride,
        riskLevel
      };

    } catch (error) {
      console.error('Duplicate order check failed:', error);
      return {
        isDuplicate: false,
        existingOrders: [],
        requiresOverride: true, // Fail safe - require override on error
        riskLevel: 'CRITICAL'
      };
    }
  }

  // Verify management authorization
  async verifyManagementAuthorization(
    overrideCode: string, 
    userId: string, 
    reason: string
  ): Promise<boolean> {
    try {
      // Check override code
      if (overrideCode !== MaterialOrderingService.MANAGEMENT_OVERRIDE_CODE) {
        console.log(`❌ Invalid override code attempted by user: ${userId}`);
        return false;
      }

      // Log the override attempt
      await this.logOverrideAttempt(userId, reason, true);
      
      console.log(`✅ Management override authorized by: ${userId}, Reason: ${reason}`);
      return true;

    } catch (error) {
      console.error('Management authorization failed:', error);
      await this.logOverrideAttempt(userId, reason, false);
      return false;
    }
  }

  // Process material order with failsafe checks
  async processMaterialOrder(
    orderIds: string[], 
    userId: string, 
    overrideCode?: string, 
    overrideReason?: string
  ): Promise<{
    success: boolean;
    message: string;
    requiresOverride?: boolean;
    duplicateCheck?: DuplicateOrderCheck;
  }> {
    try {
      console.log(`🔍 Processing material order for ${orderIds.length} orders by user: ${userId}`);

      // Step 1: Check for duplicates
      const duplicateCheck = await this.checkDuplicateOrders(orderIds);

      // Step 2: If override required but not provided
      if (duplicateCheck.requiresOverride && !overrideCode) {
        console.log(`⚠️ Material ordering blocked - management override required`);
        return {
          success: false,
          message: `MANAGEMENT OVERRIDE REQUIRED: ${duplicateCheck.riskLevel} risk detected. ${duplicateCheck.isDuplicate ? 'Duplicate orders found.' : 'Similar orders recently placed.'}`,
          requiresOverride: true,
          duplicateCheck
        };
      }

      // Step 3: If override provided, verify it
      if (duplicateCheck.requiresOverride && overrideCode) {
        const authorized = await this.verifyManagementAuthorization(
          overrideCode, 
          userId, 
          overrideReason || 'Material ordering override'
        );

        if (!authorized) {
          console.log(`❌ Unauthorized override attempt by user: ${userId}`);
          return {
            success: false,
            message: 'UNAUTHORIZED: Invalid management override code',
            requiresOverride: true,
            duplicateCheck
          };
        }
      }

      // Step 4: Process the orders
      const results = await Promise.all(
        orderIds.map(async (orderId) => {
          try {
            // Update order status
            await storage.updateOrder(orderId, { 
              status: 'MATERIALS_ORDERED',
              updatedAt: new Date()
            });

            // Log the material order
            await this.logMaterialOrder(orderId, userId, overrideCode ? true : false);

            return { orderId, success: true };
          } catch (error) {
            console.error(`Failed to process order ${orderId}:`, error);
            return { orderId, success: false, error: error.message };
          }
        })
      );

      const successfulOrders = results.filter(r => r.success);
      const failedOrders = results.filter(r => !r.success);

      console.log(`✅ Successfully processed ${successfulOrders.length}/${orderIds.length} material orders`);

      return {
        success: successfulOrders.length > 0,
        message: `Successfully ordered materials for ${successfulOrders.length} orders${failedOrders.length > 0 ? `, ${failedOrders.length} failed` : ''}${overrideCode ? ' (Management Override Used)' : ''}`,
        duplicateCheck
      };

    } catch (error) {
      console.error('Material ordering process failed:', error);
      return {
        success: false,
        message: 'Material ordering failed due to system error',
        duplicateCheck: {
          isDuplicate: false,
          existingOrders: [],
          requiresOverride: true,
          riskLevel: 'CRITICAL'
        }
      };
    }
  }

  // Check for similar materials in recent orders
  private checkSimilarMaterials(newOrders: any[], recentOrders: any[]): boolean {
    for (const newOrder of newOrders) {
      if (!newOrder) continue;
      
      const newOrderMaterials = this.extractMaterialsFromNotes(newOrder.notes || '');
      
      for (const recentOrder of recentOrders) {
        const recentOrderDetails = recentOrder.orderDetails ? JSON.parse(recentOrder.orderDetails) : {};
        const recentMaterials = recentOrderDetails.materials || [];
        
        const similarity = this.calculateMaterialSimilarity(newOrderMaterials, recentMaterials);
        if (similarity > 0.8) { // 80% similar
          return true;
        }
      }
    }
    return false;
  }

  // Check vendor ordering limits
  private checkVendorOrderLimits(newOrders: any[], recentOrders: any[]): boolean {
    const vendorCounts = new Map<string, number>();
    
    // Count recent orders by vendor
    recentOrders.forEach(order => {
      const details = order.orderDetails ? JSON.parse(order.orderDetails) : {};
      const vendor = details.vendor || 'Unknown';
      vendorCounts.set(vendor, (vendorCounts.get(vendor) || 0) + 1);
    });

    // Check if new orders would exceed limits
    for (const order of newOrders) {
      if (!order) continue;
      
      const materials = this.extractMaterialsFromNotes(order.notes || '');
      const vendors = materials.map(m => m.vendor).filter(Boolean);
      
      for (const vendor of vendors) {
        const currentCount = vendorCounts.get(vendor) || 0;
        if (currentCount >= MaterialOrderingService.MAX_DAILY_ORDERS_PER_VENDOR) {
          return true;
        }
      }
    }
    
    return false;
  }

  // Extract materials from order notes
  private extractMaterialsFromNotes(notes: string): Array<{vendor: string, item: string}> {
    const materials = [];
    
    // Roma Moulding
    const romaMatch = notes.match(/Frame: (R\d+)/);
    if (romaMatch) materials.push({ vendor: 'Roma Moulding', item: romaMatch[1] });
    
    // Larson Juhl
    const larsonMatch = notes.match(/Frame: (L\d+)/);
    if (larsonMatch) materials.push({ vendor: 'Larson Juhl', item: larsonMatch[1] });
    
    // Crescent
    const crescentMatch = notes.match(/Mat: (C\d+)/);
    if (crescentMatch) materials.push({ vendor: 'Crescent', item: crescentMatch[1] });
    
    // Glass
    if (notes.includes('Museum Glass')) materials.push({ vendor: 'Guardian Glass', item: 'Museum Glass' });
    
    return materials;
  }

  // Calculate similarity between material lists
  private calculateMaterialSimilarity(materials1: any[], materials2: any[]): number {
    if (materials1.length === 0 && materials2.length === 0) return 0;
    if (materials1.length === 0 || materials2.length === 0) return 0;
    
    const set1 = new Set(materials1.map(m => `${m.vendor}:${m.item}`));
    const set2 = new Set(materials2.map(m => `${m.vendor}:${m.item}`));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  // Log material order
  private async logMaterialOrder(orderId: string, userId: string, wasOverridden: boolean): Promise<void> {
    try {
      await db.insert(materialOrderHistory).values({
        id: randomUUID(),
        orderId,
        orderedBy: userId,
        orderedAt: new Date(),
        wasOverridden,
        orderDetails: JSON.stringify({
          timestamp: new Date().toISOString(),
          userId,
          wasOverridden
        })
      });
    } catch (error) {
      console.error('Failed to log material order:', error);
    }
  }

  // Log override attempts
  private async logOverrideAttempt(userId: string, reason: string, successful: boolean): Promise<void> {
    console.log(`${successful ? '✅' : '❌'} Management override ${successful ? 'authorized' : 'denied'} for user: ${userId}, Reason: ${reason}`);
    // Additional logging could be added here for audit trails
  }

  // Get recent ordering activity
  async getRecentOrderingActivity(hours: number = 24): Promise<any[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours);

    return await db
      .select()
      .from(materialOrderHistory)
      .where(gte(materialOrderHistory.orderedAt, cutoffTime));
  }
}

export const materialOrderingService = new MaterialOrderingService();
