
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, getDocs, query, where, Timestamp, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, type AppUser } from "@/context/auth-context";
import { ArrowLeft, PlusCircle, Check, X, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NewItemRequestForm } from "../../new-item-request-form";
import { useToast } from "@/hooks/use-toast";
import { updateBucketStatus } from "../../actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { BucketItemActions } from "./bucket-item-actions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const getBucketStatusConfig = (status: string) => {
  switch (status) {
    case 'open': return { color: 'bg-green-500', tooltip: 'Open' };
    case 'closed': return { color: 'bg-yellow-500', tooltip: 'Closed (Pending Approval)' };
    case 'ordered': return { color: 'bg-blue-500', tooltip: 'Ordered' };
    case 'received': return { color: 'bg-teal-500', tooltip: 'Received' };
    default: return { color: 'bg-gray-400', tooltip: 'Unknown' };
  }
};

const getRequestStatusConfig = (status: string) => {
  switch (status) {
    case 'pending': return { color: 'bg-yellow-500', tooltip: 'Pending' };
    case 'approved': return { color: 'bg-blue-500', tooltip: 'Approved' };
    case 'rejected': return { color: 'bg-red-500', tooltip: 'Rejected' };
    case 'ordered': return { color: 'bg-orange-500', tooltip: 'Ordered' };
    case 'received': return { color: 'bg-green-500', tooltip: 'Received' };
    default: return { color: 'bg-gray-400', tooltip: 'Unknown' };
  }
};

const StatusCircle = ({ status, type }: { status: string, type: 'bucket' | 'request' }) => {
  const config = type === 'bucket' ? getBucketStatusConfig(status) : getRequestStatusConfig(status);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger>
          <div className={cn("h-3 w-3 rounded-full", config.color)}></div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};


// Helper to convert Firestore Timestamps to strings for client-side state
const serializeFirestoreTimestamps = (data: any): any => {
    if (!data) return data;
    if (Array.isArray(data)) {
        return data.map(serializeFirestoreTimestamps);
    }
    if (typeof data === 'object' && data !== null) {
        if (data instanceof Timestamp) {
            return data.toDate().toISOString();
        }
        const newObj: { [key: string]: any } = {};
        for (const key in data) {
            newObj[key] = serializeFirestoreTimestamps(data[key]);
        }
        return newObj;
    }
    return data;
};

