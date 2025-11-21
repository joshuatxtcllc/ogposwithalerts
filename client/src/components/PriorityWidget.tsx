
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { PRIORITY_LEVELS } from '@/lib/constants';
import { getPriorityDistribution, getHighPriorityOrders, sortByPriority } from '@/lib/priorityUtils';
import type { OrderWithDetails } from '@shared/schema';

interface PriorityWidgetProps {
  orders: OrderWithDetails[];
}

export default function PriorityWidget({ orders }: PriorityWidgetProps) {
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const distribution = getPriorityDistribution(orders);
  const highPriorityOrders = getHighPriorityOrders(orders);
  const urgentOrders = orders.filter(order => order.priority === 'URGENT');

  const batchUpdatePriority = useMutation({
    mutationFn: async ({ orderIds, priority }: { orderIds: string[]; priority: string }) => {
      return apiRequest('/api/orders/batch-priority', {
        method: 'PATCH',
        body: { orderIds, priority },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      setSelectedOrders([]);
      setSelectedPriority('');
      toast({
        title: "Priority Updated",
        description: `Updated ${variables.orderIds.length} orders to ${variables.priority} priority.`,
      });
    },
    onError: (error) => {
      console.error('Failed to update priority:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update priority. Please try again.",
        variant: "destructive",
      });
    },
  });

  const autoAssignPriorities = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/orders/auto-assign-priorities', {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "Auto-Assignment Complete",
        description: `Updated ${data.updatedCount} orders based on due dates and status.`,
      });
    },
    onError: (error) => {
      console.error('Failed to auto-assign priorities:', error);
      toast({
        title: "Auto-Assignment Failed",
        description: "Failed to auto-assign priorities. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleBulkPriorityUpdate = () => {
    if (selectedOrders.length === 0 || !selectedPriority) {
      toast({
        title: "Selection Required",
        description: "Please select orders and a priority level.",
        variant: "destructive",
      });
      return;
    }

    batchUpdatePriority.mutate({
      orderIds: selectedOrders,
      priority: selectedPriority
    });
  };

  return (
    <div className="space-y-6">
      {/* Priority Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Priority Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {distribution.map((priority) => (
              <div key={priority.value} className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-lg">{priority.icon}</span>
                  <Badge className={`${priority.bgColor} text-white`}>
                    {priority.count}
                  </Badge>
                </div>
                <div className="text-sm font-medium">{priority.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Urgent Orders Alert */}
      {urgentOrders.length > 0 && (
        <Alert className="border-red-200 bg-red-50 dark:bg-red-950">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            <strong>{urgentOrders.length} urgent orders</strong> require immediate attention!
            <div className="mt-2 space-y-1">
              {urgentOrders.slice(0, 3).map(order => (
                <div key={order.id} className="text-sm">
                  #{order.trackingId} - {order.customer?.name} 
                  {order.dueDate && (
                    <span className="ml-2 text-xs">
                      Due: {new Date(order.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
              {urgentOrders.length > 3 && (
                <div className="text-sm text-red-600">
                  ...and {urgentOrders.length - 3} more
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Priority Management Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Priority Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-assign button */}
          <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div>
              <div className="font-medium">Smart Priority Assignment</div>
              <div className="text-sm text-muted-foreground">
                Automatically assign priorities based on due dates and order status
              </div>
            </div>
            <Button 
              onClick={() => autoAssignPriorities.mutate()}
              disabled={autoAssignPriorities.isPending}
              variant="outline"
            >
              Auto-Assign
            </Button>
          </div>

          {/* Manual bulk update */}
          <div className="space-y-3">
            <div className="flex gap-3">
              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select priority level" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_LEVELS.map(level => (
                    <SelectItem key={level.value} value={level.value}>
                      <div className="flex items-center gap-2">
                        <span>{level.icon}</span>
                        <span>{level.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleBulkPriorityUpdate}
                disabled={selectedOrders.length === 0 || !selectedPriority || batchUpdatePriority.isPending}
              >
                Update {selectedOrders.length} Orders
              </Button>
            </div>

            {selectedOrders.length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {selectedOrders.length} orders selected for priority update
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedOrders([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* High Priority Orders List */}
      {highPriorityOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>High Priority Orders ({highPriorityOrders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sortByPriority(highPriorityOrders).map((order) => {
                const priorityConfig = PRIORITY_LEVELS.find(p => p.value === order.priority);
                return (
                  <div 
                    key={order.id} 
                    className={`p-3 rounded-lg border-l-4 ${priorityConfig?.borderColor} bg-gray-50 dark:bg-gray-800`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(order.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOrders(prev => [...prev, order.id]);
                            } else {
                              setSelectedOrders(prev => prev.filter(id => id !== order.id));
                            }
                          }}
                          className="rounded"
                        />
                        <div>
                          <div className="font-medium">#{order.trackingId}</div>
                          <div className="text-sm text-muted-foreground">
                            {order.customer?.name} - {order.description}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${priorityConfig?.bgColor} text-white`}>
                          {priorityConfig?.icon} {priorityConfig?.label}
                        </Badge>
                        <Badge variant="outline">
                          {order.status?.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
