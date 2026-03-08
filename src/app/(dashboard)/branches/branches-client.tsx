"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createBranch,
  updateBranch,
  deleteBranch,
  getBranches,
} from "@/actions/branches";
import { formatDate } from "@/lib/utils";
import {
  Plus,
  Building2,
  MoreVertical,
  Edit,
  Trash2,
  MapPin,
  Phone,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { Branch } from "@/types/database";

type BranchFormState = {
  name: string;
  location: string;
  phone: string;
  enable_pharmacy: boolean;
  enable_beauty: boolean;
};

interface BranchesClientProps {
  branches: Branch[];
}

export function BranchesClient({
  branches: initialBranches,
}: BranchesClientProps) {
  const [branches, setBranches] = useState(initialBranches);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<BranchFormState>({
    name: "",
    location: "",
    phone: "",
    enable_pharmacy: true,
    enable_beauty: true,
  });

  function formatBranchModes(branch: Branch) {
    if (branch.enable_pharmacy && branch.enable_beauty)
      return "Pharmacy + Beauty";
    if (branch.enable_pharmacy) return "Pharmacy only";
    if (branch.enable_beauty) return "Beauty only";
    return "No modes";
  }

  function openCreate() {
    setEditBranch(null);
    setForm({
      name: "",
      location: "",
      phone: "",
      enable_pharmacy: true,
      enable_beauty: true,
    });
    setDialogOpen(true);
  }

  function openEdit(branch: Branch) {
    setEditBranch(branch);
    setForm({
      name: branch.name,
      location: branch.location ?? "",
      phone: branch.phone ?? "",
      enable_pharmacy: branch.enable_pharmacy,
      enable_beauty: branch.enable_beauty,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Branch name is required");
      return;
    }

    if (!form.enable_pharmacy && !form.enable_beauty) {
      toast.error("Enable at least one mode for the branch");
      return;
    }

    startTransition(async () => {
      const payload = {
        name: form.name,
        location: form.location || undefined,
        phone: form.phone || undefined,
        enable_pharmacy: form.enable_pharmacy,
        enable_beauty: form.enable_beauty,
      };

      const result = editBranch
        ? await updateBranch(editBranch.id, payload)
        : await createBranch(payload);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(editBranch ? "Branch updated" : "Branch created");
      setDialogOpen(false);
      const updated = await getBranches();
      setBranches(updated);
    });
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const result = await deleteBranch(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Branch deleted");
    setBranches((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white font-[family-name:var(--font-sans)]">
            Branches
          </h1>
          <p className="text-muted-foreground text-sm">
            {branches.length} branch{branches.length !== 1 ? "es" : ""}
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Branch
        </Button>
      </div>

      {/* Branch cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map((branch) => (
          <Card key={branch.id} className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base text-white">
                    {branch.name}
                  </CardTitle>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-card border-border"
                  >
                    <DropdownMenuItem
                      className="text-white focus:bg-primary/10 cursor-pointer"
                      onClick={() => openEdit(branch)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:bg-destructive/10 cursor-pointer"
                      onClick={() => handleDelete(branch.id, branch.name)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-primary/30 text-primary"
                  >
                    {formatBranchModes(branch)}
                  </Badge>
                </div>
                {branch.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {branch.location}
                  </div>
                )}
                {branch.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {branch.phone}
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-2">
                  Created {formatDate(branch.created_at)}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white font-[family-name:var(--font-sans)]">
              {editBranch ? "Edit Branch" : "New Branch"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-muted-foreground">Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-background border-border text-white mt-1"
                placeholder="Branch name"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Location</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="bg-background border-border text-white mt-1"
                placeholder="Address or area"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="bg-background border-border text-white mt-1"
                placeholder="+254..."
              />
            </div>
            <div className="space-y-3 rounded-lg border border-border bg-background/40 p-3">
              <div>
                <Label className="text-muted-foreground">Allowed Modes</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose which modes should appear when this branch is selected.
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white">Pharmacy</p>
                  <p className="text-xs text-muted-foreground">
                    Show medicine workflows for this branch
                  </p>
                </div>
                <Switch
                  checked={form.enable_pharmacy}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, enable_pharmacy: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white">Beauty</p>
                  <p className="text-xs text-muted-foreground">
                    Show beauty product workflows for this branch
                  </p>
                </div>
                <Switch
                  checked={form.enable_beauty}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, enable_beauty: checked }))
                  }
                />
              </div>
              <p className="text-xs text-primary">
                At least one mode must remain enabled.
              </p>
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
              onClick={handleSubmit}
              disabled={isPending}
              className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editBranch ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
