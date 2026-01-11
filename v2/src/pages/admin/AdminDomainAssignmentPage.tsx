import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShieldAlert, Globe, Building2, Link2, Unlink, Search } from "lucide-react";

type Company = {
  _id: Id<"companies">;
  _creationTime: number;
  name: string;
  haloPsaClientId?: string;
  logo?: string;
  isActive: boolean;
};

function AssignedBadge({ companyName }: { companyName: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 border border-blue-200">
      {companyName}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 rounded-lg">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function AdminDomainAssignmentPage() {
  const currentUser = useQuery(api.users.me);
  const domains = useQuery(api.domains.list);
  const companies = useQuery(api.companies.list);

  const assignDomain = useMutation(api.domains.assign);
  const unassignDomain = useMutation(api.domains.unassign);

  const [selectedDomainId, setSelectedDomainId] = useState<Id<"domains"> | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<Id<"companies"> | null>(null);
  const [domainSearch, setDomainSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isUnassigning, setIsUnassigning] = useState(false);

  // Super admin check
  const realUser = currentUser?.realUser ?? currentUser;
  const isSuperAdmin = realUser?.role === "super_admin";

  // Filter domains based on search
  const filteredDomains = useMemo(() => {
    if (!domains) return [];
    const searchLower = domainSearch.toLowerCase();
    return domains.filter(
      (domain) =>
        domain.name.toLowerCase().includes(searchLower) ||
        (domain.companyName && domain.companyName.toLowerCase().includes(searchLower))
    );
  }, [domains, domainSearch]);

  // Filter companies based on search
  const validCompanies = useMemo(() => {
    if (!companies) return [];
    return companies.filter((c): c is Company => c !== null);
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    const searchLower = companySearch.toLowerCase();
    return validCompanies.filter((company) =>
      company.name.toLowerCase().includes(searchLower)
    );
  }, [validCompanies, companySearch]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!domains) return { total: 0, assigned: 0, unassigned: 0 };
    const total = domains.length;
    const assigned = domains.filter((d) => d.companyId).length;
    return { total, assigned, unassigned: total - assigned };
  }, [domains]);

  // Get selected domain details
  const selectedDomain = useMemo(() => {
    if (!selectedDomainId || !domains) return null;
    return domains.find((d) => d._id === selectedDomainId) ?? null;
  }, [selectedDomainId, domains]);

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

  const handleAssign = async () => {
    if (!selectedDomainId || !selectedCompanyId) return;
    setIsAssigning(true);
    try {
      await assignDomain({ domainId: selectedDomainId, companyId: selectedCompanyId });
      // Clear company selection after successful assignment
      setSelectedCompanyId(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to assign domain");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async () => {
    if (!selectedDomainId) return;
    setIsUnassigning(true);
    try {
      await unassignDomain({ domainId: selectedDomainId });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to unassign domain");
    } finally {
      setIsUnassigning(false);
    }
  };

  const canAssign = selectedDomainId && selectedCompanyId;
  const canUnassign = selectedDomain && selectedDomain.companyId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Domain Assignments</h1>
        <p className="text-muted-foreground">
          Assign domains to companies for reporting purposes
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Domains" value={stats.total} icon={Globe} />
        <StatCard label="Assigned" value={stats.assigned} icon={Link2} />
        <StatCard label="Unassigned" value={stats.unassigned} icon={Unlink} />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleAssign}
          disabled={!canAssign || isAssigning}
          className="flex items-center gap-2"
        >
          <Link2 className="h-4 w-4" />
          {isAssigning ? "Assigning..." : "Assign Domain"}
        </Button>
        <Button
          variant="outline"
          onClick={handleUnassign}
          disabled={!canUnassign || isUnassigning}
          className="flex items-center gap-2"
        >
          <Unlink className="h-4 w-4" />
          {isUnassigning ? "Unassigning..." : "Unassign Domain"}
        </Button>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Domains Column */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Domains
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Domain Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search domains..."
                value={domainSearch}
                onChange={(e) => setDomainSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Domain List */}
            <div className="border rounded-md max-h-[400px] overflow-y-auto">
              {!domains ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : filteredDomains.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {domainSearch ? "No domains match your search." : "No domains found."}
                </p>
              ) : (
                <div className="divide-y">
                  {filteredDomains.map((domain) => {
                    const isSelected = selectedDomainId === domain._id;
                    return (
                      <button
                        key={domain._id}
                        onClick={() => setSelectedDomainId(domain._id)}
                        className={`w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors ${
                          isSelected ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{domain.name}</span>
                          {domain.companyName && (
                            <AssignedBadge companyName={domain.companyName} />
                          )}
                        </div>
                        {!domain.companyName && (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Companies Column */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Companies
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Company Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Company List */}
            <div className="border rounded-md max-h-[400px] overflow-y-auto">
              {!companies ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : filteredCompanies.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {companySearch ? "No companies match your search." : "No companies found."}
                </p>
              ) : (
                <div className="divide-y">
                  {filteredCompanies.map((company) => {
                    const isSelected = selectedCompanyId === company._id;
                    return (
                      <button
                        key={company._id}
                        onClick={() => setSelectedCompanyId(company._id)}
                        className={`w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors ${
                          isSelected ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{company.name}</span>
                          {!company.isActive && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 border border-gray-200">
                              Inactive
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selection Summary */}
      {(selectedDomain || selectedCompanyId) && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Selection:</span>
              {selectedDomain && (
                <span className="flex items-center gap-1">
                  <Globe className="h-4 w-4" />
                  <strong>{selectedDomain.name}</strong>
                  {selectedDomain.companyName && (
                    <span className="text-muted-foreground">
                      (currently: {selectedDomain.companyName})
                    </span>
                  )}
                </span>
              )}
              {selectedDomain && selectedCompanyId && (
                <span className="text-muted-foreground">→</span>
              )}
              {selectedCompanyId && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  <strong>
                    {validCompanies.find((c) => c._id === selectedCompanyId)?.name}
                  </strong>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
