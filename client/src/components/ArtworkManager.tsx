import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ImageIcon, Upload, X, MapPin, Package, Calendar, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ArtworkManagerProps {
  orderId: string;
  artworkImages?: string[];
  artworkLocation?: string;
  artworkReceived?: boolean;
  artworkReceivedDate?: string;
}

export default function ArtworkManager({ 
  orderId, 
  artworkImages = [], 
  artworkLocation,
  artworkReceived = false,
  artworkReceivedDate 
}: ArtworkManagerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  // File selection handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(e.target.files);
  };

  const [location, setLocation] = useState(artworkLocation || "");

  // Get common locations
  const { data: locations = [] } = useQuery<string[]>({
    queryKey: ['/api/artwork/locations']
  });

  // Upload artwork image mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('artwork', file);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/orders/${orderId}/artwork/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload image');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Image Uploaded",
        description: "Artwork image has been uploaded successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      setSelectedFiles(null);
    },
    onError: () => {
      toast({
        title: "Upload Failed",
        description: "Failed to upload artwork image",
        variant: "destructive"
      });
    }
  });

  // Update location mutation
  const locationMutation = useMutation({
    mutationFn: async (newLocation: string) => {
      console.log("Updating location to:", newLocation);
      const response = await fetch(`/api/orders/${orderId}/artwork/location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: newLocation })
      });
      if (!response.ok) {
        const error = await response.text();
        console.error("Location update failed:", error);
        throw new Error('Failed to update location');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Location Updated",
        description: "Artwork location has been updated"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
    },
    onError: (error) => {
      console.error("Location mutation error:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update artwork location",
        variant: "destructive"
      });
    }
  });

  // Update received status mutation
  const receivedMutation = useMutation({
    mutationFn: async (received: boolean) => {
      console.log("Updating received status to:", received);
      const response = await fetch(`/api/orders/${orderId}/artwork/received`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received })
      });
      if (!response.ok) {
        const error = await response.text();
        console.error("Received status update failed:", error);
        throw new Error('Failed to update status');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Artwork received status has been updated"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
    },
    onError: (error) => {
      console.error("Received status mutation error:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update received status",
        variant: "destructive"
      });
    }
  });

  // Remove image mutation
  const removeMutation = useMutation({
    mutationFn: (imageUrl: string) => 
      fetch(`/api/orders/${orderId}/artwork/${encodeURIComponent(imageUrl)}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      toast({
        title: "Image Removed",
        description: "Artwork image has been removed"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    }
  });

  const handleUploadFile = () => {
    if (selectedFiles && selectedFiles.length > 0) {
      uploadMutation.mutate(selectedFiles[0]);
    }
  };

  const handleLocationUpdate = (newLocation: string) => {
    setLocation(newLocation);
    locationMutation.mutate(newLocation);
  };

  const handleReceivedToggle = (received: boolean) => {
    receivedMutation.mutate(received);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <ImageIcon className="h-5 w-5" />
          <span>Artwork Management</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Artwork Received Status */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Artwork Received</Label>
            <p className="text-xs text-muted-foreground">
              Mark when customer artwork has been received
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={artworkReceived}
              onCheckedChange={handleReceivedToggle}
              disabled={receivedMutation.isPending}
            />
            {artworkReceived && (
              <Badge variant="secondary" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                {artworkReceivedDate ? new Date(artworkReceivedDate).toLocaleDateString() : 'Today'}
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Artwork Location */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center">
            <MapPin className="h-4 w-4 mr-1" />
            Artwork Location
          </Label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onBlur={() => {
                  if (location !== artworkLocation) {
                    locationMutation.mutate(location);
                  }
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    locationMutation.mutate(location);
                  }
                }}
                placeholder="Enter artwork location..."
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-jade-500"
                disabled={locationMutation.isPending}
              />
              <Button
                onClick={() => locationMutation.mutate(location)}
                disabled={locationMutation.isPending || location === artworkLocation}
                size="sm"
                className="bg-jade-600 hover:bg-jade-700 text-white"
              >
                {locationMutation.isPending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {[
                "Front Counter", "Storage Room A", "Storage Room B", 
                "Work Station 1", "Work Station 2", "Framing Area"
              ].map((loc) => (
                <button
                  key={loc}
                  onClick={() => {
                    setLocation(loc);
                    locationMutation.mutate(loc);
                  }}
                  className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded border border-gray-600"
                  disabled={locationMutation.isPending}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
          {location && (
            <Badge variant="outline" className="w-fit">
              <Package className="h-3 w-3 mr-1" />
              {location}
            </Badge>
          )}
        </div>

        <Separator />

        {/* Image Upload */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Upload Artwork Images</Label>
          <div className="flex items-center space-x-2">
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploadMutation.isPending}
              className="flex-1"
            />
            <Button 
              onClick={handleUploadFile}
              disabled={!selectedFiles || uploadMutation.isPending}
              size="sm"
              className="bg-jade-600 hover:bg-jade-700"
            >
              <Upload className="h-4 w-4 mr-1" />
              {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
          <p className="text-xs text-gray-400">
            Upload photos of customer artwork to keep track of what you're working with
          </p>
        </div>

        {/* Artwork Images Gallery */}
        {artworkImages.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center">
              <ImageIcon className="h-4 w-4 mr-1" />
              Customer Artwork ({artworkImages.length} {artworkImages.length === 1 ? 'image' : 'images'})
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {artworkImages.map((imageUrl, index) => (
                <div key={index} className="relative group">
                  <div className="relative bg-gray-800 rounded-lg border border-gray-600 overflow-hidden">
                    <img
                      src={imageUrl}
                      alt={`Customer Artwork ${index + 1}`}
                      className="w-full h-32 object-cover hover:scale-105 transition-transform duration-200 cursor-pointer"
                      onClick={() => window.open(imageUrl, '_blank')}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200" />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeMutation.mutate(imageUrl)}
                      disabled={removeMutation.isPending}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-center">
                    Image {index + 1}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Click images to view full size • Hover and click X to remove
            </p>
          </div>
        )}

        {artworkImages.length === 0 && (
          <div className="text-center py-6 border-2 border-dashed border-gray-600 rounded-lg bg-gray-800/20">
            <ImageIcon className="h-8 w-8 mx-auto mb-2 text-gray-500" />
            <p className="text-sm text-gray-400 font-medium">No artwork images uploaded yet</p>
            <p className="text-xs text-gray-500">Upload photos of customer artwork to keep visual records for each order</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