export default function BucketDetailsClient({ initialData, bucketId }: { initialData: any, bucketId: string }) {
    const [data, setData] = useState<any>(initialData);
    const [loading, setLoading] = useState(!initialData);
    const [isNewItemFormOpen, setIsNewItemFormOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const { user: currentUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        if (!bucketId) return;

        setLoading(true);

        const bucketRef = doc(db, "procurement_buckets", bucketId);
        
        const unsubscribeBucket = onSnapshot(bucketRef, async (bucketSnap) => {
            if (!bucketSnap.exists()) {
                setData(null);
                setLoading(false);
                return;
            }

            const bucketData = bucketSnap.data();
            const memberIds = Array.isArray(bucketData.members) && bucketData.members.length > 0 ? bucketData.members : [];
            
            let members: AppUser[] = [];
            if (memberIds.length > 0) {
                const usersQuery = query(collection(db, "users"), where("id", "in", memberIds));
                const usersSnap = await getDocs(usersQuery);
                members = usersSnap.docs.map(doc => serializeFirestoreTimestamps({ id: doc.id, ...doc.data() })) as AppUser[];
            }

            // Also listen to requests
            const requestsQuery = query(collection(db, "new_item_requests"), where("linkedBucketId", "==", bucketId));
            const unsubscribeRequests = onSnapshot(requestsQuery, (requestsSnap) => {
                const requests = requestsSnap.docs.map(doc => serializeFirestoreTimestamps({ id: doc.id, ...doc.data() }));

                setData({
                    bucket: serializeFirestoreTimestamps({ id: bucketSnap.id, ...bucketData }),
                    members,
                    requests,
                });
                setLoading(false);
            });
            
            // Return a function to cleanup both listeners
            return () => {
                unsubscribeRequests();
            };
        });

        // Cleanup subscription on unmount
        return () => {
            unsubscribeBucket();
        };
    }, [bucketId]);


    const handleFormSubmit = () => {
        setIsNewItemFormOpen(false);
    };

    const handleUpdateStatus = async (status: "open" | "closed" | "ordered" | "received") => {
        setActionLoading(true);
        try {
            await updateBucketStatus(bucketId, status);
            toast({ title: "Bucket Updated", description: `The bucket is now ${status}.` });
        } catch (error) {
            toast({ variant: "destructive", title: "Update Failed", description: (error as Error).message });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading || authLoading || !data || !data.bucket) {
        return (
             <div className="space-y-6">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-6 w-2/3" />
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-1/4" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-24 w-full" />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-1/4" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-48 w-full" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    const { bucket, requests, members } = data;
    const isManager = currentUser?.permissions?.canApproveNewItemRequest;
    const isCreator = currentUser?.uid === bucket.createdBy;
    
    const creator = members.find((m: any) => m.id === bucket.createdBy);
    const totalEstimatedCost = requests.reduce((acc: number, req: any) => acc + (req.estimatedCost * req.quantity || 0), 0);
    const totalApprovedCost = requests
        .filter((req: any) => req.status === 'approved')
        .reduce((acc: number, req: any) => acc + (req.estimatedCost * req.quantity || 0), 0);

    return (
        <Dialog>
            <div className="space-y-8">
                <div className="flex items-start justify-between">
                    <div>
                        <Link href="/dashboard/procurement" className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
                           <ArrowLeft className="mr-2 h-4 w-4" /> Back to Procurement
                        </Link>
                        <div className="flex items-center gap-4">
                            <h2 className="text-3xl font-bold tracking-tight font-headline">{bucket.description}</h2>
                            <StatusCircle status={bucket.status} type="bucket" />
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Started by {creator?.name} on {bucket.createdAt ? format(new Date(bucket.createdAt), "MMM d, yyyy") : 'N/A'}
                        </p>
                    </div>
                     {bucket.status === 'open' && (
                        <Dialog open={isNewItemFormOpen} onOpenChange={setIsNewItemFormOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Item Request
                                </Button>
                            </DialogTrigger>
                             <DialogContent>
                                <DialogHeader>
                                <DialogTitle>Add Item to Bucket</DialogTitle>
                                <DialogDescription>Fill out the details for the item you want to request.</DialogDescription>
                                </DialogHeader>
                                <NewItemRequestForm
                                    bucketId={bucketId}
                                    currentUser={currentUser}
                                    setOpen={setIsNewItemFormOpen}
                                    onFormSubmit={handleFormSubmit}
                                />
                            </DialogContent>
                        </Dialog>
                    )}
                </div>

                {isCreator && ['open', 'closed', 'ordered'].includes(bucket.status) && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Creator Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center gap-2">
                             {bucket.status === 'open' && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" disabled={actionLoading}>
                                            {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Close Bucket
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Closing this bucket will prevent any new items from being added. This will submit the bucket for approval before ordering.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleUpdateStatus('closed')}>Confirm Close</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                             )}
                              {bucket.status === 'closed' && (
                                <Button onClick={() => handleUpdateStatus('ordered')} disabled={actionLoading}>
                                    {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Mark as Ordered
                                </Button>
                            )}
                            {bucket.status === 'ordered' && (
                                <Button onClick={() => handleUpdateStatus('received')} disabled={actionLoading}>
                                    {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Mark as Received
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                )}

                 {isManager && ['closed', 'ordered', 'received'].includes(bucket.status) && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Manager Summary</CardTitle>
                            <CardDescription>
                                Total cost for approved items: <span className="font-bold font-mono text-foreground">₹{totalApprovedCost.toFixed(2)}</span>
                            </CardDescription>
                        </CardHeader>
                    </Card>
                )}


                <Card>
                    <CardHeader>
                        <CardTitle>Requested Items</CardTitle>
                        <CardDescription>
                            Total Estimated Cost (All Items): <span className="font-bold font-mono text-foreground">₹{totalEstimatedCost.toFixed(2)}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead>Requested By</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requests && requests.length > 0 ? requests.map((req: any) => {
                                    const user = members.find((u: any) => u.id === req.requestedById);
                                    return (
                                        <DialogTrigger key={req.id} asChild>
                                            <TableRow className="cursor-pointer" onClick={() => setSelectedRequest(req)}>
                                                <TableCell>
                                                    <div className="font-medium">{req.itemName}</div>
                                                </TableCell>
                                                <TableCell>{user?.name || 'Unknown'}</TableCell>
                                                <TableCell><StatusCircle status={req.status} type="request" /></TableCell>
                                            </TableRow>
                                        </DialogTrigger>
                                    )
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center h-24">
                                            No items have been requested in this bucket yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            
            <DialogContent>
                {selectedRequest && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="font-headline text-2xl">{selectedRequest.itemName}</DialogTitle>
                            <DialogDescription>
                                Requested by {members.find((u: any) => u.id === selectedRequest.requestedById)?.name || 'Unknown'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Status</span>
                                <div className="flex items-center gap-2">
                                     <StatusCircle status={selectedRequest.status} type="request" />
                                     <span className="font-medium capitalize">{selectedRequest.status.replace(/_/g, ' ')}</span>
                                </div>
                            </div>
                             <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Quantity</span>
                                <span className="font-medium">{selectedRequest.quantity}</span>
                            </div>
                             <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Est. Cost / piece</span>
                                <span className="font-mono">₹{selectedRequest.estimatedCost.toFixed(2)}</span>
                            </div>
                             <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Est. Total Cost</span>
                                <span className="font-mono font-bold">₹{(selectedRequest.estimatedCost * selectedRequest.quantity).toFixed(2)}</span>
                            </div>
                            <div>
                                <h4 className="font-medium mb-1">Justification</h4>
                                <p className="text-sm text-muted-foreground">{selectedRequest.justification}</p>
                            </div>
                             {selectedRequest.rejectionReason && (
                                <div>
                                    <h4 className="font-medium mb-1 text-destructive">Rejection Reason</h4>
                                    <p className="text-sm text-destructive/80">{selectedRequest.rejectionReason}</p>
                                </div>
                            )}
                        </div>
                        {isManager && bucket.status === 'closed' && selectedRequest.status === 'pending' && (
                            <div className="pt-4 border-t">
                                <BucketItemActions requestId={selectedRequest.id} itemName={selectedRequest.itemName} />
                            </div>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

    