import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { motion } from 'framer-motion';
import { Search, Package, CheckCircle, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OrderWithDetails } from '@shared/schema';

const STATUS_STEPS = [
  { key: 'ORDER_PROCESSED', label: 'Order Processed' },
  { key: 'MATERIALS_ORDERED', label: 'Materials Ordered' },
  { key: 'MATERIALS_ARRIVED', label: 'Materials Arrived' },
  { key: 'FRAME_CUT', label: 'Frame Cut' },
  { key: 'MAT_CUT', label: 'Mat Cut' },
  { key: 'PREPPED', label: 'Prepped' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'PICKED_UP', label: 'Picked Up' },
];

export default function CustomerPortal() {
  const [, params] = useRoute('/track/:trackingId');
  const [searchInput, setSearchInput] = useState(params?.trackingId || '');
  const [email, setEmail] = useState('');
  const [searchMethod, setSearchMethod] = useState<'tracking' | 'email'>('tracking');

  // Query for single order by tracking ID
  const { data: orderData, isLoading: orderLoading, error: orderError } = useQuery<OrderWithDetails>({
    queryKey: [`/api/customer/track/${searchInput}`],
    enabled: searchMethod === 'tracking' && !!searchInput && searchInput.length >= 6,
    retry: false,
  });

  // Query for orders by email
  const { data: ordersData, isLoading: ordersLoading, error: ordersError } = useQuery<OrderWithDetails[]>({
    queryKey: [`/api/customer/orders/${email}`],
    enabled: searchMethod === 'email' && !!email && email.includes('@'),
    retry: false,
  });

  const handleSearch = (method: 'tracking' | 'email') => {
    setSearchMethod(method);
  };

  const getStatusIndex = (status: string) => {
    return STATUS_STEPS.findIndex(step => step.key === status);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-500';
      case 'DELAYED': return 'bg-red-500';
      case 'PICKED_UP': return 'bg-blue-500';
      default: return 'bg-jade-500';
    }
  };

  const OrderTimeline = ({ order }: { order: OrderWithDetails }) => {
    const currentIndex = getStatusIndex(order.status);
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Order Timeline</h3>
          <Badge className={`${getStatusColor(order.status)} text-white`}>
            {order.status.replace('_', ' ')}
          </Badge>
        </div>
        
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-gray-700"></div>
          
          {STATUS_STEPS.map((step, index) => {
            const isCompleted = index <= currentIndex;
            const isCurrent = index === currentIndex;
            
            return (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative flex items-center gap-4 pb-6"
              >
                <div className={`
                  relative z-10 w-8 h-8 rounded-full flex items-center justify-center
                  ${isCompleted ? 'bg-jade-500' : 'bg-gray-700'}
                  ${isCurrent ? 'ring-4 ring-jade-500/30' : ''}
                `}>
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  )}
                </div>
                
                <div className="flex-1">
                  <p className={`font-medium ${isCompleted ? 'text-white' : 'text-gray-400'}`}>
                    {step.label}
                  </p>
                  {isCurrent && (
                    <p className="text-sm text-jade-400">Current stage</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  };

  const OrderCard = ({ order }: { order: OrderWithDetails }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">
              {order.trackingId} - {order.customer.name}
            </CardTitle>
            <Badge className={`${getStatusColor(order.status)} text-white`}>
              {order.status.replace('_', ' ')}
            </Badge>
          </div>
          <div className="text-gray-400 space-y-1">
            <p>Order Type: {order.orderType}</p>
            <p>Due Date: {new Date(order.dueDate).toLocaleDateString()}</p>
            <p>Estimated Hours: {order.estimatedHours}h</p>
            <p>Price: ${order.price}</p>
          </div>
        </CardHeader>
        <CardContent>
          <OrderTimeline order={order} />
          
          {order.notes && (
            <div className="mt-6 p-4 bg-gray-800 rounded-lg">
              <h4 className="font-semibold text-white mb-2">Order Notes</h4>
              <p className="text-gray-300">{order.notes}</p>
            </div>
          )}
          
          {order.status === 'COMPLETED' && (
            <div className="mt-6 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <h4 className="font-semibold">Ready for Pickup!</h4>
              </div>
              <p className="text-green-300 mt-2">
                Your custom frame is ready for pickup at Jay's Frames. Please bring this tracking number when you collect your order.
              </p>
              <div className="mt-3 text-sm text-green-200">
                <p><strong>Pickup Hours:</strong></p>
                <p>Monday - Friday: 9:00 AM - 6:00 PM</p>
                <p>Saturday: 10:00 AM - 4:00 PM</p>
                <p>Sunday: Closed</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900/90 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-jade-400 mb-2">Jay's Frames</h1>
            <p className="text-gray-400">Track Your Custom Frame Order</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Search Section */}
        <Card className="bg-gray-900 border-gray-800 mb-8">
          <CardHeader>
            <CardTitle className="text-white text-center">Track Your Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tracking ID Search */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search by Tracking ID
              </label>
              <div className="flex gap-3">
                <Input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                  placeholder="Enter tracking ID (e.g., JF2024001)"
                  className="flex-1 bg-gray-800 border-gray-700 text-white"
                />
                <Button
                  onClick={() => handleSearch('tracking')}
                  className="bg-jade-500 hover:bg-jade-400 text-black"
                  disabled={!searchInput || searchInput.length < 6}
                >
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>

            <div className="text-center text-gray-500">
              <span>— OR —</span>
            </div>

            {/* Email Search */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search by Email Address
              </label>
              <div className="flex gap-3">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="flex-1 bg-gray-800 border-gray-700 text-white"
                />
                <Button
                  onClick={() => handleSearch('email')}
                  className="bg-jade-500 hover:bg-jade-400 text-black"
                  disabled={!email || !email.includes('@')}
                >
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {(orderLoading || ordersLoading) && (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-jade-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Searching for your order...</p>
          </div>
        )}

        {(orderError || ordersError) && (
          <Card className="bg-red-900/20 border-red-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <h3 className="font-semibold">Order Not Found</h3>
              </div>
              <p className="text-red-300 mt-2">
                We couldn't find an order with that {searchMethod === 'tracking' ? 'tracking ID' : 'email address'}. 
                Please check your information and try again.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Single Order Result */}
        {orderData && (
          <OrderCard order={orderData} />
        )}

        {/* Multiple Orders Result */}
        {ordersData && ordersData.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-6">
              Found {ordersData.length} order{ordersData.length !== 1 ? 's' : ''}
            </h2>
            {ordersData.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}

        {ordersData && ordersData.length === 0 && searchMethod === 'email' && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="pt-6 text-center">
              <Package className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Orders Found</h3>
              <p className="text-gray-400">
                We don't have any orders associated with that email address.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Card className="bg-gray-900 border-gray-800 mt-12">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold text-white mb-4">Need Help?</h3>
            <div className="space-y-2 text-gray-300">
              <p>• Your tracking ID was provided when you placed your order</p>
              <p>• If you can't find your tracking ID, try searching with your email address</p>
              <p>• For additional assistance, contact us at (555) 123-4567</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
