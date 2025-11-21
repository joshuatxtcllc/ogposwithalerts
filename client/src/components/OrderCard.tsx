import { useState, useEffect } from 'react';
import { useDrag } from 'react-dnd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  User, 
  DollarSign, 
  MessageSquare, 
  Edit, 
  AlertTriangle,
  Package,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useOrderStore } from '@/store/useOrderStore';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { OrderWithDetails } from '@shared/schema';

interface OrderCardProps {
  order: OrderWithDetails;
}

// Status progression map
const STATUS_PROGRESSION = {
  'ORDER_PROCESSED': 'MATERIALS_ORDERED',
  'MATERIALS_ORDERED': 'MATERIALS_ARRIVED', 
  'MATERIALS_ARRIVED': 'FRAME_CUT',
  'FRAME_CUT': 'MAT_CUT',
  'MAT_CUT': 'PREPPED',
  'PREPPED': 'COMPLETED',
  'COMPLETED': 'PICKED_UP'
};

const STATUS_LABELS = {
  'ORDER_PROCESSED': 'Order Materials',
  'MATERIALS_ORDERED': 'Mark Materials Arrived',
  'MATERIALS_ARRIVED': 'Cut Frame',
  'FRAME_CUT': 'Cut Mat',
  'MAT_CUT': 'Prep for Assembly',
  'PREPPED': 'Complete Order',
  'COMPLETED': 'Mark Picked Up'
};

export default function OrderCard({ order }: OrderCardProps) {
  // Enhanced safety checks for order data
  if (!order || !order.id || typeof order.id !== 'string') {
    console.warn('OrderCard: Invalid order data received', order);
    return null;
  }

  const { setUI, setSelectedOrderId } = useOrderStore();
  const [statusChanged, setStatusChanged] = useState(false);
  const [previousStatus, setPreviousStatus] = useState(order.status || '');
  const [showStatusAnimation, setShowStatusAnimation] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Track status changes for animations with better error handling
  useEffect(() => {
    if (order.status && previousStatus && previousStatus !== order.status) {
      setStatusChanged(true);
      setShowStatusAnimation(true);
      setPreviousStatus(order.status);

      // Reset animation after delay
      const timer = setTimeout(() => {
        setStatusChanged(false);
        setShowStatusAnimation(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [order.status, previousStatus]);

  // Drag and drop setup
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'order',
    item: { id: order.id, status: order.status },
    collect: (monitor: any) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  // Quick status update mutation
  const quickUpdateMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      return apiRequest(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
    },
    onMutate: () => {
      setIsUpdating(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Status Updated",
        description: `Order moved to ${STATUS_LABELS[STATUS_PROGRESSION[order.status as keyof typeof STATUS_PROGRESSION] as keyof typeof STATUS_LABELS] || 'next stage'}`,
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update order status",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsUpdating(false);
    },
  });

  const handleQuickStatusUpdate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = STATUS_PROGRESSION[order.status as keyof typeof STATUS_PROGRESSION];
    if (nextStatus && !isUpdating) {
      quickUpdateMutation.mutate(nextStatus);
    }
  };

  const handleOpenDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOrderId(order.id);
    setUI({ isOrderDetailsOpen: true });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'HIGH': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'LOW': return 'bg-green-500/20 text-green-300 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const isOverdue = new Date(order.dueDate) < new Date() && !['COMPLETED', 'PICKED_UP'].includes(order.status);
  const nextStatus = STATUS_PROGRESSION[order.status as keyof typeof STATUS_PROGRESSION];

  return (
    <motion.div
      ref={drag}
      data-draggable="order"
      className={`order-card cursor-pointer transition-all duration-200 ${
        isDragging || isDragActive ? 'opacity-50 scale-95 rotate-2' : 'hover:scale-102'
      } ${statusChanged ? 'ring-2 ring-jade-500/50 shadow-jade-500/20' : ''}`}
      animate={{
        scale: showStatusAnimation ? [1, 1.05, 1] : 1,
        borderColor: showStatusAnimation ? ['#1f2937', '#10b981', '#1f2937'] : '#1f2937',
      }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -2 }}
      onClick={handleOpenDetails}
    >
      <Card className="glass-card border-gray-700/50 hover:border-gray-600/50 transition-all duration-200 shadow-lg hover:shadow-xl">
        <CardContent className="p-3 sm:p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-xs sm:text-sm text-jade-400 font-semibold truncate">
                #{order.trackingId}
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                <User className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{order.customer?.name || 'Unknown'}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 items-end flex-shrink-0">
              <Badge className={getPriorityColor(order.priority)} size="sm">
                {order.priority}
              </Badge>
              {isOverdue && (
                <Badge variant="destructive" size="sm" className="text-xs">
                  <AlertTriangle className="w-2 h-2 mr-1" />
                  Overdue
                </Badge>
              )}
            </div>
          </div>

          {/* Description */}
          {order.description && (
            <p className="text-xs sm:text-sm text-gray-300 line-clamp-2 leading-relaxed">
              {order.description}
            </p>
          )}

          {/* Key Details */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1 text-gray-400">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">
                {new Date(order.dueDate).toLocaleDateString(undefined, { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </span>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span>{order.estimatedHours}h</span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
            {/* Price */}
            {order.price && (
              <span className="text-jade-400 font-medium flex items-center gap-1 text-xs sm:text-sm">
                <DollarSign className="w-3 h-3" />
                <span>${order.price}</span>
              </span>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              {/* Notes Indicator */}
              {order.notes && (
                <MessageSquare className="w-3 h-3 text-gray-500" />
              )}

              {/* Quick Action Button */}
              {nextStatus && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-jade-400 hover:text-jade-300 hover:bg-jade-500/10"
                  onClick={handleQuickStatusUpdate}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <div className="w-3 h-3 border border-jade-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Zap className="w-3 h-3" />
                  )}
                </Button>
              )}

              {/* Details Button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-gray-500 hover:text-white"
                onClick={handleOpenDetails}
              >
                <Edit className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
