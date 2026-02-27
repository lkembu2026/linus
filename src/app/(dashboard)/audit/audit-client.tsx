"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { getAuditLogs } from "@/actions/audit";
import { formatDateTime } from "@/lib/utils";
import {
  ScrollText,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Filter,
  X,
} from "lucide-react";

interface AuditClientProps {
  initialLogs: any[];
  initialTotal: number;
  users: { id: string; full_name: string }[];
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

export function AuditClient({
  initialLogs,
  initialTotal,
  users,
}: AuditClientProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [filterAction, setFilterAction] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const limit = 50;
  const totalPages = Math.ceil(total / limit);

  const hasFilters = filterAction || filterUser || dateFrom || dateTo;

  function buildFilters() {
    return {
      action: filterAction || undefined,
      userId: filterUser || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    };
  }

  function loadPage(p: number) {
    startTransition(async () => {
      const { logs: newLogs, total: newTotal } = await getAuditLogs(
        p,
        limit,
        buildFilters(),
      );
      setLogs(newLogs);
      setTotal(newTotal);
      setPage(p);
    });
  }

  function applyFilters() {
    setPage(1);
    loadPage(1);
  }

  function clearFilters() {
    setFilterAction("");
    setFilterUser("");
    setDateFrom("");
    setDateTo("");
    startTransition(async () => {
      const { logs: newLogs, total: newTotal } = await getAuditLogs(1, limit);
      setLogs(newLogs);
      setTotal(newTotal);
      setPage(1);
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

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-white">Filters</span>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground text-xs h-auto py-0.5 px-2 ml-auto"
                onClick={clearFilters}
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="bg-background border-border text-white h-9 text-xs">
                <SelectValue placeholder="Action type" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {Object.entries(ACTION_LABELS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    {val.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="bg-background border-border text-white h-9 text-xs">
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-background border-border text-white h-9 text-xs"
              placeholder="From date"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-background border-border text-white h-9 text-xs"
              placeholder="To date"
            />
            <Button
              onClick={applyFilters}
              disabled={isPending}
              className="bg-primary text-primary-foreground hover:bg-[#00B8A9] h-9 text-xs"
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

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
