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
import { getAuditLogs } from "@/actions/audit";
import { formatDateTime } from "@/lib/utils";
import { ScrollText, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface AuditClientProps {
  initialLogs: any[];
  initialTotal: number;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create_medicine: {
    label: "Create Medicine",
    color: "border-green-500 text-green-500",
  },
  update_medicine: {
    label: "Update Medicine",
    color: "border-blue-500 text-blue-500",
  },
  delete_medicine: {
    label: "Delete Medicine",
    color: "border-destructive text-destructive",
  },
  stock_adjustment: {
    label: "Stock Adjust",
    color: "border-amber-500 text-amber-500",
  },
  create_branch: {
    label: "Create Branch",
    color: "border-green-500 text-green-500",
  },
  update_branch: {
    label: "Update Branch",
    color: "border-blue-500 text-blue-500",
  },
  delete_branch: {
    label: "Delete Branch",
    color: "border-destructive text-destructive",
  },
  create_sale: { label: "New Sale", color: "border-primary text-primary" },
  void_sale: {
    label: "Void Sale",
    color: "border-destructive text-destructive",
  },
  register_user: {
    label: "Register User",
    color: "border-green-500 text-green-500",
  },
  change_user_role: {
    label: "Change Role",
    color: "border-amber-500 text-amber-500",
  },
  change_user_branch: {
    label: "Change Branch",
    color: "border-blue-500 text-blue-500",
  },
  activate_user: {
    label: "Activate User",
    color: "border-green-500 text-green-500",
  },
  deactivate_user: {
    label: "Deactivate User",
    color: "border-destructive text-destructive",
  },
};

export function AuditClient({ initialLogs, initialTotal }: AuditClientProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const limit = 50;
  const totalPages = Math.ceil(total / limit);

  function loadPage(p: number) {
    startTransition(async () => {
      const { logs: newLogs, total: newTotal } = await getAuditLogs(p, limit);
      setLogs(newLogs);
      setTotal(newTotal);
      setPage(p);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white font-[family-name:var(--font-sans)]">
          Audit Log
        </h1>
        <p className="text-muted-foreground text-sm">{total} total entries</p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" />
            Activity History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No audit logs yet
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">
                        Timestamp
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        User
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Action
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Details
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const actionInfo = ACTION_LABELS[log.action] || {
                        label: log.action,
                        color: "border-border text-muted-foreground",
                      };
                      return (
                        <TableRow key={log.id} className="border-border">
                          <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                            {formatDateTime(log.created_at)}
                          </TableCell>
                          <TableCell className="text-white">
                            {log.user?.full_name ?? "System"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={actionInfo.color}
                            >
                              {actionInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs max-w-xs truncate">
                            {log.details
                              ? JSON.stringify(log.details).slice(0, 120)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border text-muted-foreground"
                      disabled={page <= 1 || isPending}
                      onClick={() => loadPage(page - 1)}
                    >
                      {isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ChevronLeft className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border text-muted-foreground"
                      disabled={page >= totalPages || isPending}
                      onClick={() => loadPage(page + 1)}
                    >
                      {isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
