"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "@/actions/transfers";
import { formatDateTime } from "@/lib/utils";
import {
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { User, Branch } from "@/types/database";

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

  async function refresh() {
    const updated = await getTransfers();
    setTransfers(updated);
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
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white font-[family-name:var(--font-sans)]">
          Stock Transfers
        </h1>
        <p className="text-muted-foreground text-sm">
          {transfers.length} transfer{transfers.length !== 1 ? "s" : ""}
        </p>
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
    </div>
  );
}
