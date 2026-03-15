"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import {
  User,
  Shield,
  Building2,
  Key,
  Loader2,
  Wifi,
  WifiOff,
  Monitor,
  Mail,
  Send,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { updateProfile } from "@/actions/auth";
import {
  sendTestDailyReportNow,
  updateReportAutomationSettings,
} from "@/actions/reports";
import { clearAllSalesHistory } from "@/actions/sales";
import { resetAllStock } from "@/actions/inventory";
import type { User as UserType } from "@/types/database";

interface SettingsClientProps {
  user: UserType & { branch?: { name: string } | null };
  initialReportSettings: {
    recipients: string[];
    updated_at: string | null;
    source: "database" | "environment";
  };
}

export function SettingsClient({
  user,
  initialReportSettings,
}: SettingsClientProps) {
  const isOnline = useOnlineStatus();
  const [isPending, startTransition] = useTransition();
  const [isReportsPending, startReportsTransition] = useTransition();
  const [clearingSales, setClearingSales] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [resettingStock, setResettingStock] = useState(false);
  const [confirmResetStock, setConfirmResetStock] = useState(false);
  const [isTestPending, startTestTransition] = useTransition();
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [nameChanged, setNameChanged] = useState(false);
  const [reportRecipients, setReportRecipients] = useState(
    initialReportSettings.recipients.join(", "),
  );
  const [reportSettingsMeta, setReportSettingsMeta] = useState(
    initialReportSettings,
  );
  const [passwords, setPasswords] = useState({
    current: "",
    newPass: "",
    confirm: "",
  });

  function handleNameChange(val: string) {
    setFullName(val);
    setNameChanged(val !== (user.full_name ?? ""));
  }

  function handleSaveName() {
    if (!fullName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    startTransition(async () => {
      const result = await updateProfile(fullName.trim());
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Profile updated");
      setNameChanged(false);
    });
  }

  function handleChangePassword() {
    if (!passwords.current || !passwords.newPass) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (passwords.newPass.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (passwords.newPass !== passwords.confirm) {
      toast.error("Passwords do not match");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: passwords.newPass,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Password updated successfully");
      setPasswords({ current: "", newPass: "", confirm: "" });
    });
  }

  function handleSaveReportRecipients() {
    startReportsTransition(async () => {
      const result = await updateReportAutomationSettings(reportRecipients);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.settings) {
        setReportSettingsMeta(result.settings);
        setReportRecipients(result.settings.recipients.join(", "));
      }

      toast.success("Report recipients updated");
    });
  }

  function handleSendTestReport() {
    startTestTransition(async () => {
      const result = await sendTestDailyReportNow();
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        `Test daily report sent to ${result.recipients.length} recipient${result.recipients.length === 1 ? "" : "s"}`,
      );
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white font-[family-name:var(--font-sans)]">
          Settings
        </h1>
        <p className="text-muted-foreground text-sm">
          Account settings and system information
        </p>
      </div>

      {/* Profile Info */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Full Name</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={fullName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="bg-background border-border text-white h-9"
                />
                {nameChanged && (
                  <Button
                    size="sm"
                    onClick={handleSaveName}
                    disabled={isPending}
                    className="bg-primary text-primary-foreground hover:bg-[#00B8A9] h-9 px-3"
                  >
                    {isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <p className="text-white mt-1">{user.email}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Role</Label>
              <div className="mt-1">
                <Badge
                  variant="outline"
                  className="border-primary text-primary"
                >
                  <Shield className="h-3 w-3 mr-1" />
                  {user.role}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Branch</Label>
              <div className="mt-1">
                <Badge
                  variant="outline"
                  className="border-border text-muted-foreground"
                >
                  <Building2 className="h-3 w-3 mr-1" />
                  {user.branch?.name ?? "Not assigned"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Current Password</Label>
            <Input
              type="password"
              value={passwords.current}
              onChange={(e) =>
                setPasswords({ ...passwords, current: e.target.value })
              }
              className="bg-background border-border text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-muted-foreground">New Password</Label>
            <Input
              type="password"
              value={passwords.newPass}
              onChange={(e) =>
                setPasswords({ ...passwords, newPass: e.target.value })
              }
              className="bg-background border-border text-white mt-1"
              placeholder="Min 6 characters"
            />
          </div>
          <div>
            <Label className="text-muted-foreground">Confirm Password</Label>
            <Input
              type="password"
              value={passwords.confirm}
              onChange={(e) =>
                setPasswords({ ...passwords, confirm: e.target.value })
              }
              className="bg-background border-border text-white mt-1"
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={isPending}
            className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Password"
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Reports Automation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Report Recipients</Label>
            <textarea
              value={reportRecipients}
              onChange={(e) => setReportRecipients(e.target.value)}
              rows={4}
              placeholder="owner@lkpharmacare.com, manager@lkpharmacare.com"
              className="flex min-h-[104px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-white outline-none placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Use commas or new lines. Leave blank to fall back to configured
              environment emails.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm text-muted-foreground">
                Recipient Source
              </span>
              <Badge
                variant="outline"
                className={
                  reportSettingsMeta.source === "database"
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground"
                }
              >
                {reportSettingsMeta.source === "database"
                  ? "Database override"
                  : "Environment fallback"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm text-muted-foreground">
                Daily Schedule
              </span>
              <span className="text-sm text-white">11:00 PM EAT</span>
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm text-muted-foreground">
                Last Updated
              </span>
              <span className="text-sm text-white">
                {reportSettingsMeta.updated_at
                  ? formatDateTime(reportSettingsMeta.updated_at)
                  : "Not saved in app yet"}
              </span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleSaveReportRecipients}
              disabled={isReportsPending}
              className="bg-primary text-primary-foreground hover:bg-[#00B8A9]"
            >
              {isReportsPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Recipients
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleSendTestReport}
              disabled={isTestPending}
              className="border-primary/40 text-primary hover:bg-primary/10"
            >
              {isTestPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending Test...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Test Daily Report Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Application</span>
            <span className="text-white text-sm">{APP_NAME}</span>
          </div>
          <Separator className="bg-border" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Version</span>
            <Badge
              variant="outline"
              className="border-border text-muted-foreground"
            >
              1.0.0-beta
            </Badge>
          </div>
          <Separator className="bg-border" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Connection</span>
            <Badge
              variant="outline"
              className={
                isOnline
                  ? "border-green-500 text-green-500"
                  : "border-destructive text-destructive"
              }
            >
              {isOnline ? (
                <>
                  <Wifi className="h-3 w-3 mr-1" />
                  Online
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 mr-1" />
                  Offline
                </>
              )}
            </Badge>
          </div>
          <Separator className="bg-border" />
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Design System</span>
            <span className="text-primary text-sm font-medium">
              HYKROX Premium
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone — super_admin only */}
      {user.role === "super_admin" && (
        <Card className="bg-card border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white font-medium">
                  Clear All Sales History
                </p>
                <p className="text-xs text-muted-foreground">
                  Permanently removes all sales, receipts, sale items, and
                  credit records.
                </p>
              </div>
              {!confirmClear ? (
                <Button
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive hover:text-white shrink-0"
                  onClick={() => setConfirmClear(true)}
                >
                  Clear Sales History
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => setConfirmClear(false)}
                    disabled={clearingSales}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={clearingSales}
                    onClick={async () => {
                      setClearingSales(true);
                      const result = await clearAllSalesHistory();
                      setClearingSales(false);
                      setConfirmClear(false);
                      if (result.error) {
                        toast.error(result.error);
                      } else {
                        toast.success("All sales history has been cleared.");
                      }
                    }}
                  >
                    {clearingSales ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Yes, Delete Everything
                  </Button>
                </div>
              )}
            </div>
            <Separator />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm text-white font-medium">
                  Reset All Stock to Zero
                </p>
                <p className="text-xs text-muted-foreground">
                  Sets quantity to 0 for every medicine across all branches.
                </p>
              </div>
              {!confirmResetStock ? (
                <Button
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive hover:text-white shrink-0"
                  onClick={() => setConfirmResetStock(true)}
                >
                  Reset Stock
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => setConfirmResetStock(false)}
                    disabled={resettingStock}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={resettingStock}
                    onClick={async () => {
                      setResettingStock(true);
                      const result = await resetAllStock();
                      setResettingStock(false);
                      setConfirmResetStock(false);
                      if (result.error) {
                        toast.error(result.error);
                      } else {
                        toast.success(
                          "All stock quantities have been reset to zero.",
                        );
                      }
                    }}
                  >
                    {resettingStock ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Yes, Reset All Stock
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
