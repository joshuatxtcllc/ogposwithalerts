import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Edit3, Save, Trash2, Calendar, Clock, DollarSign, User, Package, FileText, Palette, Scissors, Frame, Ruler, AlertCircle, Clipboard, Edit, CheckCircle, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { useOrderStore } from '@/store/useOrderStore';
import ArtworkManager from '@/components/ArtworkManager';
import { useToast } from '@/hooks/use-toast';
import { PRIORITY_LEVELS } from '@/lib/constants';
import type { OrderWithDetails, Material } from '@shared/schema';
import InvoiceModal from './InvoiceModal';

export default function OrderDetails() {
  const { selectedOrderId, ui, setUI } = useOrderStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(false);
  const [editedOrder, setEditedOrder] = useState<Partial<OrderWithDetails>>({});
  const { toast } = useToast();
  const [tabNotes, setTabNotes] = useState({
    details: '',
    material: '',
    artwork: '',
    history: '',
    customer: '',
  });
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<string | null>(null);
  const [newMaterial, setNewMaterial] = useState({
    type: '',
    subtype: '',
    quantity: 1,
    unit: 'ft',
    supplier: '',
    cost: 0,
    notes: ''
  });
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Fetch order details
  const { data: order, isLoading } = useQuery<OrderWithDetails>({
    queryKey: [`/api/orders/${selectedOrderId}`],
    enabled: !!selectedOrderId && ui.isOrderDetailsOpen,
  });

  // Material status update mutation
  const updateMaterialMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Material> }) => {
      const response = await apiRequest('PATCH', `/api/materials/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${selectedOrderId}`] });
    },
  });

  // Order update mutation
  const updateOrderMutation = useMutation({
    mutationFn: async (updates: Partial<OrderWithDetails>) => {
      return await apiRequest(`/api/orders/${selectedOrderId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${selectedOrderId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setIsEditing(false);
      setEditedOrder({});
      toast({
        title: "Order Updated",
        description: "Order details have been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update order details. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Material creation mutation
  const createMaterialMutation = useMutation({
    mutationFn: async (materialData: any) => {
      return await apiRequest(`/api/orders/${selectedOrderId}/materials`, {
        method: 'POST',
        body: JSON.stringify(materialData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${selectedOrderId}`] });
      setIsAddingMaterial(false);
      setNewMaterial({
        type: '',
        subtype: '',
        quantity: 1,
        unit: 'ft',
        supplier: '',
        cost: 0,
        notes: ''
      });
      toast({
        title: "Material Added",
        description: "Material has been successfully added to the order.",
      });
    },
    onError: () => {
      toast({
        title: "Add Failed",
        description: "Failed to add material. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Material deletion mutation
  const deleteMaterialMutation = useMutation({
    mutationFn: async (materialId: string) => {
      return await apiRequest(`/api/materials/${materialId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${selectedOrderId}`] });
      toast({
        title: "Material Deleted",
        description: "Material has been successfully removed.",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete material. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleMaterialStatusChange = (materialId: string, updates: Partial<Material>) => {
    updateMaterialMutation.mutate({ id: materialId, updates });
  };

  const handleEditStart = () => {
    if (order) {
      setEditedOrder({
        description: order.description || '',
        notes: order.notes || '',
        internalNotes: order.internalNotes || '',
        priority: order.priority || 'MEDIUM',
        estimatedHours: order.estimatedHours || 0,
        price: order.price || 0,
        deposit: order.deposit || 0,
        dueDate: order.dueDate ? new Date(order.dueDate).toISOString().split('T')[0] : '',
        complexity: order.complexity || 5,
        dimensions: order.dimensions || { width: null, height: null, depth: null }
      });
      setIsEditing(true);
    }
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditedOrder({});
  };

  const handleEditSave = () => {
    const updates = { ...editedOrder };
    // Keep dueDate as string - backend will handle conversion
    updateOrderMutation.mutate(updates);
  };

  const handleInputChange = (field: string, value: any) => {
    setEditedOrder(prev => ({ ...prev, [field]: value }));
  };

  const handleDimensionChange = (dimension: string, value: string) => {
    setEditedOrder(prev => ({
      ...prev,
      dimensions: {
        ...prev.dimensions,
        [dimension]: value ? parseFloat(value) : null
      }
    }));
  };

  const handleAddMaterial = () => {
    if (!newMaterial.type || !newMaterial.quantity) {
      toast({
        title: "Validation Error",
        description: "Please fill in required fields (type and quantity).",
        variant: "destructive",
      });
      return;
    }
    createMaterialMutation.mutate(newMaterial);
  };

  const handleDeleteMaterial = (materialId: string) => {
    if (confirm('Are you sure you want to delete this material?')) {
      deleteMaterialMutation.mutate(materialId);
    }
  };

  const handleClose = () => {
    setUI({ isOrderDetailsOpen: false });
    setIsEditing(false);
    setEditedOrder({});
  };

  if (!order && !isLoading) return null;

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ORDER_PROCESSED': return 'bg-blue-500';
      case 'MATERIALS_ORDERED': return 'bg-yellow-500';
      case 'MATERIALS_ARRIVED': return 'bg-green-500';
      case 'FRAME_CUT': return 'bg-purple-500';
      case 'MAT_CUT': return 'bg-indigo-500';
      case 'PREPPED': return 'bg-teal-500';
      case 'COMPLETED': return 'bg-jade-500';
      case 'DELAYED': return 'bg-red-500';
      case 'PICKED_UP': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-500';
      case 'HIGH': return 'bg-orange-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-jade-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString(undefined, { 
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={ui.isOrderDetailsOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 text-white border-gray-800">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Clipboard className="h-5 w-5 text-jade-400" />
              Order Details
            </DialogTitle>
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleEditStart}
                  className="text-jade-400 border-jade-500/50 hover:bg-jade-500/10"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleEditSave}
                    disabled={updateOrderMutation.isPending}
                    className="text-green-400 border-green-500/50 hover:bg-green-500/10"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleEditCancel}
                    className="text-red-400 border-red-500/50 hover:bg-red-500/10"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              )}
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {order && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div>
                <p className="text-xs text-gray-400">Tracking ID</p>
                <p className="font-mono text-white">{order.trackingId}</p>
              </div>
              <div className="flex gap-2">
                <Badge className={`${getStatusBadgeColor(order.status)}`}>
                  {order.status.replace(/_/g, ' ')}
                </Badge>
                <Badge className={`${getPriorityBadgeColor(order.priority)}`}>
                  {order.priority}
                </Badge>
              </div>
            </div>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-jade-500"></div>
          </div>
        ) : order ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full bg-gray-800">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="materials">Materials</TabsTrigger>
              <TabsTrigger value="artwork">Artwork</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="customer">Customer</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-jade-400" />
                      Order Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Order Type:</span>
                      <span className="text-white font-medium">{order.orderType}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Due Date:</span>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editedOrder.dueDate || ''}
                          onChange={(e) => handleInputChange('dueDate', e.target.value)}
                          className="w-40 h-8 bg-gray-800 border-gray-700 text-white"
                        />
                      ) : (
                        <span className="text-white font-medium">{formatDate(order.dueDate)}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Priority:</span>
                      {isEditing ? (
                        <Select
                          value={editedOrder.priority || order.priority}
                          onValueChange={(value) => handleInputChange('priority', value)}
                        >
                          <SelectTrigger className="w-32 h-8 bg-gray-800 border-gray-700 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            <SelectItem value="LOW">Low</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="HIGH">High</SelectItem>
                            <SelectItem value="URGENT">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={`${getPriorityBadgeColor(order.priority)}`}>
                          {order.priority}
                        </Badge>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Created:</span>
                      <span className="text-white font-medium">{formatDate(order.createdAt)}</span>
                    </div>
                    {order.completedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Completed:</span>
                        <span className="text-white font-medium">{formatDate(order.completedAt)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4 text-jade-400" />
                      Time & Complexity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Estimated Hours:</span>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editedOrder.estimatedHours || ''}
                          onChange={(e) => handleInputChange('estimatedHours', parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 bg-gray-800 border-gray-700 text-white"
                          min="0"
                          step="0.5"
                        />
                      ) : (
                        <span className="text-white font-medium">{order.estimatedHours}h</span>
                      )}
                    </div>
                    {order.actualHours && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Actual Hours:</span>
                        <span className="text-white font-medium">{order.actualHours}h</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Complexity:</span>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editedOrder.complexity || ''}
                          onChange={(e) => handleInputChange('complexity', parseInt(e.target.value) || 5)}
                          className="w-16 h-8 bg-gray-800 border-gray-700 text-white"
                          min="1"
                          max="10"
                        />
                      ) : (
                        <span className="text-white font-medium">{order.complexity}/10</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-jade-400" />
                      Financial Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Price:</span>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editedOrder.price || ''}
                          onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                          className="w-24 h-8 bg-gray-800 border-gray-700 text-white"
                          min="0"
                          step="0.01"
                        />
                      ) : (
                        <span className="text-white font-medium">${order.price}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Deposit:</span>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editedOrder.deposit || ''}
                          onChange={(e) => handleInputChange('deposit', parseFloat(e.target.value) || 0)}
                          className="w-24 h-8 bg-gray-800 border-gray-700 text-white"
                          min="0"
                          step="0.01"
                        />
                      ) : (
                        <span className="text-white font-medium">${order.deposit || 0}</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Balance:</span>
                      <span className="text-white font-medium">
                        ${(editedOrder.price || order.price) - (editedOrder.deposit || order.deposit || 0)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {(order.dimensions || isEditing) && (
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-white text-sm font-medium">Dimensions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Width:</span>
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editedOrder.dimensions?.width || ''}
                            onChange={(e) => handleDimensionChange('width', e.target.value)}
                            className="w-20 h-8 bg-gray-800 border-gray-700 text-white"
                            min="0"
                            step="0.25"
                            placeholder="Width"
                          />
                        ) : (
                          order.dimensions?.width && (
                            <span className="text-white font-medium">{order.dimensions.width}"</span>
                          )
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Height:</span>
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editedOrder.dimensions?.height || ''}
                            onChange={(e) => handleDimensionChange('height', e.target.value)}
                            className="w-20 h-8 bg-gray-800 border-gray-700 text-white"
                            min="0"
                            step="0.25"
                            placeholder="Height"
                          />
                        ) : (
                          order.dimensions?.height && (
                            <span className="text-white font-medium">{order.dimensions.height}"</span>
                          )
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Depth:</span>
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editedOrder.dimensions?.depth || ''}
                            onChange={(e) => handleDimensionChange('depth', e.target.value)}
                            className="w-20 h-8 bg-gray-800 border-gray-700 text-white"
                            min="0"
                            step="0.25"
                            placeholder="Depth"
                          />
                        ) : (
                          order.dimensions?.depth && (
                            <span className="text-white font-medium">{order.dimensions.depth}"</span>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {(order.notes || order.internalNotes || isEditing) && (
                <div className="mt-6 space-y-4">
                  {(order.notes || isEditing) && (
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4 text-jade-400" />
                          Customer Notes
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-white">
                        {isEditing ? (
                          <Textarea
                            value={editedOrder.notes || ''}
                            onChange={(e) => handleInputChange('notes', e.target.value)}
                            className="min-h-20 bg-gray-900 border-gray-700 text-white"
                            placeholder="Add customer notes..."
                          />
                        ) : (
                          order.notes
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {(order.internalNotes || isEditing) && (
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4 text-red-400" />
                          Internal Notes
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-white">
                        {isEditing ? (
                          <Textarea
                            value={editedOrder.internalNotes || ''}
                            onChange={(e) => handleInputChange('internalNotes', e.target.value)}
                            className="min-h-20 bg-gray-900 border-gray-700 text-white"
                            placeholder="Add internal notes..."
                          />
                        ) : (
                          order.internalNotes
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {(isEditing || order.description) && (
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-400" />
                          Order Description
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-white">
                        {isEditing ? (
                          <Textarea
                            value={editedOrder.description || ''}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            className="min-h-20 bg-gray-900 border-gray-700 text-white"
                            placeholder="Add order description..."
                          />
                        ) : (
                          order.description
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="materials" className="pt-4">
              <div className="space-y-4">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
                      <Truck className="h-4 w-4 text-jade-400" />
                      Materials List
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {order.materials.length === 0 ? (
                      <p className="text-gray-400 text-sm">No materials added for this order</p>
                    ) : (
                      <div className="space-y-4">
                        {order.materials.map((material) => (
                          <div key={material.id} className="border border-gray-700 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">
                                  {material.type}
                                </Badge>
                                {material.subtype && (
                                  <span className="text-white text-sm">{material.subtype}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={material.arrived ? 'bg-green-500' : material.ordered ? 'bg-yellow-500' : 'bg-gray-600'}>
                                  {material.arrived ? 'Arrived' : material.ordered ? 'Ordered' : 'Not Ordered'}
                                </Badge>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                              <div className="text-gray-400">Quantity:</div>
                              <div className="text-white">{material.quantity} {material.unit}</div>

                              {material.supplier && (
                                <>
                                  <div className="text-gray-400">Supplier:</div>
                                  <div className="text-white">{material.supplier}</div>
                                </>
                              )}

                              {material.cost !== null && material.cost !== undefined && (
                                <>
                                  <div className="text-gray-400">Cost:</div>
                                  <div className="text-white">${material.cost}</div>
                                </>
                              )}

                              {material.ordered && material.orderedDate && (
                                <>
                                  <div className="text-gray-400">Ordered Date:</div>
                                  <div className="text-white">{formatDate(material.orderedDate)}</div>
                                </>
                              )}

                              {material.arrived && material.arrivedDate && (
                                <>
                                  <div className="text-gray-400">Arrived Date:</div>
                                  <div className="text-white">{formatDate(material.arrivedDate)}</div>
                                </>
                              )}
                            </div>

                            <div className="flex gap-2 mt-2">
                              {!material.ordered && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="text-xs"
                                  onClick={() => handleMaterialStatusChange(material.id, { 
                                    ordered: true, 
                                    orderedDate: new Date() 
                                  })}
                                >
                                  Mark as Ordered
                                </Button>
                              )}

                              {material.ordered && !material.arrived && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="text-xs"
                                  onClick={() => handleMaterialStatusChange(material.id, { 
                                    arrived: true, 
                                    arrivedDate: new Date() 
                                  })}
                                >
                                  Mark as Arrived
                                </Button>
                              )}

                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-xs text-blue-400 border-blue-500/50 hover:bg-blue-500/10"
                                onClick={() => setEditingMaterial(material.id)}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>

                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-xs text-red-400 border-red-500/50 hover:bg-red-500/10"
                                onClick={() => handleDeleteMaterial(material.id)}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {!isAddingMaterial ? (
                  <Button 
                    variant="outline" 
                    className="w-full text-jade-400 border-jade-500/50 hover:bg-jade-500/10"
                    onClick={() => setIsAddingMaterial(true)}
                  >
                    Add Material
                  </Button>
                ) : (
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-white text-sm font-medium">Add New Material</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-gray-400 text-xs">Type *</Label>
                          <Select
                            value={newMaterial.type}
                            onValueChange={(value) => setNewMaterial({...newMaterial, type: value})}
                          >
                            <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              <SelectItem value="FRAME">Frame</SelectItem>
                              <SelectItem value="MAT">Mat</SelectItem>
                              <SelectItem value="GLASS">Glass</SelectItem>
                              <SelectItem value="BACKING">Backing</SelectItem>
                              <SelectItem value="HARDWARE">Hardware</SelectItem>
                              <SelectItem value="OTHER">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-gray-400 text-xs">Subtype</Label>
                          <Input
                            value={newMaterial.subtype}
                            onChange={(e) => setNewMaterial({...newMaterial, subtype: e.target.value})}
                            className="bg-gray-900 border-gray-700 text-white"
                            placeholder="e.g., R123, Museum Glass"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-gray-400 text-xs">Quantity *</Label>
                          <Input
                            type="number"
                            value={newMaterial.quantity}
                            onChange={(e) => setNewMaterial({...newMaterial, quantity: parseFloat(e.target.value) || 0})}
                            className="bg-gray-900 border-gray-700 text-white"
                            min="0"
                            step="0.1"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-400 text-xs">Unit</Label>
                          <Select
                            value={newMaterial.unit}
                            onValueChange={(value) => setNewMaterial({...newMaterial, unit: value})}
                          >
                            <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              <SelectItem value="ft">feet</SelectItem>
                              <SelectItem value="in">inches</SelectItem>
                              <SelectItem value="sq ft">sq ft</SelectItem>
                              <SelectItem value="pcs">pieces</SelectItem>
                              <SelectItem value="sheets">sheets</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-gray-400 text-xs">Cost</Label>
                          <Input
                            type="number"
                            value={newMaterial.cost}
                            onChange={(e) => setNewMaterial({...newMaterial, cost: parseFloat(e.target.value) || 0})}
                            className="bg-gray-900 border-gray-700 text-white"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-gray-400 text-xs">Supplier</Label>
                        <Input
                          value={newMaterial.supplier}
                          onChange={(e) => setNewMaterial({...newMaterial, supplier: e.target.value})}
                          className="bg-gray-900 border-gray-700 text-white"
                          placeholder="e.g., Roma Moulding, Larson Juhl"
                        />
                      </div>

                      <div>
                        <Label className="text-gray-400 text-xs">Notes</Label>
                        <Textarea
                          value={newMaterial.notes}
                          onChange={(e) => setNewMaterial({...newMaterial, notes: e.target.value})}
                          className="bg-gray-900 border-gray-700 text-white"
                          placeholder="Additional notes..."
                          rows={2}
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button 
                          size="sm"
                          onClick={handleAddMaterial}
                          disabled={createMaterialMutation.isPending}
                          className="bg-jade-600 hover:bg-jade-700 text-white"
                        >
                          {createMaterialMutation.isPending ? 'Adding...' : 'Add Material'}
                        </Button>
                        <Button 
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsAddingMaterial(false);
                            setNewMaterial({
                              type: '',
                              subtype: '',
                              quantity: 1,
                              unit: 'ft',
                              supplier: '',
                              cost: 0,
                              notes: ''
                            });
                          }}
                          className="text-gray-400 border-gray-600 hover:bg-gray-700"
                        >
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="artwork" className="pt-4">
              <ArtworkManager 
                orderId={order.id}
                artworkImages={order.artworkImages as string[] || []}
                artworkLocation={order.artworkLocation || ""}
                artworkReceived={order.artworkReceived || false}
                artworkReceivedDate={order.artworkReceivedDate?.toString()}
              />
            </TabsContent>

            <TabsContent value="history" className="pt-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm font-medium">Status History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-3.5 top-0 h-full w-px bg-gray-700"></div>

                    <div className="space-y-4">
                      {order.statusHistory.length === 0 ? (
                        <p className="text-gray-400 text-sm">No status history available</p>
                      ) : (
                        order.statusHistory
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .map((history, index) => (
                            <div key={history.id} className="relative pl-10">
                              <div className="absolute left-0 top-1 w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center">
                                {history.toStatus === 'COMPLETED' ? (
                                  <CheckCircle className="w-4 h-4 text-green-400" />
                                ) : history.toStatus === 'DELAYED' ? (
                                  <AlertCircle className="w-4 h-4 text-red-400" />
                                ) : (
                                  <div className={`w-3 h-3 rounded-full ${getStatusBadgeColor(history.toStatus)}`} />
                                )}
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium text-white">
                                    {history.fromStatus ? (
                                      <span>
                                        Status changed from <span className="text-gray-400">{history.fromStatus.replace(/_/g, ' ')}</span> to <span className="text-jade-400">{history.toStatus.replace(/_/g, ' ')}</span>
                                      </span>
                                    ) : (
                                      <span>Order status set to <span className="text-jade-400">{history.toStatus.replace(/_/g, ' ')}</span></span>
                                    )}
                                  </p>
                                  <span className="text-xs text-gray-400">
                                    {new Date(history.createdAt).toLocaleString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: 'numeric',
                                      minute: 'numeric',
                                    })}
                                  </span>
                                </div>

                                {history.reason && (
                                  <p className="text-sm text-gray-400">{history.reason}</p>
                                )}
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </CardContent>

                <Card className="bg-gray-800 border-gray-700 mt-4">
                  <CardHeader>
                    <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-400" />
                      History Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-white">
                    <Textarea
                      value={tabNotes.history}
                      onChange={(e) => setTabNotes({...tabNotes, history: e.target.value})}
                      className="min-h-16 text-xs"
                      placeholder="Add notes about status changes, delays, or important milestones..."
                    />
                  </CardContent>
                </Card>
              </Card>
            </TabsContent>

            <TabsContent value="customer" className="pt-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-jade-400" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 mb-1">Name</p>
                      <p className="text-white font-medium">{order.customer.name}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Email</p>
                      <p className="text-white font-medium">{order.customer.email}</p>
                    </div>
                    {order.customer.phone && (
                      <div>
                        <p className="text-gray-400 mb-1">Phone</p>
                        <p className="text-white font-medium">{order.customer.phone}</p>
                      </div>
                    )}
                    {order.customer.address && (
                      <div className="md:col-span-2">
                        <p className="text-gray-400 mb-1">Address</p>
                        <p className="text-white font-medium">{order.customer.address}</p>
                      </div>
                    )}
                  </div>

                  {order.customer.preferences && (
                    <div className="mt-4">
                      <p className="text-gray-400 mb-2">Customer Preferences</p>
                      <div className="bg-gray-900 p-4 rounded-lg">
                        <pre className="text-white text-xs whitespace-pre-wrap">
                          {JSON.stringify(order.customer.preferences, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button 
                variant="outline" 
                className="w-full mt-4 text-jade-400 border-jade-500/50 hover:bg-jade-500/10"
              >
                View All Customer Orders
              </Button>
               <Button
                  variant="outline"
                  onClick={() => setShowInvoiceModal(true)}
                  className="bg-blue-500 hover:bg-blue-400 text-white"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Invoice
                </Button>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-gray-400">
            Order not found
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Invoice Modal */}
      {order && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          prefilledCustomer={{
            name: order.customer.name,
            email: order.customer.email,
            phone: order.customer.phone || '',
            address: order.customer.address || ''
          }}
          prefilledItems={[{
            description: order.description,
            quantity: 1,
            price: order.price
          }]}
        />
      )}
    </Dialog>
  );
}
