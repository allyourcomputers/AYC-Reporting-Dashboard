import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, Pencil, Trash2, ShieldAlert, Users } from "lucide-react";

type CompanyWithUserCount = {
  _id: Id<"companies">;
  _creationTime: number;
  name: string;
  haloPsaClientId?: string;
  logo?: string;
  isActive: boolean;
  userCount: number;
};

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-green-100 text-green-800 border-green-200">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-gray-100 text-gray-800 border-gray-200">
      Inactive
    </span>
  );
}

function CompanyFormDialog({
  open,
  onOpenChange,
  company,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: CompanyWithUserCount | null;
  onSubmit: (data: { name: string; haloPsaClientId?: string; isActive: boolean }) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState(company?.name ?? "");
  const [haloPsaClientId, setHaloPsaClientId] = useState(company?.haloPsaClientId ?? "");
  const [isActive, setIsActive] = useState(company?.isActive ?? true);

  // Reset form when dialog opens with different company
  const resetForm = () => {
    setName(company?.name ?? "");
    setHaloPsaClientId(company?.haloPsaClientId ?? "");
    setIsActive(company?.isActive ?? true);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      haloPsaClientId: haloPsaClientId || undefined,
      isActive,
    });
  };

  const isEditMode = !!company;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Company" : "Add New Company"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the company information."
              : "Create a new company that users can be assigned to."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Company Name"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="haloPsaClientId">HaloPSA Client ID</Label>
              <Input
                id="haloPsaClientId"
                value={haloPsaClientId}
                onChange={(e) => setHaloPsaClientId(e.target.value)}
                placeholder="Optional - HaloPSA integration ID"
              />
              <p className="text-xs text-muted-foreground">
                Used for integrating with HaloPSA. Leave empty if not applicable.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive" className="flex flex-col gap-1">
                <span>Active Status</span>
                <span className="font-normal text-xs text-muted-foreground">
                  Inactive companies will not appear in reports.
                </span>
              </Label>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEditMode ? "Update Company" : "Create Company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({
  open,
  onOpenChange,
  company,
  onConfirm,
  isDeleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: CompanyWithUserCount | null;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  const hasUsers = company ? company.userCount > 0 : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Company</DialogTitle>
          <DialogDescription>
            {hasUsers ? (
              <span className="text-destructive">
                Cannot delete company "{company?.name}" because it has {company?.userCount} user(s)
                assigned. Please reassign or remove users before deleting.
              </span>
            ) : (
              <>
                Are you sure you want to delete the company "{company?.name}"? This action cannot be
                undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting || hasUsers}
          >
            {isDeleting ? "Deleting..." : "Delete Company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminCompaniesPage() {
  const currentUser = useQuery(api.users.me);
  const companiesWithUserCount = useQuery(api.companies.listWithUserCount);

  const createCompany = useMutation(api.companies.create);
  const updateCompany = useMutation(api.companies.update);
  const removeCompany = useMutation(api.companies.remove);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyWithUserCount | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<CompanyWithUserCount | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Super admin check
  const realUser = currentUser?.realUser ?? currentUser;
  const isSuperAdmin = realUser?.role === "super_admin";

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">
          Only super administrators can access this page.
        </p>
      </div>
    );
  }

  const handleCreate = async (data: {
    name: string;
    haloPsaClientId?: string;
    isActive: boolean;
  }) => {
    setIsSubmitting(true);
    try {
      await createCompany({
        name: data.name,
        haloPsaClientId: data.haloPsaClientId,
      });
      setShowCreateDialog(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create company");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (data: {
    name: string;
    haloPsaClientId?: string;
    isActive: boolean;
  }) => {
    if (!editingCompany) return;
    setIsSubmitting(true);
    try {
      await updateCompany({
        companyId: editingCompany._id,
        name: data.name,
        haloPsaClientId: data.haloPsaClientId,
        isActive: data.isActive,
      });
      setEditingCompany(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update company");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCompany) return;
    setIsDeleting(true);
    try {
      await removeCompany({ companyId: deletingCompany._id });
      setDeletingCompany(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete company");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Company Management</h1>
          <p className="text-muted-foreground">
            Manage companies and their HaloPSA integrations
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Building2 className="mr-2 h-4 w-4" />
          Add New Company
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Companies</CardTitle>
        </CardHeader>
        <CardContent>
          {!companiesWithUserCount ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : companiesWithUserCount.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No companies found.</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">Name</th>
                    <th className="p-3 text-left font-medium">HaloPSA Client ID</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-left font-medium">Users</th>
                    <th className="p-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {companiesWithUserCount.map((company) => (
                    <tr key={company._id} className="border-b">
                      <td className="p-3">
                        <span className="font-medium">{company.name}</span>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {company.haloPsaClientId || "-"}
                      </td>
                      <td className="p-3">
                        <StatusBadge isActive={company.isActive} />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{company.userCount}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingCompany(company)}
                            title="Edit company"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingCompany(company)}
                            title={
                              company.userCount > 0
                                ? "Cannot delete company with assigned users"
                                : "Delete company"
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Company Dialog */}
      <CompanyFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        company={null}
        onSubmit={handleCreate}
        isSubmitting={isSubmitting}
      />

      {/* Edit Company Dialog */}
      <CompanyFormDialog
        open={!!editingCompany}
        onOpenChange={(open) => !open && setEditingCompany(null)}
        company={editingCompany}
        onSubmit={handleUpdate}
        isSubmitting={isSubmitting}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={!!deletingCompany}
        onOpenChange={(open) => !open && setDeletingCompany(null)}
        company={deletingCompany}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
