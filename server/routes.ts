import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { 
  insertOrderSchema, 
  insertCustomerSchema, 
  insertMaterialSchema,
  insertNotificationSchema,
  type Order,
  type Customer,
  type OrderWithDetails,
  type WorkloadAnalysis 
} from "@shared/schema";
import { randomUUID } from "crypto";
import { smsIntegration, posIntegration, dashboardIntegration } from "./integrations";
import { AIService } from "./services/aiService";
import { NotificationService } from "./services/notificationService";
import { TwilioVoiceService } from './services/twilioVoiceService';
import multer from 'multer';
import { artworkManager } from './artwork-manager';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize AI Service
const aiService = new AIService();

interface WebSocketMessage {
  type: string;
  data: any;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      if (req.session.user) {
        res.json(req.session.user);
      } else {
        res.status(401).json({ message: 'Unauthorized' });
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Twilio Voice API endpoints
  app.post('/api/twilio/call/order-ready/:orderId', isAuthenticated, async (req, res) => {
    try {
      const { orderId } = req.params;
      const order = await storage.getOrder(orderId);

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (!order.customer.phone) {
        return res.status(400).json({ error: 'Customer phone number not available' });
      }

      const result = await TwilioVoiceService.notifyOrderReady(
        order.customer.phone,
        order.trackingId,
        order.customer.name
      );

      if (result.success) {
        // Log the call in order history
        await storage.addOrderStatusHistory(orderId, {
          fromStatus: order.status,
          toStatus: order.status,
          reason: `Voice call made to customer about order ready for pickup (Call SID: ${result.callSid})`,
          userId: req.session.userId!
        });

        res.json({ 
          success: true, 
          message: 'Call initiated successfully',
          callSid: result.callSid 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: result.error 
        });
      }
    } catch (error) {
      console.error('Error making order ready call:', error);
      res.status(500).json({ error: 'Failed to make call' });
    }
  });

  app.post('/api/twilio/call/overdue/:orderId', isAuthenticated, async (req, res) => {
    try {
      const { orderId } = req.params;
      const { daysPastDue } = req.body;
      const order = await storage.getOrder(orderId);

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (!order.customer.phone) {
        return res.status(400).json({ error: 'Customer phone number not available' });
      }

      const result = await TwilioVoiceService.notifyOverduePickup(
        order.customer.phone,
        order.trackingId,
        order.customer.name,
        daysPastDue || 7
      );

      if (result.success) {
        await storage.addOrderStatusHistory(orderId, {
          fromStatus: order.status,
          toStatus: order.status,
          reason: `Overdue pickup reminder call made (Call SID: ${result.callSid})`,
          userId: req.session.userId!
        });

        res.json({ 
          success: true, 
          message: 'Overdue call initiated successfully',
          callSid: result.callSid 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: result.error 
        });
      }
    } catch (error) {
      console.error('Error making overdue call:', error);
      res.status(500).json({ error: 'Failed to make call' });
    }
  });

  app.post('/api/twilio/call/delay/:orderId', isAuthenticated, async (req, res) => {
    try {
      const { orderId } = req.params;
      const { newDueDate, reason } = req.body;
      const order = await storage.getOrder(orderId);

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (!order.customer.phone) {
        return res.status(400).json({ error: 'Customer phone number not available' });
      }

      const result = await TwilioVoiceService.notifyOrderDelay(
        order.customer.phone,
        order.trackingId,
        order.customer.name,
        newDueDate,
        reason || 'material availability'
      );

      if (result.success) {
        await storage.addOrderStatusHistory(orderId, {
          fromStatus: order.status,
          toStatus: order.status,
          reason: `Delay notification call made: ${reason} (Call SID: ${result.callSid})`,
          userId: req.session.userId!
        });

        res.json({ 
          success: true, 
          message: 'Delay notification call initiated successfully',
          callSid: result.callSid 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: result.error 
        });
      }
    } catch (error) {
      console.error('Error making delay call:', error);
      res.status(500).json({ error: 'Failed to make call' });
    }
  });

  app.post('/api/twilio/call/custom', isAuthenticated, async (req, res) => {
    try {
      const { phone, message } = req.body;

      if (!phone || !message) {
        return res.status(400).json({ error: 'Phone number and message are required' });
      }

      const result = await TwilioVoiceService.makeCustomCall(phone, message);

      if (result.success) {
        res.json({ 
          success: true, 
          message: 'Custom call initiated successfully',
          callSid: result.callSid 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: result.error 
        });
      }
    } catch (error) {
      console.error('Error making custom call:', error);
      res.status(500).json({ error: 'Failed to make call' });
    }
  });

  app.get('/api/twilio/test', isAuthenticated, async (req, res) => {
    try {
      const result = await TwilioVoiceService.testConnection();
      res.json(result);
    } catch (error) {
      console.error('Error testing Twilio connection:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to test Twilio connection' 
      });
    }
  });

