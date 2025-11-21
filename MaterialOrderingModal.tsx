
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Clock, Package } from 'lucide-react';

interface MaterialOrderingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderIds: string[];
  duplicateCheck?: {
    isDuplicate: boolean;
    existingOrders: any[];
    requiresOverride: boolean;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
  onConfirmOrder: (overrideCode?: string, reason?: string) => Promise<void>;
  isLoading: boolean;
}

export function MaterialOrderingModal({
  isOpen,
  onClose,
  orderIds,
  duplicateCheck,
  onConfirmOrder,
  isLoading
}: MaterialOrderingModalProps) {
  const [overrideCode, setOverrideCode] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideForm, setShowOverrideForm] = useState(false);

  const handleSubmit = async () => {
    if (duplicateCheck?.requiresOverride) {
      if (!overrideCode.trim()) {
        alert('Management override code is required');
        return;
      }
      if (!overrideReason.trim()) {
        alert('Override reason is required');
        return;
      }
    }

    await onConfirmOrder(
      duplicateCheck?.requiresOverride ? overrideCode : undefined,
      duplicateCheck?.requiresOverride ? overrideReason : undefined
    );
    
    // Reset form
    setOverrideCode('');
    setOverrideReason('');
    setShowOverrideForm(false);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'bg-red-100 border-red-500 text-red-800';
      case 'HIGH': return 'bg-orange-100 border-orange-500 text-orange-800';
      case 'MEDIUM': return 'bg-yellow-100 border-yellow-500 text-yellow-800';
      default: return 'bg-green-100 border-green-500 text-green-800';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'CRITICAL':
      case 'HIGH':
        return <AlertTriangle className="h-5 w-5" />;
      case 'MEDIUM':
        return <Clock className="h-5 w-5" />;
      default:
        return <Package className="h-5 w-5" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Material Ordering Confirmation
          </DialogTitle>
          <DialogDescription>
            Ordering materials for {orderIds.length} order{orderIds.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Risk Assessment */}
          {duplicateCheck && (
            <Alert className={getRiskColor(duplicateCheck.riskLevel)}>
              <div className="flex items-center gap-2">
                {getRiskIcon(duplicateCheck.riskLevel)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="font-semibold">
                      {duplicateCheck.riskLevel} RISK
                    </Badge>
                    {duplicateCheck.isDuplicate && (
                      <Badge variant="destructive">DUPLICATE DETECTED</Badge>
                    )}
                  </div>
                  <AlertDescription>
                    {duplicateCheck.isDuplicate ? (
                      <>
                        <strong>DUPLICATE ORDER DETECTED:</strong> These orders have been marked for material ordering within the last 24 hours.
                        {duplicateCheck.existingOrders.length > 0 && (
                          <div className="mt-2">
                            <strong>Existing orders:</strong>
                            <ul className="list-disc list-inside mt-1">
                              {duplicateCheck.existingOrders.map((order, idx) => (
                                <li key={idx} className="text-sm">
                                  Order {order.orderId} - {new Date(order.orderedAt).toLocaleString()}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      `${duplicateCheck.riskLevel} risk level detected. Similar material orders or vendor limits may have been reached.`
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          {/* Management Override Required */}
          {duplicateCheck?.requiresOverride && (
            <Alert className="border-red-500 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>MANAGEMENT AUTHORIZATION REQUIRED</strong><br />
                This operation requires management override to prevent duplicate material ordering.
              </AlertDescription>
            </Alert>
          )}

          {/* Order List */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="font-semibold mb-2">Orders to Process:</h4>
            <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
              {orderIds.map(id => (
                <Badge key={id} variant="outline" className="text-xs">
                  {id}
                </Badge>
              ))}
            </div>
          </div>

          {/* Override Form */}
          {duplicateCheck?.requiresOverride && (
            <div className="border-2 border-red-200 rounded-lg p-4 bg-red-50">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5 text-red-600" />
                <h4 className="font-semibold text-red-800">Management Override</h4>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="overrideCode" className="text-red-800">
                    Management Override Code *
                  </Label>
                  <Input
                    id="overrideCode"
                    type="password"
                    value={overrideCode}
                    onChange={(e) => setOverrideCode(e.target.value)}
                    placeholder="Enter management override code"
                    className="border-red-300 focus:border-red-500"
                  />
                </div>
                
                <div>
                  <Label htmlFor="overrideReason" className="text-red-800">
                    Override Reason *
                  </Label>
                  <Textarea
                    id="overrideReason"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Explain why this override is necessary..."
                    className="border-red-300 focus:border-red-500"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Safe Ordering */}
          {!duplicateCheck?.requiresOverride && (
            <Alert className="border-green-500 bg-green-50">
              <Package className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>SAFE TO PROCEED</strong><br />
                No duplicate orders or risk factors detected.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || (duplicateCheck?.requiresOverride && (!overrideCode.trim() || !overrideReason.trim()))}
            className={duplicateCheck?.requiresOverride ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
          >
            {isLoading ? 'Processing...' : duplicateCheck?.requiresOverride ? 'Override & Order Materials' : 'Order Materials'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
