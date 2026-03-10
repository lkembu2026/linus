"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getUsers,
  updateUserRole,
  updateUserBranch,
  toggleUserActive,
} from "@/actions/users";
import { registerUser } from "@/actions/auth";
import { ROLES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import {
  Users,
  Plus,
  Shield,
  Building2,
  Loader2,
  UserCheck,
  UserX,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import type { User, Branch } from "@/types/database";

interface UsersClientProps {
  users: (User & { branch?: { name: string } | null })[];
  branches: Branch[];
  currentUserId: string;
}

export function UsersClient({
  users: initialUsers,
  branches,
  currentUserId,
}: UsersClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [isPending, startTransition] = useTransition();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(users.length / PAGE_SIZE);
  const pagedUsers = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const [showPassword, setShowPassword] = useState(false);
  const [regForm, setRegForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "cashier",
    branch_id: "",
  });

  async function refresh() {
    const updated = await getUsers();
    setUsers(updated);
  }

  function handleRoleChange(userId: string, role: string) {
    startTransition(async () => {
      const result = await updateUserRole(userId, role);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Role updated");
      await refresh();
    });
  }

  function handleBranchChange(userId: string, branchId: string) {
    startTransition(async () => {
      const result = await updateUserBranch(userId, branchId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Branch updated");
      await refresh();
    });
  }

  function handleToggleActive(userId: string, isActive: boolean) {
    startTransition(async () => {
      const result = await toggleUserActive(userId, isActive);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isActive ? "User activated" : "User deactivated");
      await refresh();
    });
  }

  function handleRegister() {
    const isAdminReg = regForm.role === "admin";
    if (
      !regForm.email ||
      !regForm.password ||
      !regForm.full_name ||
      (!isAdminReg && !regForm.branch_id)
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    startTransition(async () => {
      const result = await registerUser(regForm);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("User registered successfully");
      setRegisterOpen(false);
      setRegForm({
        email: "",
        password: "",
        full_name: "",
        role: "cashier",
        branch_id: "",
      });
      await refresh();
    });
  }

  const roleColors: Record<string, string> = {
    admin: "border-primary text-primary",
    pharmacist: "border-blue-500 text-blue-500",
    cashier: "border-amber-500 text-amber-500",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white font-[family-name:var(--font-sans)]">
            User Management
          </h1>
          <p className="text-muted-foreground text-sm">
            {users.length} user{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          onClick={() => setRegisterOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
        >
          <Plus className="h-4 w-4 mr-2" />
          Register User
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            All Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground hidden md:table-cell">
                    Email
                  </TableHead>
                  <TableHead className="text-muted-foreground">Role</TableHead>
                  <TableHead className="text-muted-foreground">
                    Branch
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-muted-foreground hidden sm:table-cell">
                    Joined
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedUsers.map((u) => (
                  <TableRow key={u.id} className="border-border">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary text-xs font-bold">
                            {u.full_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </span>
                        </div>
                        <span className="text-white font-medium">
                          {u.full_name}
                        </span>
                        {u.id === currentUserId && (
                          <Badge
                            variant="outline"
                            className="border-primary text-primary text-xs"
                          >
                            You
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      {u.id === currentUserId ? (
                        <Badge
                          variant="outline"
                          className={roleColors[u.role] || ""}
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          {u.role}
                        </Badge>
                      ) : (
                        <Select
                          value={u.role}
                          onValueChange={(v) => handleRoleChange(u.id, v)}
                          disabled={isPending}
                        >
                          <SelectTrigger className="w-24 sm:w-32 bg-background border-border text-white h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            {Object.values(ROLES).map((r) => (
                              <SelectItem
                                key={r}
                                value={r}
                                className="text-white focus:bg-primary/10"
                              >
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.branch_id ?? ""}
                        onValueChange={(v) => handleBranchChange(u.id, v)}
                        disabled={isPending || u.id === currentUserId}
                      >
                        <SelectTrigger className="w-28 sm:w-36 bg-background border-border text-white h-8 text-xs">
                          <SelectValue placeholder="Assign branch" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {branches.map((b) => (
                            <SelectItem
                              key={b.id}
                              value={b.id}
                              className="text-white focus:bg-primary/10"
                            >
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {b.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {u.id === currentUserId ? (
                        <Badge
                          variant="outline"
                          className="border-green-500 text-green-500"
                        >
                          <UserCheck className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={u.is_active}
                            onCheckedChange={(v) => handleToggleActive(u.id, v)}
                            disabled={isPending}
                          />
                          <span
                            className={
                              u.is_active
                                ? "text-green-500 text-xs"
                                : "text-destructive text-xs"
                            }
                          >
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs hidden sm:table-cell">
                      {formatDate(u.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} ({users.length} users)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-muted-foreground h-8"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-muted-foreground h-8"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Register Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white font-[family-name:var(--font-sans)]">
              Register New User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-muted-foreground">Full Name *</Label>
              <Input
                value={regForm.full_name}
                onChange={(e) =>
                  setRegForm({ ...regForm, full_name: e.target.value })
                }
                className="bg-background border-border text-white mt-1"
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Email *</Label>
              <Input
                type="email"
                value={regForm.email}
                onChange={(e) =>
                  setRegForm({ ...regForm, email: e.target.value })
                }
                className="bg-background border-border text-white mt-1"
                placeholder="user@pharmacy.com"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Password *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={regForm.password}
                  onChange={(e) =>
                    setRegForm({ ...regForm, password: e.target.value })
                  }
                  className="bg-background border-border text-white mt-1 pr-10"
                  placeholder="Min 6 characters"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-1 h-8 w-8 px-0 text-muted-foreground hover:text-white"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Role</Label>
              <Select
                value={regForm.role}
                onValueChange={(v) => setRegForm({ ...regForm, role: v })}
              >
                <SelectTrigger className="bg-background border-border text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {Object.values(ROLES).map((r) => (
                    <SelectItem
                      key={r}
                      value={r}
                      className="text-white focus:bg-primary/10"
                    >
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {regForm.role !== "admin" && (
              <div>
                <Label className="text-muted-foreground">Branch *</Label>
                <Select
                  value={regForm.branch_id}
                  onValueChange={(v) => setRegForm({ ...regForm, branch_id: v })}
                >
                  <SelectTrigger className="bg-background border-border text-white mt-1">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {branches.map((b) => (
                      <SelectItem
                        key={b.id}
                        value={b.id}
                        className="text-white focus:bg-primary/10"
                      >
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {regForm.role === "admin" && (
              <p className="text-xs text-muted-foreground">
                Admins have access to all branches.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRegisterOpen(false)}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegister}
              disabled={isPending}
              className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Register"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
