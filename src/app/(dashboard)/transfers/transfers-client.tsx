"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  approveTransfer,
  rejectTransfer,
  getTransfers,
  createTransfer,
} from "@/actions/transfers";
import { getMedicines } from "@/actions/inventory";
import { formatDateTime } from "@/lib/utils";
import {
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import type { User, Branch, Medicine } from "@/types/database";

interface TransfersClientProps {
  user: User & { branch?: { name: string } | null };
  transfers: any[];
  branches: Branch[];
}

export function TransfersClient({
  user,
  transfers: initialTransfers,
  branches,
}: TransfersClientProps) {
  const [transfers, setTransfers] = useState(initialTransfers);
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState("");
  const [fromBranch, setFromBranch] = useState(user.branch_id ?? "");
  const [toBranch, setToBranch] = useState("");
  const [quantity, setQuantity] = useState("");

  async function refresh() {
    const updated = await getTransfers();
    setTransfers(updated);
  }

  async function handleOpenDialog() {
    // Load medicines for the source branch
    const meds = await getMedicines();
    setMedicines(meds as Medicine[]);
    setFromBranch(user.branch_id ?? "");
    setToBranch("");
    setSelectedMedicine("");
    setQuantity("");
    setDialogOpen(true);
  }

  function handleCreateTransfer() {
    if (!selectedMedicine || !fromBranch || !toBranch || !quantity) {
      toast.error("Please fill all fields");
      return;
    }
    startTransition(async () => {
      const result = await createTransfer({
        medicine_id: selectedMedicine,
        from_branch_id: fromBranch,
        to_branch_id: toBranch,
        quantity: parseInt(quantity, 10),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Transfer request created");
      setDialogOpen(false);
      await refresh();
    });
  }

  function handleApprove(id: string) {
    startTransition(async () => {
      const result = await approveTransfer(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Transfer approved");
      await refresh();
    });
  }

  function handleReject(id: string) {
    startTransition(async () => {
      const result = await rejectTransfer(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Transfer rejected");
      await refresh();
    });
  }

  const statusConfig: Record<string, { icon: any; color: string }> = {
    pending: { icon: Clock, color: "border-amber-500 text-amber-500" },
    approved: { icon: CheckCircle, color: "border-green-500 text-green-500" },
    rejected: { icon: XCircle, color: "border-destructive text-destructive" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white font-[family-name:var(--font-sans)]">
            Stock Transfers
          </h1>
          <p className="text-muted-foreground text-sm">
            {transfers.length} transfer{transfers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          onClick={handleOpenDialog}
          className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Transfer
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            Transfer History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transfers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No transfers yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">
                      Medicine
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      From
                    </TableHead>
                    <TableHead className="text-muted-foreground">To</TableHead>
                    <TableHead className="text-muted-foreground text-right">
                      Qty
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Requested By
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Date
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      Status
                    </TableHead>
                    {user.role === "admin" && (
                      <TableHead className="text-muted-foreground text-right">
                        Actions
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((t) => {
                    const statusInfo =
                      statusConfig[t.status] || statusConfig.pending;
                    const StatusIcon = statusInfo.icon;
                    return (
                      <TableRow key={t.id} className="border-border">
                        <TableCell className="text-white font-medium">
                          {t.medicine?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.from_branch?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.to_branch?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-primary font-medium">
                          {t.quantity}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.requested_by_user?.full_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDateTime(t.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusInfo.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {t.status}
                          </Badge>
                        </TableCell>
                        {user.role === "admin" && (
                          <TableCell className="text-right">
                            {t.status === "pending" && (
                              <div className="flex gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-500 hover:text-green-400 h-7"
                                  onClick={() => handleApprove(t.id)}
                                  disabled={isPending}
                                >
                                  {isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Approve
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive/80 h-7"
                                  onClick={() => handleReject(t.id)}
                                  disabled={isPending}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Transfer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white font-[family-name:var(--font-sans)]">
              New Stock Transfer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-muted-foreground text-sm">Medicine</Label>
              <Select
                value={selectedMedicine}
                onValueChange={setSelectedMedicine}
              >
                <SelectTrigger className="bg-background border-border text-white mt-1">
                  <SelectValue placeholder="Select medicine" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {medicines.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} (Stock: {m.quantity_in_stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">
                From Branch
              </Label>
              <Select value={fromBranch} onValueChange={setFromBranch}>
                <SelectTrigger className="bg-background border-border text-white mt-1">
                  <SelectValue placeholder="Source branch" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">To Branch</Label>
              <Select value={toBranch} onValueChange={setToBranch}>
                <SelectTrigger className="bg-background border-border text-white mt-1">
                  <SelectValue placeholder="Destination branch" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {branches
                    .filter((b) => b.id !== fromBranch)
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Quantity</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="bg-background border-border text-white mt-1"
                placeholder="Enter quantity"
                min={1}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTransfer}
              disabled={isPending}
              className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Request Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
