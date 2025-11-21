import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Calendar, CalendarDays, Package, User, Phone, Mail, MapPin, DollarSign, Clock, AlertCircle, X, Plus, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import type { Customer, InsertOrder } from '@shared/schema';
import { useOrderStore } from '@/store/useOrderStore';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';

interface NewOrderData {
  customerId: string;
  orderType: 'FRAME' | 'MAT' | 'SHADOWBOX';
  description: string;
  dueDate: string;
  estimatedHours: number;
  price: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  notes?: string;
}

export default function NewOrderModal() {
  const { ui, toggleNewOrderModal } = useOrderStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<NewOrderData>({
    customerId: '',
    orderType: 'FRAME',
    description: '',
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 weeks from now
    estimatedHours: 3,
    price: 275,
    priority: 'MEDIUM',
    notes: ''
  });

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: NewOrderData) => {
      console.log('Creating order with data:', orderData);

      const response = await apiRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerId: orderData.customerId,
          orderType: orderData.orderType,
          description: orderData.description,
          dueDate: orderData.dueDate,
          estimatedHours: orderData.estimatedHours || 3,
          price: orderData.price || 0,
          priority: orderData.priority || 'MEDIUM',
          notes: orderData.notes || '',
        }),
      });

      console.log('Order creation response:', response);
      return response;
    },
    onSuccess: (data) => {
      console.log('Order created successfully:', data);

      // Invalidate orders cache immediately
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });

      // Force refetch orders
      queryClient.refetchQueries({ queryKey: ['/api/orders'] });
      queryClient.refetchQueries({ queryKey: ["/api/orders"] });

      // Close modal and reset form
      toggleNewOrderModal();
      resetForm();

      // Show success message
      toast({
        title: "Order Created!",
        description: `Order ${data.trackingId || data.order?.trackingId || data.id} has been created successfully.`,
        duration: 3000,
      });
    },
    onError: (error: any) => {
      console.error('Order creation error:', error);

      let errorMessage = 'Failed to create order. Please try again.';

      // Handle different error formats
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.error) {
        errorMessage = error.error;
      }

      // Specific error handling
      if (errorMessage.includes('Customer not found')) {
        errorMessage = 'Please select a valid customer or create a new one.';
      } else if (errorMessage.includes('Validation error')) {
        errorMessage = 'Please check all required fields and try again.';
      } else if (errorMessage.includes('foreign key')) {
        errorMessage = 'Invalid customer selection. Please refresh and try again.';
      }

      toast({
        title: 'Error Creating Order',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000,
      });
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (customerData: typeof newCustomer) => {
      console.log('Sending customer data:', customerData);

      const response = await apiRequest('/api/customers', {
        method: 'POST',
        body: JSON.stringify(customerData),
      });

      console.log('Customer creation response:', response);
      return response;
    },
    onSuccess: (response) => {
      console.log('Customer created successfully:', response);

      // Extract customer data from response
      const customer = response?.customer || response;
      const customerId = customer?.id || response?.id;
      const customerName = customer?.name || response?.name;

      if (!customerId) {
        console.error('No customer ID in response:', response);
        throw new Error('Invalid response: missing customer ID');
      }

      // Force refresh of customers list
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.refetchQueries({ queryKey: ['/api/customers'] });

      // Set the customer ID for the order form
      setFormData(prev => ({ ...prev, customerId: customerId }));
      console.log('Set customer ID:', customerId);

      setShowNewCustomer(false);
      setNewCustomer({ name: '', email: '', phone: '', address: '' });
      toast({
        title: '✅ Customer Created',
        description: `Customer ${customerName || 'Unknown'} has been added successfully.`,
      });
    },
    onError: (error: any) => {
      console.error('Customer creation error:', error);

      let errorMessage = 'Failed to create customer. Please try again.';

      // Handle error from apiRequest
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      toast({
        title: 'Error Creating Customer',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      customerId: '',
      orderType: 'FRAME',
      description: '',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimatedHours: 3,
      price: 275,
      priority: 'MEDIUM',
      notes: ''
    });
    setNewCustomer({ name: '', email: '', phone: '', address: '' });
    setShowNewCustomer(false);
  };

  const handleOrderTypeChange = (orderType: 'FRAME' | 'MAT' | 'SHADOWBOX') => {
    const defaults = {
      FRAME: { hours: 3, price: 275 },
      MAT: { hours: 1.5, price: 150 },
      SHADOWBOX: { hours: 4.5, price: 450 }
    };

    setFormData(prev => ({
      ...prev,
      orderType,
      estimatedHours: defaults[orderType].hours,
      price: defaults[orderType].price
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    console.log('Form submission attempted with data:', formData);

    // Enhanced validation
    if (!formData.customerId?.trim()) {
      toast({
        title: 'Missing Customer',
        description: 'Please select a customer from the dropdown or create a new one.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.description?.trim()) {
      toast({
        title: 'Missing Description',
        description: 'Please enter a description for the order.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.dueDate) {
      toast({
        title: 'Missing Due Date',
        description: 'Please select a due date.',
        variant: 'destructive',
      });
      return;
    }

    // Validate due date is not in the past
    const selectedDate = new Date(formData.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      toast({
        title: 'Invalid Due Date',
        description: 'Due date cannot be in the past.',
        variant: 'destructive',
      });
      return;
    }

    // Validate the customer exists
    console.log('Validating customer ID:', formData.customerId);
    console.log('Available customers:', customers?.map(c => ({ id: c.id, name: c.name })));

    const selectedCustomer = customers?.find(c => c.id === formData.customerId);
    if (!selectedCustomer) {
      console.log('Customer validation failed - no matching customer found');
      toast({
        title: 'Invalid Customer Selection',
        description: 'The selected customer could not be found. Please refresh and try again.',
        variant: 'destructive',
      });
      return;
    }

    console.log('Selected customer validated:', selectedCustomer.name);

    // Additional data validation
    if (!formData.estimatedHours || formData.estimatedHours < 0.5) {
      toast({
        title: 'Invalid Hours',
        description: 'Estimated hours must be at least 0.5.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.price || formData.price < 0) {
      toast({
        title: 'Invalid Price',
        description: 'Price must be a positive number.',
        variant: 'destructive',
      });
      return;
    }

    // Ensure numeric values are properly formatted
    const sanitizedFormData = {
      ...formData,
      estimatedHours: Number(formData.estimatedHours),
      price: Number(formData.price),
      customerId: formData.customerId.trim(),
      description: formData.description.trim(),
      notes: formData.notes?.trim() || ''
    };

    console.log('All validation passed, creating order with sanitized data:', sanitizedFormData);
    createOrderMutation.mutate(sanitizedFormData);
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCustomer.name?.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter customer name.',
        variant: 'destructive',
      });
      return;
    }

    if (!newCustomer.email?.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter customer email.',
        variant: 'destructive',
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newCustomer.email.trim())) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    createCustomerMutation.mutate({
      name: newCustomer.name.trim(),
      email: newCustomer.email.trim(),
      phone: newCustomer.phone?.trim() || null,
      address: newCustomer.address?.trim() || null,
    });
  };

  return (
    <Dialog open={ui.isNewOrderModalOpen} onOpenChange={toggleNewOrderModal}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Order</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new custom frame order.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Selection */}
          <div>
            <Label htmlFor="customerId">Customer *</Label>
            <div className="flex gap-2">
              <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerSearchOpen}
                    className="flex-1 justify-between"
                  >
                    {formData.customerId
                      ? customers?.find((customer) => customer.id === formData.customerId)?.name
                      : "Select customer..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Search customers..." />
                    <CommandEmpty>No customer found.</CommandEmpty>
                    <CommandList>
                      <CommandGroup>
                        {customers?.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={`${customer.name} ${customer.email}`}
                            onSelect={() => {
                              console.log('Selecting customer:', customer.id, customer.name);
                              setFormData(prev => ({ 
                                ...prev, 
                                customerId: customer.id 
                              }));
                              setCustomerSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.customerId === customer.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">{customer.name}</span>
                              <span className="text-sm text-muted-foreground">{customer.email}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewCustomer(!showNewCustomer)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* New Customer Form */}
          {showNewCustomer && (
            <div className="p-4 border rounded-lg space-y-4">
              <h3 className="font-medium">Add New Customer</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customerName">Name *</Label>
                  <Input
                    id="customerName"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Customer name"
                  />
                </div>
                <div>
                  <Label htmlFor="customerEmail">Email *</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="customer@email.com"
                  />
                </div>
                <div>
                  <Label htmlFor="customerPhone">Phone</Label>
                  <Input
                    id="customerPhone"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="customerAddress">Address</Label>
                  <Input
                    id="customerAddress"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Address"
                  />
                </div>
              </div>
              <Button
                type="button"
                onClick={handleCreateCustomer}
                disabled={createCustomerMutation.isPending}
                className="w-full"
              >
                {createCustomerMutation.isPending ? 'Creating...' : 'Create Customer'}
              </Button>
            </div>
          )}

          {/* Order Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="orderType">Order Type</Label>
              <Select
                value={formData.orderType}
                onValueChange={handleOrderTypeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FRAME">Frame</SelectItem>
                  <SelectItem value="MAT">Mat</SelectItem>
                  <SelectItem value="SHADOWBOX">Shadowbox</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') => 
                  setFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the framing job..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="estimatedHours">Est. Hours</Label>
              <Input
                id="estimatedHours"
                type="number"
                step="0.5"
                min="0.5"
                value={formData.estimatedHours}
                onChange={(e) => setFormData(prev => ({ ...prev, estimatedHours: parseFloat(e.target.value) }))}
              />
            </div>

            <div>
              <Label htmlFor="price">Price ($)</Label>
              <Input
                id="price"
                type="number"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) }))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={toggleNewOrderModal}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createOrderMutation.isPending}
              className="bg-jade-500 hover:bg-jade-400 text-black"
            >
              {createOrderMutation.isPending ? 'Creating...' : 'Create Order'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
