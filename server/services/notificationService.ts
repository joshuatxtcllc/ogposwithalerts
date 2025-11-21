import { storage } from "../storage";
import type { InsertNotification } from "@shared/schema";

export class NotificationService {
  async sendNotification(notification: InsertNotification) {
    try {
      const created = await storage.createNotification(notification);
      console.log(`Notification queued: ${created.id}`);

      // In a real implementation, this would actually send the notification
      // via email/SMS based on the channel

      return created;
    } catch (error) {
      console.error("Failed to send notification:", error);
      throw error;
    }
  }

  async processPendingNotifications() {
    try {
      const pending = await storage.getPendingNotifications();
      console.log(`Processing ${pending.length} pending notifications`);

      for (const notification of pending) {
        try {
          // Simulate sending
          console.log(`Sending ${notification.channel} notification to ${notification.customerId}`);

          await storage.updateNotification(notification.id, {
            status: 'SENT'
          });
        } catch (error) {
          console.error(`Failed to send notification ${notification.id}:`, error);
          await storage.updateNotification(notification.id, {
            status: 'FAILED'
          });
        }
      }
    } catch (error) {
      console.error("Failed to process pending notifications:", error);
    }
  }
}
