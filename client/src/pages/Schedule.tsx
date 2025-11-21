import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OrderWithDetails } from '@shared/schema';
import { Calendar, Clock, Package, User, AlertTriangle, CheckCircle } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, isSameDay, isToday, isPast } from 'date-fns';

export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  const { data: orders = [], isLoading } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders"],
  });

  // Get orders for the current view period
  const getOrdersForDate = (date: Date) => {
    return orders.filter(order => isSameDay(new Date(order.dueDate), date));
  };

  const getWeekDays = () => {
    const start = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const getOrderPriority = (order: OrderWithDetails) => {
    const dueDate = new Date(order.dueDate);
    const now = new Date();
    
    if (isPast(dueDate) && order.status !== 'PICKED_UP') return 'overdue';
    if (isSameDay(dueDate, now)) return 'today';
    if (dueDate <= addDays(now, 3)) return 'urgent';
    return 'normal';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      case 'today': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'urgent': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'PICKED_UP') return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (['COMPLETED', 'READY_FOR_PICKUP'].includes(status)) return <Clock className="h-4 w-4 text-blue-600" />;
    return <Package className="h-4 w-4 text-gray-600" />;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Navigation />
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading schedule...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Navigation />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Production Schedule</h1>
          <p className="text-muted-foreground">View and manage order due dates and deadlines</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={viewMode} onValueChange={(value: 'week' | 'month') => setViewMode(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week View</SelectItem>
              <SelectItem value="month">Month View</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            onClick={() => setSelectedDate(new Date())}
          >
            Today
          </Button>
        </div>
      </div>

      {/* Schedule Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {['overdue', 'today', 'urgent', 'normal'].map(priority => {
          const priorityOrders = orders.filter(order => getOrderPriority(order) === priority);
          const labels = {
            overdue: 'Overdue',
            today: 'Due Today',
            urgent: 'Due Soon',
            normal: 'On Track'
          };
          
          return (
            <Card key={priority}>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  {priority === 'overdue' && <AlertTriangle className="h-5 w-5 text-red-500" />}
                  {priority === 'today' && <Clock className="h-5 w-5 text-orange-500" />}
                  {priority === 'urgent' && <Calendar className="h-5 w-5 text-yellow-500" />}
                  {priority === 'normal' && <CheckCircle className="h-5 w-5 text-green-500" />}
                  <div>
                    <div className="text-2xl font-bold">{priorityOrders.length}</div>
                    <div className="text-sm text-muted-foreground">{labels[priority as keyof typeof labels]}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Week View */}
      {viewMode === 'week' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Week of {format(startOfWeek(selectedDate), 'MMM d, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              {getWeekDays().map(day => {
                const dayOrders = getOrdersForDate(day);
                const isCurrentDay = isToday(day);
                
                return (
                  <div key={day.toISOString()} className={`space-y-2 ${isCurrentDay ? 'bg-blue-50 p-3 rounded-lg' : ''}`}>
                    <div className="font-semibold text-sm">
                      {format(day, 'EEE d')}
                      {isCurrentDay && <Badge className="ml-2 text-xs">Today</Badge>}
                    </div>
                    
                    {dayOrders.length === 0 ? (
                      <div className="text-xs text-muted-foreground py-2">No orders due</div>
                    ) : (
                      <div className="space-y-2">
                        {dayOrders.map(order => {
                          const priority = getOrderPriority(order);
                          
                          return (
                            <div
                              key={order.id}
                              className={`p-2 rounded text-xs border ${getPriorityColor(priority)}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">#{order.trackingId}</span>
                                {getStatusIcon(order.status || '')}
                              </div>
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span className="truncate">{order.customer?.name || 'Unknown'}</span>
                              </div>
                              <div className="text-xs opacity-75 mt-1">
                                ${order.price.toLocaleString()} • {order.orderType}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Orders List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Upcoming Orders (Next 14 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {orders
              .filter(order => {
                const dueDate = new Date(order.dueDate);
                const now = new Date();
                const twoWeeks = addDays(now, 14);
                return dueDate >= now && dueDate <= twoWeeks && order.status !== 'PICKED_UP';
              })
              .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
              .slice(0, 10)
              .map(order => {
                const priority = getOrderPriority(order);
                
                return (
                  <div
                    key={order.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${getPriorityColor(priority)}`}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(order.status || '')}
                      <div>
                        <div className="font-medium">#{order.trackingId}</div>
                        <div className="text-sm opacity-75">{order.customer?.name || 'Unknown Customer'}</div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-medium">{format(new Date(order.dueDate), 'MMM d')}</div>
                      <div className="text-sm opacity-75">${order.price.toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            
            {orders.filter(order => {
              const dueDate = new Date(order.dueDate);
              const now = new Date();
              const twoWeeks = addDays(now, 14);
              return dueDate >= now && dueDate <= twoWeeks && order.status !== 'PICKED_UP';
            }).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No upcoming orders in the next 14 days
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
