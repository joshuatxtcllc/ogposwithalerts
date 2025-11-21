import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { OrderWithDetails } from '@shared/schema';
import { Clock, Play, Pause, Square, Calendar, BarChart3, Timer } from 'lucide-react';
import { format } from 'date-fns';

interface TimeEntry {
  id: string;
  orderId: string;
  task: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  notes?: string;
}

export default function TimeTracking() {
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string>('');
  const [task, setTask] = useState('');
  const [startTime, setStartTime] = useState<Date | null>(null);

  const { data: orders = [] } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders"],
  });

  // Mock time entries - in a real app, this would come from your API
  const timeEntries: TimeEntry[] = [
    {
      id: '1',
      orderId: orders[0]?.id || '',
      task: 'Frame cutting',
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
      duration: 3600,
      notes: 'Custom frame for landscape artwork'
    },
    {
      id: '2',
      orderId: orders[1]?.id || '',
      task: 'Mat cutting',
      startTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
      duration: 1800,
      notes: 'Double mat with conservation backing'
    }
  ];

  const handleStartTimer = () => {
    if (!selectedOrder || !task) return;
    
    setActiveTimer(selectedOrder);
    setStartTime(new Date());
  };

  const handleStopTimer = () => {
    if (!activeTimer || !startTime) return;
    
    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    
    // In a real app, you would save this to your API
    console.log('Time entry:', {
      orderId: activeTimer,
      task,
      startTime,
      endTime,
      duration
    });
    
    setActiveTimer(null);
    setStartTime(null);
    setTask('');
    setSelectedOrder('');
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getCurrentDuration = () => {
    if (!startTime) return 0;
    return Math.floor((Date.now() - startTime.getTime()) / 1000);
  };

  const getTimeStats = () => {
    const totalTime = timeEntries.reduce((sum, entry) => sum + entry.duration, 0);
    const todayEntries = timeEntries.filter(entry => 
      format(entry.startTime, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
    );
    const todayTime = todayEntries.reduce((sum, entry) => sum + entry.duration, 0);
    
    return {
      totalTime,
      todayTime,
      entriesCount: timeEntries.length,
      todayEntries: todayEntries.length
    };
  };

  const stats = getTimeStats();

  return (
    <div className="p-6 space-y-6">
      <Navigation />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Time Tracking</h1>
          <p className="text-muted-foreground">Track time spent on orders and tasks</p>
        </div>
      </div>

      {/* Time Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{formatDuration(stats.todayTime)}</div>
                <div className="text-sm text-muted-foreground">Today</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{formatDuration(stats.totalTime)}</div>
                <div className="text-sm text-muted-foreground">Total Time</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{stats.todayEntries}</div>
                <div className="text-sm text-muted-foreground">Today's Tasks</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{stats.entriesCount}</div>
                <div className="text-sm text-muted-foreground">Total Entries</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Timer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Time Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeTimer ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border-2 border-green-200">
                <div>
                  <div className="font-semibold text-green-800">Timer Running</div>
                  <div className="text-sm text-green-600">
                    Order: #{orders.find(o => o.id === activeTimer)?.trackingId} • Task: {task}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-800">
                    {formatDuration(getCurrentDuration())}
                  </div>
                  <Button onClick={handleStopTimer} variant="destructive" size="sm">
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="order">Select Order</Label>
                <Select value={selectedOrder} onValueChange={setSelectedOrder}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an order" />
                  </SelectTrigger>
                  <SelectContent>
                    {orders
                      .filter(order => order.status !== 'PICKED_UP')
                      .map(order => (
                        <SelectItem key={order.id} value={order.id}>
                          #{order.trackingId} - {order.customer?.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="task">Task</Label>
                <Select value={task} onValueChange={setTask}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select task type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Frame cutting">Frame cutting</SelectItem>
                    <SelectItem value="Mat cutting">Mat cutting</SelectItem>
                    <SelectItem value="Glass cutting">Glass cutting</SelectItem>
                    <SelectItem value="Assembly">Assembly</SelectItem>
                    <SelectItem value="Consultation">Consultation</SelectItem>
                    <SelectItem value="Material prep">Material prep</SelectItem>
                    <SelectItem value="Quality check">Quality check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-end">
                <Button 
                  onClick={handleStartTimer}
                  disabled={!selectedOrder || !task}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Timer
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Time Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Time Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {timeEntries.map(entry => {
              const order = orders.find(o => o.id === entry.orderId);
              
              return (
                <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">
                        {order ? `#${order.trackingId}` : 'Unknown Order'} - {entry.task}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(entry.startTime, 'MMM d, h:mm a')} - {entry.endTime ? format(entry.endTime, 'h:mm a') : 'In progress'}
                      </div>
                      {entry.notes && (
                        <div className="text-sm text-muted-foreground italic">{entry.notes}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <Badge variant="secondary">
                      {formatDuration(entry.duration)}
                    </Badge>
                    {order && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {order.customer?.name}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {timeEntries.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No time entries recorded yet. Start tracking time to see your work history.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
