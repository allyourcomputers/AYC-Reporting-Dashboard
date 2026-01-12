import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Pencil, Trash2, UserCog, ShieldAlert } from "lucide-react";

type UserRole = "super_admin" | "admin" | "customer";

type UserWithCompanies = {
  _id: Id<"users">;
  _creationTime: number;
  email?: string;
  name?: string;
  role: UserRole;
  activeCompanyId?: Id<"companies">;
  impersonatingUserId?: Id<"users">;
  companies: Array<{
    _id: Id<"companies">;
    _creationTime: number;
    name: string;
    haloPsaClientId?: string;
    logo?: string;
    isActive: boolean;
  }>;
};

type Company = {
  _id: Id<"companies">;
  _creationTime: number;
  name: string;
  haloPsaClientId?: string;
  logo?: string;
  isActive: boolean;
};

function RoleBadge({ role }: { role: UserRole }) {
  const colors = {
    super_admin: "bg-orange-100 text-orange-800 border-orange-200",
    admin: "bg-blue-100 text-blue-800 border-blue-200",
    customer: "bg-green-100 text-green-800 border-green-200",
  };

  const labels = {
    super_admin: "Super Admin",
    admin: "Admin",
    customer: "Customer",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[role]}`}
    >
      {labels[role]}
    </span>
  );
}

function UserFormDialog({
  open,
  onOpenChange,
  user,
  companies,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithCompanies | null;
  companies: Company[];
  onSubmit: (data: { email: string; name: string; password?: string; role: UserRole; companyIds: Id<"companies">[] }) => void;
  isSubmitting: boolean;
}) {
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(user?.role ?? "customer");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Id<"companies">[]>(
    user?.companies.map((c) => c._id) ?? []
  );

  // Reset form when dialog opens with different user
  const resetForm = () => {
    setEmail(user?.email ?? "");
    setName(user?.name ?? "");
    setPassword("");
    setRole(user?.role ?? "customer");
    setSelectedCompanyIds(user?.companies.map((c) => c._id) ?? []);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ email, name, password: password || undefined, role, companyIds: selectedCompanyIds });
  };

  const toggleCompany = (companyId: Id<"companies">) => {
    setSelectedCompanyIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
    );
  };

  const isEditMode = !!user;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit User" : "Add New User"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the user's information and company assignments."
              : "Create a new user account. They will sign in with these credentials."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                disabled={isEditMode}
                required
              />
              {isEditMode && (
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed after creation.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>
            {!isEditMode && (
              <div className="grid gap-2">
                <Label htmlFor="password">Initial Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Set initial password"
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  User will use this password to sign in. Minimum 8 characters.
                </p>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Company Assignments</Label>
              <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                {companies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No companies available.</p>
                ) : (
                  companies.map((company) => (
                    <label
                      key={company._id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCompanyIds.includes(company._id)}
                        onChange={() => toggleCompany(company._id)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{company.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEditMode ? "Update User" : "Create User"}
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
  user,
  onConfirm,
  isDeleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithCompanies | null;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the user "{user?.name}" ({user?.email})? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminUsersPage() {
  const currentUser = useQuery(api.users.me);
  const usersWithCompanies = useQuery(api.users.getWithCompanies);
  const companies = useQuery(api.companies.list);

  const createUser = useAction(api.users.create);
  const updateUser = useMutation(api.users.update);
  const removeUser = useMutation(api.users.remove);
  const startImpersonation = useMutation(api.users.startImpersonation);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithCompanies | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserWithCompanies | null>(null);
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

  const validCompanies = (companies?.filter((c): c is NonNullable<typeof c> => c !== null) ?? []) as Company[];

  const handleCreate = async (data: {
    email: string;
    name: string;
    password?: string;
    role: UserRole;
    companyIds: Id<"companies">[];
  }) => {
    if (!data.password) {
      alert("Password is required for new users");
      return;
    }
    setIsSubmitting(true);
    try {
      await createUser({
        email: data.email,
        name: data.name,
        password: data.password,
        role: data.role,
        companyIds: data.companyIds,
      });
      setShowCreateDialog(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (data: {
    email: string;
    name: string;
    role: UserRole;
    companyIds: Id<"companies">[];
  }) => {
    if (!editingUser) return;
    setIsSubmitting(true);
    try {
      await updateUser({
        userId: editingUser._id,
        name: data.name,
        role: data.role,
        companyIds: data.companyIds,
      });
      setEditingUser(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await removeUser({ userId: deletingUser._id });
      setDeletingUser(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImpersonate = async (userId: Id<"users">) => {
    try {
      await startImpersonation({ userId });
      // Reload the page to reflect impersonation
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to start impersonation");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts and their company assignments
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add New User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          {!usersWithCompanies ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : usersWithCompanies.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No users found.</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">Name</th>
                    <th className="p-3 text-left font-medium">Email</th>
                    <th className="p-3 text-left font-medium">Role</th>
                    <th className="p-3 text-left font-medium">Companies</th>
                    <th className="p-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersWithCompanies.map((user) => {
                    const isCurrentUser = realUser?._id === user._id;
                    return (
                      <tr key={user._id} className="border-b">
                        <td className="p-3">
                          <span className="font-medium">{user.name}</span>
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">{user.email}</td>
                        <td className="p-3">
                          <RoleBadge role={user.role} />
                        </td>
                        <td className="p-3">
                          {(() => {
                            const validCompaniesForUser = user.companies.filter((c): c is NonNullable<typeof c> => c !== null);
                            if (validCompaniesForUser.length === 0) {
                              return <span className="text-muted-foreground">None</span>;
                            }
                            return (
                              <div className="flex flex-wrap gap-1">
                                {validCompaniesForUser.slice(0, 3).map((company) => (
                                  <span
                                    key={company._id}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-secondary text-secondary-foreground"
                                  >
                                    {company.name}
                                  </span>
                                ))}
                                {validCompaniesForUser.length > 3 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{validCompaniesForUser.length - 3} more
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingUser({
                                ...user,
                                companies: user.companies.filter((c): c is NonNullable<typeof c> => c !== null),
                              })}
                              title="Edit user"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingUser({
                                ...user,
                                companies: user.companies.filter((c): c is NonNullable<typeof c> => c !== null),
                              })}
                              disabled={isCurrentUser}
                              title={isCurrentUser ? "Cannot delete yourself" : "Delete user"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleImpersonate(user._id)}
                              disabled={isCurrentUser}
                              title={isCurrentUser ? "Cannot impersonate yourself" : "Impersonate user"}
                            >
                              <UserCog className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <UserFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        user={null}
        companies={validCompanies}
        onSubmit={handleCreate}
        isSubmitting={isSubmitting}
      />

      {/* Edit User Dialog */}
      <UserFormDialog
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        user={editingUser}
        companies={validCompanies}
        onSubmit={handleUpdate}
        isSubmitting={isSubmitting}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={!!deletingUser}
        onOpenChange={(open) => !open && setDeletingUser(null)}
        user={deletingUser}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