  app.get('/api/twilio/calls', isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const calls = await TwilioVoiceService.getCallLogs(start, end);
      res.json({ success: true, calls });
    } catch (error) {
      console.error('Error fetching call logs:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch call logs' 
      });
    }
  });

  // Twilio webhooks for call status and recordings
  app.post('/api/webhooks/twilio/status', async (req, res) => {
    try {
      const { CallSid, CallStatus, From, To, CallDuration } = req.body;
      console.log(`📞 Call ${CallSid} status: ${CallStatus} (${From} → ${To})`);

      if (CallDuration) {
        console.log(`📞 Call duration: ${CallDuration} seconds`);
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Error processing call status webhook:', error);
      res.status(500).send('Error');
    }
  });

  app.post('/api/webhooks/twilio/recording', async (req, res) => {
    try {
      const { RecordingSid, RecordingUrl, CallSid } = req.body;
      console.log(`🎙️ Recording available for call ${CallSid}: ${RecordingUrl}`);

      res.status(200).send('OK');
    } catch (error) {
      console.error('Error processing recording webhook:', error);
      res.status(500).send('Error');
    }
  });

  // Test route for connection verification
  app.get('/api/test/auth', isAuthenticated, (req, res) => {
    res.json({ success: true, message: 'Hub connection authenticated successfully' });
  });

  // Customer routes
  app.get('/api/customers', isAuthenticated, async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      res.status(500).json({ message: 'Failed to fetch customers' });
    }
  });

  app.post('/api/customers', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);

      // Check if customer already exists by email
      if (validatedData.email) {
        const existingCustomer = await storage.getCustomerByEmail(validatedData.email);
        if (existingCustomer) {
          return res.status(409).json({ 
            message: 'A customer with this email already exists',
            customer: existingCustomer
          });
        }
      }

      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      console.error('Error creating customer:', error);
      res.status(500).json({ message: 'Failed to create customer' });
    }
  });

  // Order routes
  app.get('/api/orders', isAuthenticated, async (req, res) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ message: 'Failed to fetch orders' });
    }
  });

  app.get('/api/orders/:id', isAuthenticated, async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      res.json(order);
    } catch (error) {
      console.error('Error fetching order:', error);
      res.status(500).json({ message: 'Failed to fetch order' });
    }
  });

  app.post('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      console.log('Order creation request received:', req.body);

      // Validate required fields first
      if (!req.body.customerId) {
        return res.status(400).json({ 
          success: false,
          message: 'Customer ID is required'
        });
      }

      if (!req.body.description) {
        return res.status(400).json({ 
          success: false,
          message: 'Order description is required'
        });
      }

      if (!req.body.dueDate) {
        return res.status(400).json({ 
          success: false,
          message: 'Due date is required'
        });
      }

      // Verify customer exists before processing
      console.log('Verifying customer exists:', req.body.customerId);
      const customer = await storage.getCustomer(req.body.customerId);
      if (!customer) {
        console.log('Customer not found:', req.body.customerId);
        return res.status(400).json({ 
          success: false,
          message: 'Customer not found. Please select a valid customer.'
        });
      }
      console.log('Customer verified:', customer.name);

      // Process the request data before validation
      const orderData = {
        ...req.body,
        trackingId: `TRK-${Date.now()}`, // Generate tracking ID
        dueDate: new Date(req.body.dueDate), // Convert string to Date
        estimatedHours: parseFloat(req.body.estimatedHours) || 3,
        price: parseFloat(req.body.price) || 0,
        priority: req.body.priority || 'MEDIUM',
        status: 'ORDER_PROCESSED'
      };

      console.log('Processing order data:', orderData);

      // Validate with schema
      const validatedData = insertOrderSchema.parse(orderData);
      console.log('Order data validated successfully');

      // Create the order
      const order = await storage.createOrder(validatedData);
      console.log('Order created in storage:', order.id, order.trackingId);

      // Create initial status history
      await storage.createStatusHistory({
        orderId: order.id,
        toStatus: 'ORDER_PROCESSED',
        changedBy: req.session?.userId || 'system',
        reason: 'Order created'
      });
      console.log('Status history created');

      // Fetch the complete order with details - use getOrder since getOrderWithDetails doesn't exist
      const completeOrder = await storage.getOrder(order.id);
      console.log('Order creation completed successfully:', order.id);

      // Send notifications (non-blocking)
      try {
        await storage.createNotification({
          customerId: validatedData.customerId,
          orderId: order.id,
          type: 'ORDER_CREATED',
          channel: 'EMAIL',
          subject: 'Order Confirmation',
          content: `Your order ${order.trackingId} has been received and is being processed.`
        });
      } catch (notificationError) {
        console.error('Failed to create notification:', notificationError);
        // Don't fail the order creation if notification fails
      }

      console.log('Order saved with tracking ID:', order.trackingId);
      res.status(201).json({
        success: true,
        order: completeOrder,
        id: order.id,
        trackingId: order.trackingId,
        message: 'Order created successfully'
      });
    } catch (error) {
      console.error('Error creating order:', error);
      
      let errorMessage = 'Failed to create order';
      let statusCode = 500;

      if (error.name === 'ZodError') {
        errorMessage = `Validation error: ${error.errors.map(e => e.message).join(', ')}`;
        statusCode = 400;
      } else if (error.message.includes('foreign key')) {
        errorMessage = 'Invalid customer selection';
        statusCode = 400;
      } else if (error.message) {
        errorMessage = error.message;
      }

      res.status(statusCode).json({ 
        success: false,
        message: errorMessage,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // General order update endpoint
  app.patch('/api/orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const orderId = req.params.id;
      const updates = { ...req.body };

      // Get current order to check if it exists
      const currentOrder = await storage.getOrder(orderId);
      if (!currentOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Convert date strings to Date objects if they exist
      if (updates.dueDate && typeof updates.dueDate === 'string') {
        updates.dueDate = new Date(updates.dueDate);
      }
      if (updates.createdAt && typeof updates.createdAt === 'string') {
        updates.createdAt = new Date(updates.createdAt);
      }
      if (updates.updatedAt && typeof updates.updatedAt === 'string') {
        updates.updatedAt = new Date(updates.updatedAt);
      }
      if (updates.artworkReceivedDate && typeof updates.artworkReceivedDate === 'string') {
        updates.artworkReceivedDate = new Date(updates.artworkReceivedDate);
      }

      // If status is being updated, create status history entry
      if (updates.status && updates.status !== currentOrder.status) {
        await storage.createStatusHistory({
          orderId: orderId,
          fromStatus: currentOrder.status,
          toStatus: updates.status,
          changedBy: req.session?.user?.id || 'system'
        });
      }

      // Update the order with all provided fields
      const updatedOrder = await storage.updateOrder(orderId, updates);

      // Get the complete updated order
      const completeOrder = await storage.getOrder(orderId);

      res.json(completeOrder);
    } catch (error) {
      console.error('Error updating order:', error);
      res.status(500).json({ message: 'Failed to update order' });
    }
  });

  app.patch('/api/orders/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const { status } = req.body;
      const orderId = req.params.id;

      // Get current order to track status change
      const currentOrder = await storage.getOrder(orderId);
      if (!currentOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Update order status
      const updatedOrder = await storage.updateOrder(orderId, { status });

      // Create status history entry
      await storage.createStatusHistory({
        orderId: orderId,
        fromStatus: currentOrder.status,
        toStatus: status,
        changedBy: req.session?.user?.id || 'system'
      });

      // Get the complete updated order for notifications
      const completeOrder = await storage.getOrder(orderId);

      // Initialize notification service
      const notificationService = new NotificationService();

      // Send status update notifications (async, don't block response)
      if (completeOrder) {
        notificationService.sendStatusUpdate(completeOrder).catch(error => {
          console.error('Failed to send status update notifications:', error);
        });
      }

      res.json(completeOrder);
    } catch (error) {
      console.error('Error updating order status:', error);
      res.status(500).json({ message: 'Failed to update order status' });
    }
  });

  // Material routes
  app.get('/api/orders/:orderId/materials', isAuthenticated, async (req, res) => {
    try {
      const materials = await storage.getMaterialsByOrder(req.params.orderId);
      res.json(materials);
    } catch (error) {
      console.error('Error fetching materials:', error);
      res.status(500).json({ message: 'Failed to fetch materials' });
    }
  });

  app.post('/api/orders/:orderId/materials', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertMaterialSchema.parse({
        ...req.body,
        orderId: req.params.orderId
      });

      const material = await storage.createMaterial(validatedData);
      res.status(201).json(material);
    } catch (error) {
      console.error('Error creating material:', error);
      res.status(500).json({ message: 'Failed to create material' });
    }
  });

  // Analytics routes
  app.get('/api/analytics/workload', isAuthenticated, async (req, res) => {
    try {
      const workload = await storage.getWorkloadMetrics();
      res.json(workload);
    } catch (error) {
      console.error('Error fetching workload analysis:', error);
      res.status(500).json({ message: 'Failed to fetch workload analysis' });
    }
  });

  // AI-powered routes
  app.get('/api/ai/analysis', isAuthenticated, async (req, res) => {
    try {
      const orders = await storage.getOrders();
      const workload = await storage.getWorkloadMetrics();

      // Try to get cached analysis first
      const cachedAnalysis = await storage.getLatestAIAnalysis();
      if (cachedAnalysis && isRecentAnalysis(cachedAnalysis.createdAt)) {
        return res.json(cachedAnalysis.metrics);
      }

      try {
        const analysis = await aiService.generateWorkloadAnalysis(orders, workload);

        // Cache the analysis
        await storage.saveAIAnalysis({
          metrics: analysis,
          alerts: analysis.alerts || []
        });

        res.json(analysis);
      } catch (aiError) {
        console.error('Error generating AI analysis:', aiError);
        // Return basic workload data if AI fails
        res.json(workload);
      }
    } catch (error) {
      console.error('Error in AI analysis route:', error);
      res.status(500).json({ message: 'Failed to generate analysis' });
    }
  });

  app.get('/api/ai/alerts', isAuthenticated, async (req, res) => {
    try {
      const orders = await storage.getOrders();
      const workload = await storage.getWorkloadMetrics();

      try {
        const alerts = await aiService.generateAlerts(orders, workload);
        res.json({ alerts });
      } catch (aiError) {
        console.error('Error generating AI alerts:', aiError);
        // Return basic alerts if AI fails
        const basicAlerts = generateBasicAlerts(orders);
        res.json({ alerts: basicAlerts });
      }
    } catch (error) {
      console.error('Error fetching AI alerts:', error);
      res.status(500).json({ message: 'Failed to fetch alerts' });
    }
  });

  // Integration routes
  app.get('/api/integrations/status', isAuthenticated, async (req, res) => {
    try {
      const twilioStatus = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);

      const status = {
        sms: true, // SMS is always available
        voice: twilioStatus, // Twilio voice calls
        pos: await posIntegration.checkConnection(),
        dashboard: true // Dashboard integration is internal
      };
      res.json(status);
    } catch (error) {
      console.error('Error checking integration status:', error);
      res.status(500).json({ message: 'Failed to check integration status' });
    }
  });

  // POS Integration routes
  app.get('/api/pos/status', isAuthenticated, async (req, res) => {
    try {
      const isConnected = await posIntegration.checkConnection();
      const hasApiKey = !!process.env.POS_API_KEY;
      const hasUrl = !!process.env.POS_API_URL;

      res.json({
        success: isConnected,
        connected: isConnected,
        needsApiKey: !hasApiKey,
        needsUrl: !hasUrl,
        status: isConnected ? 'Connected to external POS system' : 'Waiting for external POS configuration'
      });
    } catch (error) {
      console.error('Error checking POS status:', error);
      res.status(500).json({ 
        success: false,
        connected: false,
        error: 'Failed to check POS status'
      });
    }
  });

  app.post('/api/pos/test-connection', isAuthenticated, async (req, res) => {
    try {
      const connection = await posIntegration.checkConnection();
      res.json({
        success: connection,
        message: connection 
          ? 'Successfully connected to external POS system' 
          : 'External POS system not configured'
      });
    } catch (error) {
      console.error('Error testing POS connection:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to test POS connection'
      });
    }
  });

  app.post('/api/pos/sync', isAuthenticated, async (req, res) => {
    try {
      const newOrders = await posIntegration.fetchNewOrders();
      res.json({
        success: true,
        ordersImported: newOrders.length,
        message: `Successfully imported ${newOrders.length} new orders from POS`
      });
    } catch (error) {
      console.error('Error syncing POS orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync POS orders',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // SMS Integration routes
  app.post('/api/sms/send', isAuthenticated, async (req, res) => {
    try {
      const { orderId, message, phoneNumber } = req.body;
      await smsIntegration.sendOrderNotification(orderId, message, phoneNumber);
      res.json({ success: true, message: 'SMS sent successfully' });
    } catch (error) {
      console.error('Error sending SMS:', error);
      res.status(500).json({ message: 'Failed to send SMS' });
    }
  });

  // Voice Call Integration routes
  app.post('/api/voice/order-status', isAuthenticated, async (req, res) => {
    try {
      const { orderId, phoneNumber } = req.body;

      const order = await storage.getOrderWithDetails(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const callSid = await twilioVoiceService.makeOrderStatusCall(
        phoneNumber, 
        order.trackingId, 
        order.status
      );

      res.json({ 
        success: true, 
        message: 'Voice call initiated', 
        callSid 
      });
    } catch (error) {
      console.error('Error making voice call:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to make voice call',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/voice/order-ready', isAuthenticated, async (req, res) => {
    try {
      const { orderId } = req.body;

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      if (!order.customer.phone) {
        return res.status(400).json({ message: 'Customer phone number not available' });
      }

      const callSid = await twilioVoiceService.makeOrderReadyCall(
        order.customer.phone,
        order.trackingId,
        order.customer.name
      );

      res.json({ 
        success: true, 
        message: 'Order ready call initiated', 
        callSid 
      });
    } catch (error) {
      console.error('Error making order ready call:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to make order ready call',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/voice/custom', isAuthenticated, async (req, res) => {
    try {
      const { phoneNumber, message } = req.body;

      if (!phoneNumber || !message) {
        return res.status(400).json({ message: 'Phone number and message are required' });
      }

      const callSid = await twilioVoiceService.makeCustomCall(phoneNumber, message);

      res.json({ 
        success: true, 
        message: 'Custom voice call initiated', 
        callSid 
      });
    } catch (error) {
      console.error('Error making custom voice call:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to make custom voice call',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/voice/status/:callSid', isAuthenticated, async (req, res) => {
    try {
      const { callSid } = req.params;
      const callStatus = await twilioVoiceService.getCallStatus(callSid);
      res.json(callStatus);
    } catch (error) {
      console.error('Error fetching call status:', error);
      res.status(500).json({ message: 'Failed to fetch call status' });
    }
  });

  // Dashboard Integration routes
  app.post('/api/integrations/dashboard/sync', isAuthenticated, async (req, res) => {
    try {
      await dashboardIntegration.syncMetrics();
      res.json({ success: true, message: 'Metrics synced to dashboard' });
    } catch (error) {
      console.error('Error syncing to dashboard:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Dashboard sync failed'
      });
    }
  });

  // Artwork management routes
  app.post('/api/orders/:orderId/artwork/upload', isAuthenticated, upload.single('artwork'), async (req, res) => {
    try {
      const { orderId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: 'No artwork file provided' });
      }

      const imageUrl = await artworkManager.uploadArtworkImage(orderId, file.buffer, file.originalname);
      res.json({ success: true, imageUrl });
    } catch (error) {
      console.error('Error uploading artwork:', error);
      res.status(500).json({ message: 'Failed to upload artwork' });
    }
  });

  app.put('/api/orders/:orderId/artwork/location', isAuthenticated, async (req, res) => {
    try {
      const { orderId } = req.params;
      const { location } = req.body;

      if (!location) {
        return res.status(400).json({ message: 'Location is required' });
      }

      await artworkManager.updateArtworkLocation(orderId, location);
      res.json({ success: true, message: 'Artwork location updated' });
    } catch (error) {
      console.error('Error updating artwork location:', error);
      res.status(500).json({ message: 'Failed to update artwork location' });
    }
  });

  app.put('/api/orders/:orderId/artwork/received', isAuthenticated, async (req, res) => {
    try {
      const { orderId } = req.params;
      const { received } = req.body;

      await artworkManager.markArtworkReceived(orderId, received);
      res.json({ success: true, message: 'Artwork received status updated' });
    } catch (error) {
      console.error('Error updating artwork received status:', error);
      res.status(500).json({ message: 'Failed to update artwork received status' });
    }
  });

  app.delete('/api/orders/:orderId/artwork/:imageUrl', isAuthenticated, async (req, res) => {
    try {
      const { orderId, imageUrl } = req.params;
      const decodedImageUrl = decodeURIComponent(imageUrl);

      await artworkManager.removeArtworkImage(orderId, decodedImageUrl);
      res.json({ success: true, message: 'Artwork image removed' });
    } catch (error) {
      console.error('Error removing artwork image:', error);
      res.status(500).json({ message: 'Failed to remove artwork image' });
    }
  });

  app.get('/api/artwork/locations', isAuthenticated, async (req, res) => {
    try {
      const locations = artworkManager.getCommonLocations();
      res.json(locations);
    } catch (error) {
      console.error('Error getting artwork locations:', error);
      res.status(500).json({ message: 'Failed to get artwork locations' });
    }
  });

  app.get('/api/artwork/:filename', async (req, res) => {
    try {
      const { filename } = req.params;
      const imageBuffer = await artworkManager.getArtworkImage(filename);

      res.set('Content-Type', 'image/jpeg');
      res.send(imageBuffer);
    } catch (error) {
      console.error('Error serving artwork:', error);
      res.status(404).json({ message: 'Artwork not found' });
    }
  });

  // Webhook routes for integrations
  app.post('/api/webhooks/sms', async (req, res) => {
    try {
      await smsIntegration.handleWebhook(req, res);
    } catch (error) {
      console.error('Error handling SMS webhook:', error);
      res.status(500).json({ message: 'Failed to process SMS webhook' });
    }
  });

  app.post('/api/webhooks/pos', async (req, res) => {
    try {
      await posIntegration.handleWebhook(req, res);
    } catch (error) {
      console.error('Error handling POS webhook:', error);
      res.status(500).json({ message: 'Failed to process POS webhook' });
    }
  });

  // Search routes
  app.get('/api/orders/search', isAuthenticated, async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: 'Search query required' });
      }

      const orders = await storage.searchOrders(q);
      res.json(orders);
    } catch (error) {
      console.error('Error searching orders:', error);
      res.status(500).json({ message: 'Failed to search orders' });
    }
  });

  // Tracking route for customers
  app.get('/api/track/:trackingId', async (req, res) => {
    try {
      const { trackingId } = req.params;
      const order = await storage.getOrderByTrackingId(trackingId);

      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Return limited information for customer tracking
      res.json({
        trackingId: order.trackingId,
        status: order.status,
        dueDate: order.dueDate,
        description: order.description,
        customer: {
          name: order.customer.name
        }
      });
    } catch (error) {
      console.error('Error tracking order:', error);
      res.status(500).json({ message: 'Failed to track order' });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Diagnostic endpoints for the diagnostic dashboard
  app.get('/api/diagnostics/system-health', isAuthenticated, async (req, res) => {
    try {
      const startTime = Date.now();
      
      // Test database health
      const dbStartTime = Date.now();
      const orders = await storage.getOrders();
      const dbResponseTime = Date.now() - dbStartTime;
      
      const apiResponseTime = Date.now() - startTime;
      
      const activeOrders = orders.filter(order => 
        !['COMPLETED', 'PICKED_UP'].includes(order.status || '')
      ).length;

      // Calculate workflow throughput (orders completed in last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCompletions = orders.filter(order => 
        order.completedAt && new Date(order.completedAt) > oneHourAgo
      ).length;

      // Identify bottlenecks
      const statusCounts: Record<string, number> = {};
      orders.forEach(order => {
        const status = order.status || 'UNKNOWN';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const bottlenecks = [];
      if (statusCounts['ORDER_PROCESSED'] > 10) {
        bottlenecks.push('Order Processing - High backlog');
      }
      if (statusCounts['MATERIALS_ORDERED'] > 8) {
        bottlenecks.push('Material Delivery - Waiting for supplies');
      }

      const systemHealth = {
        database: {
          status: dbResponseTime < 100 ? 'healthy' : dbResponseTime < 500 ? 'warning' : 'error',
          responseTime: dbResponseTime,
          connections: 5, // Mock value - in production this would come from connection pool
          uptime: process.uptime().toFixed(0) + 's'
        },
        api: {
          status: apiResponseTime < 200 ? 'healthy' : apiResponseTime < 1000 ? 'warning' : 'error',
          responseTime: apiResponseTime,
          requestsPerMinute: 45, // Mock value - in production track actual requests
          errorRate: 0.5 // Mock value - track actual error rate
        },
        workflow: {
          status: bottlenecks.length === 0 ? 'healthy' : bottlenecks.length < 2 ? 'warning' : 'error',
          activeOrders,
          bottlenecks,
          throughput: recentCompletions
        },
        integrations: {
          pos: {
            connected: await posIntegration.checkConnection(),
            lastSync: new Date().toISOString() // Would track actual last sync time
          },
          sms: {
            available: !!process.env.TWILIO_AUTH_TOKEN,
            credits: 1500 // Mock value - in production check actual Twilio credits
          },
          ai: {
            available: !!process.env.OPENAI_API_KEY,
            provider: process.env.OPENAI_API_KEY ? 'OpenAI' : 'None'
          }
        }
      };

      res.json(systemHealth);
    } catch (error) {
      console.error('Error generating system health:', error);
      res.status(500).json({ message: 'Failed to generate system health data' });
    }
  });

  app.get('/api/diagnostics/workflow-metrics', isAuthenticated, async (req, res) => {
    try {
      const orders = await storage.getOrders();
      
      // Calculate stage distribution
      const stageDistribution: Record<string, number> = {};
      orders.forEach(order => {
        const status = order.status || 'UNKNOWN';
        stageDistribution[status] = (stageDistribution[status] || 0) + 1;
      });

      // Calculate average stage times (mock data for now - in production track actual times)
      const averageStageTime = {
        'ORDER_PROCESSED': 2.5,
        'MATERIALS_ORDERED': 8.0,
        'MATERIALS_ARRIVED': 1.0,
        'FRAME_CUT': 4.5,
        'MAT_CUT': 2.0,
        'PREPPED': 3.0,
        'COMPLETED': 0.5
      };

      // Identify bottleneck alerts
      const bottleneckAlerts = [];
      if (stageDistribution['ORDER_PROCESSED'] > 10) {
        bottleneckAlerts.push({
          stage: 'Order Processing',
          severity: 'high' as const,
          count: stageDistribution['ORDER_PROCESSED'],
          message: 'High number of unprocessed orders requiring immediate attention'
        });
      }
      if (stageDistribution['MATERIALS_ORDERED'] > 8) {
        bottleneckAlerts.push({
          stage: 'Material Ordering',
          severity: 'medium' as const,
          count: stageDistribution['MATERIALS_ORDERED'],
          message: 'Many orders waiting for material delivery'
        });
      }
      if (stageDistribution['FRAME_CUT'] > 5) {
        bottleneckAlerts.push({
          stage: 'Frame Cutting',
          severity: 'medium' as const,
          count: stageDistribution['FRAME_CUT'],
          message: 'Backlog in frame cutting operations'
        });
      }

      // Generate hourly throughput trend (mock data - in production track actual)
      const throughputTrend = [];
      for (let i = 5; i >= 0; i--) {
        const hour = new Date(Date.now() - i * 60 * 60 * 1000);
        throughputTrend.push({
          hour: hour.getHours() + ':00',
          completed: Math.floor(Math.random() * 5) + 1,
          started: Math.floor(Math.random() * 3) + 2
        });
      }

      const workflowMetrics = {
        stageDistribution,
        averageStageTime,
        bottleneckAlerts,
        throughputTrend
      };

      res.json(workflowMetrics);
    } catch (error) {
      console.error('Error generating workflow metrics:', error);
      res.status(500).json({ message: 'Failed to generate workflow metrics' });
    }
  });

  app.get('/api/diagnostics/alerts', isAuthenticated, async (req, res) => {
    try {
      const orders = await storage.getOrders();
      const alerts = [];
      const now = new Date();

      // Check for overdue orders
      const overdueOrders = orders.filter(order => 
        order.dueDate && new Date(order.dueDate) < now && 
        !['COMPLETED', 'PICKED_UP'].includes(order.status || '')
      );

      if (overdueOrders.length > 0) {
        alerts.push({
          id: `overdue_${Date.now()}`,
          type: 'overdue',
          severity: 'high',
          title: 'Overdue Orders Detected',
          content: `${overdueOrders.length} orders are past their due date and need immediate attention`
        });
      }

      // Check for system issues
      const activeOrders = orders.filter(order => 
        !['COMPLETED', 'PICKED_UP'].includes(order.status || '')
      );
      
      // Capacity warnings with realistic thresholds
      if (activeOrders.length > 200) {
        alerts.push({
          id: `capacity_${Date.now()}`,
          type: 'capacity',
          severity: 'high',
          title: 'High System Load',
          content: `${activeOrders.length} active orders approaching system capacity. Consider optimization.`
        });
      } else if (activeOrders.length > 150) {
        alerts.push({
          id: `capacity_${Date.now()}`,
          type: 'capacity',
          severity: 'medium',
          title: 'Moderate System Load',
          content: `${activeOrders.length} active orders. System performing well, monitor for growth.`
        });
      }

      // Check for integration issues
      const posConnected = await posIntegration.checkConnection();
      if (!posConnected) {
        alerts.push({
          id: `pos_${Date.now()}`,
          type: 'integration',
          severity: 'medium',
          title: 'POS Integration Offline',
          content: 'External POS system connection is not available. New orders may not sync automatically.'
        });
      }

      res.json(alerts);
    } catch (error) {
      console.error('Error generating diagnostic alerts:', error);
      res.status(500).json({ message: 'Failed to generate alerts' });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // WebSocket server setup
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    ws.on('message', async (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());

        switch (message.type) {
          case 'order-update':
            // Handle real-time order updates
            broadcast(wss, {
              type: 'order-updated',
              data: message.data
            });
            break;

          case 'status-change':
            // Handle status changes
            broadcast(wss, {
              type: 'status-changed', 
              data: message.data
            });
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
  });

  function broadcast(wss: WebSocketServer, message: any) {
    const messageStr = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  // Auto-sync metrics to dashboard every 5 minutes
  setInterval(async () => {
    try {
      console.log('Auto-syncing metrics to dashboard...');
      await dashboardIntegration.syncMetrics();
    } catch (error) {
      console.error('Auto-sync failed:', error);
    }
  }, 5 * 60 * 1000);

  // POS sync every 30 seconds
  setInterval(async () => {
    try {
      await posIntegration.fetchNewOrders();
    } catch (error) {
      // Silent fail for POS sync as it may not be configured
    }
  }, 30 * 1000);

  // Generate periodic AI analysis
  setInterval(async () => {
    try {
      const orders = await storage.getOrders();
      const workload = await storage.getWorkloadMetrics();
      await aiService.generateWorkloadAnalysis(orders, workload);
    } catch (error) {
      console.error('Error generating AI analysis:', error);
    }
  }, 15 * 60 * 1000); // Every 15 minutes

  return httpServer;
}

// Helper functions
function isRecentAnalysis(date: Date): boolean {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return date > fiveMinutesAgo;
}

function generateBasicAlerts(orders: OrderWithDetails[]) {
  const alerts = [];
  const now = new Date();

  // Check for overdue orders
  const overdueOrders = orders.filter(order => 
    new Date(order.dueDate) < now && 
    !['COMPLETED', 'PICKED_UP'].includes(order.status)
  );

  if (overdueOrders.length > 0) {
    alerts.push({
      id: `overdue_${randomUUID().replace(/-/g, '_')}`,
      type: 'overdue',
      severity: 'high',
      title: 'Overdue Orders',
      message: `${overdueOrders.length} orders are past their due date`,
      count: overdueOrders.length
    });
  }

  return alerts;
}
