import OpenAI from "openai";
import { storage } from "../storage";
import type { WorkloadAnalysis, AIMessage, OrderWithDetails } from "@shared/schema";

export class AIService {
  private openai: OpenAI | null = null;
  private providers: { openai: boolean; anthropic: boolean; perplexity: boolean } = {
    openai: false,
    anthropic: false,
    perplexity: false
  };

  constructor() {
    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      try {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        this.providers.openai = true;
        console.log('✓ OpenAI client initialized');
      } catch (error) {
        console.error('✗ OpenAI initialization failed:', error);
      }
    }

    // For now, we'll focus on OpenAI only to avoid startup issues
    console.log('AI Service initialized with providers:', this.providers);

    if (!this.providers.openai) {
      console.warn('⚠️  No AI providers available! Add OPENAI_API_KEY to enable AI features');
    }
  }

  async generateWorkloadAnalysis(): Promise<WorkloadAnalysis> {
    try {
      const orders = await storage.getOrders();
      const activeOrders = orders.filter(order => 
        !['COMPLETED', 'PICKED_UP'].includes(order.status || '')
      );

      // Calculate basic metrics
      const totalOrders = activeOrders.length;
      const totalHours = activeOrders.reduce((sum, order) => sum + (order.estimatedHours || 0), 0);
      const averageComplexity = activeOrders.length > 0 
        ? activeOrders.reduce((sum, order) => sum + (order.complexity || 5), 0) / activeOrders.length 
        : 5;

      // Calculate status distribution
      const statusCounts: Record<string, number> = {};
      activeOrders.forEach(order => {
        const status = order.status || 'UNKNOWN';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      // Calculate on-time percentage
      const now = new Date();
      const overdueOrders = activeOrders.filter(order => 
        order.dueDate && new Date(order.dueDate) < now
      );
      const onTimePercentage = activeOrders.length > 0 
        ? Math.round(((activeOrders.length - overdueOrders.length) / activeOrders.length) * 100)
        : 100;

      // Generate basic recommendations
      const recommendations: string[] = [];
      if (overdueOrders.length > 0) {
        recommendations.push(`${overdueOrders.length} orders are overdue and need immediate attention`);
      }
      if (statusCounts['ORDER_PROCESSED'] > 5) {
        recommendations.push('High number of unprocessed orders - consider prioritizing material ordering');
      }
      if (totalHours > 200) {
        recommendations.push('High workload detected - consider adjusting schedules or priorities');
      }

      // Generate alerts
      const alerts: AIMessage[] = [];
      if (overdueOrders.length > 0) {
        alerts.push({
          id: `overdue_${Date.now()}`,
          type: 'overdue',
          severity: 'high',
          title: 'Overdue Orders',
          content: `${overdueOrders.length} orders are past their due date`,
          timestamp: new Date(),
          metadata: { count: overdueOrders.length }
        });
      }

      const analysis: WorkloadAnalysis = {
        totalOrders,
        totalHours,
        averageComplexity,
        onTimePercentage,
        statusCounts,
        bottlenecks: this.identifyBottlenecks(statusCounts),
        riskLevel: this.calculateRiskLevel(overdueOrders.length, totalOrders),
        totalWorkload: totalHours,
        alerts,
        aiInsights: this.generateAIInsights(activeOrders),
        recommendations,
        timestamp: new Date().toISOString()
      };

      return analysis;
    } catch (error) {
      console.error('Error generating workload analysis:', error);
      return this.generateFallbackAnalysis();
    }
  }

  async generateAlerts(): Promise<AIMessage[]> {
    try {
      const orders = await storage.getOrders();
      const alerts: AIMessage[] = [];
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
          title: 'Overdue Orders',
          content: `${overdueOrders.length} orders are past their due date`,
          timestamp: new Date(),
          metadata: { count: overdueOrders.length }
        });
      }

      // Check for high priority orders due soon
      const urgentOrders = orders.filter(order => 
        order.dueDate && 
        new Date(order.dueDate) <= new Date(Date.now() + 24 * 60 * 60 * 1000) &&
        order.priority === 'HIGH' &&
        !['COMPLETED', 'PICKED_UP'].includes(order.status || '')
      );

      if (urgentOrders.length > 0) {
        alerts.push({
          id: `urgent_${Date.now()}`,
          type: 'urgent',
          severity: 'medium',
          title: 'High Priority Orders Due Soon',
          content: `${urgentOrders.length} high priority orders are due within 24 hours`,
          timestamp: new Date(),
          metadata: { count: urgentOrders.length }
        });
      }

      return alerts;
    } catch (error) {
      console.error('Error generating alerts:', error);
      return [];
    }
  }

  async generateChatResponse(userMessage: string, sessionId?: string): Promise<string> {
    if (!this.openai) {
      return "AI chat is currently unavailable. Please add your OpenAI API key to enable this feature.";
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant for a custom frame shop management system. Help with order management, workflow optimization, and general framing questions."
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      return response.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
      console.error('Error generating chat response:', error);
      return "I'm having trouble responding right now. Please try again later.";
    }
  }

  private identifyBottlenecks(statusCounts: Record<string, number>): string[] {
    const bottlenecks: string[] = [];
    
    if (statusCounts['ORDER_PROCESSED'] > 10) {
      bottlenecks.push('Order Processing - High number of unprocessed orders');
    }
    if (statusCounts['MATERIALS_ORDERED'] > 8) {
      bottlenecks.push('Material Delivery - Many orders waiting for materials');
    }
    if (statusCounts['FRAME_CUT'] > 5) {
      bottlenecks.push('Frame Cutting - Backlog in cutting operations');
    }

    return bottlenecks;
  }

  private calculateRiskLevel(overdueCount: number, totalOrders: number): 'low' | 'medium' | 'high' {
    if (totalOrders === 0) return 'low';
    const overduePercentage = (overdueCount / totalOrders) * 100;
    
    if (overduePercentage > 20) return 'high';
    if (overduePercentage > 10) return 'medium';
    return 'low';
  }

  private generateAIInsights(orders: any[]): string {
    const insights = [];
    
    if (orders.length === 0) {
      return "No active orders in the system.";
    }

    const statusGroups = orders.reduce((acc, order) => {
      const status = order.status || 'UNKNOWN';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const maxStatus = Object.entries(statusGroups).reduce((a, b) => 
      statusGroups[a[0]] > statusGroups[b[0]] ? a : b
    );

    insights.push(`Most orders are currently in ${maxStatus[0]} stage (${maxStatus[1]} orders)`);

    const avgComplexity = orders.reduce((sum, order) => sum + (order.complexity || 5), 0) / orders.length;
    if (avgComplexity > 7) {
      insights.push("Current workload has high complexity orders that may require additional time");
    }

    return insights.join('. ');
  }

  private generateFallbackAnalysis(): WorkloadAnalysis {
    return {
      totalOrders: 0,
      totalHours: 0,
      averageComplexity: 5,
      onTimePercentage: 100,
      statusCounts: {},
      bottlenecks: [],
      riskLevel: 'low',
      totalWorkload: 0,
      alerts: [],
      aiInsights: "Unable to generate AI insights at this time",
      recommendations: ["System is operating normally"],
      timestamp: new Date().toISOString()
    };
  }
}
