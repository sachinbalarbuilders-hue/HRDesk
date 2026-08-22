import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useOrganization } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { exportToCSV } from '../../utils/csvHelper';
import { DataToolbar } from '../../components/ui/DataToolbar';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable';
import { type ArchiveFilterValue } from '../../components/ui/ArchiveToggle';
import { RowActionMenu, type RowAction } from '../../components/ui/RowActionMenu';
import {
  Building2,
  Plus,
  MapPin,
  Edit2,
  Eye,
  Globe,
  Layers,
  Sparkles,
} from 'lucide-react';

export const OrganizationsTab: React.FC = () => {
  const { currentBranch } = useOrganization();
  const { showError, showSuccess } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilterValue>('active');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [organizations, setOrganizations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/masters/overview', {
        params: { branchId: currentBranch?.id || undefined },
      });

      if (res?.data) {
        if (res.data.organizations) {
          const orgList = res.data.organizations.map((o: any) => ({
            id: o.id,
            publicId: o.publicId,
            name: o.name,
            code: o.code || (o.name.length > 3 ? o.name.split(' ').map((w: string) => w[0]).join('').toUpperCase() : o.name.toUpperCase()),
            address: o.address || '',
            whatsAppGroupId: o.whatsAppGroupId || '',
            latitude: o.latitude || 21.1702,
            longitude: o.longitude || 72.8311,
            radiusMeters: o.radiusMeters || 100,
            logoUrl: o.logoUrl || '',
            primaryColor: o.primaryColor || '#D97706',
            customDomain: o.customDomain || '',
            isActive: o.isActive !== false,
            status: o.isActive !== false ? 'Active' : 'Inactive',
          }));
          setOrganizations(orgList);
        }
        if (res.data.branches) {
          setBranches(
            res.data.branches.map((b: any) => ({
              id: b.id,
              publicId: b.publicId,
              organizationId: b.organizationId,
              name: b.name,
              code: b.code || (b.name.length > 3 ? b.name.split(' ').map((w: string) => w[0]).join('').toUpperCase() : b.name.toUpperCase()),
              address: b.address || '',
              city: b.city || '',
              state: b.state || '',
              pincode: b.pincode || '',
              latitude: b.latitude || 21.1702,
              longitude: b.longitude || 72.8311,
              radiusMeters: b.radiusMeters || 100,
              whatsAppGroupId: b.whatsAppGroupId || '',
              allowedIPs: b.allowedIPs || '',
              outsideAttendancePolicy: b.outsideAttendancePolicy || 'Block',
              isActive: b.isActive !== false,
              status: b.isActive !== false ? 'Active' : 'Inactive',
            }))
          );
        }
      }
    } catch (err) {
      console.error('Failed to load masters data', err);
      showError('Error', 'Unable to load organizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentBranch]);

  // Counts for archive filter
  const activeCount = organizations.filter((o) => o.isActive).length;
  const archivedCount = organizations.filter((o) => !o.isActive).length;

  // Filtered dataset
  const filteredOrgs = useMemo(() => {
    return organizations.filter((org) => {
      // Archive filter
      if (archiveFilter === 'active' && !org.isActive) return false;
      if (archiveFilter === 'archived' && org.isActive) return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = org.name.toLowerCase().includes(q);
        const matchesCode = org.code?.toLowerCase().includes(q);
        const matchesDomain = org.customDomain?.toLowerCase().includes(q);
        const matchesAddress = org.address?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesDomain && !matchesAddress) return false;
      }

      return true;
    });
  }, [organizations, archiveFilter, search]);

  // Total branches across all visible orgs
  const totalBranchesCount = branches.length;
  const customDomainsCount = organizations.filter((o) => !!o.customDomain).length;

  // Export to CSV
  const handleExport = () => {
    if (filteredOrgs.length === 0) {
      showError('Export', 'No organizations available to export.');
      return;
    }
    const exportData = filteredOrgs.map((o) => ({
      ID: o.id,
      PublicId: o.publicId,
      Name: o.name,
      Code: o.code,
      CustomDomain: o.customDomain || 'N/A',
      Address: o.address || 'N/A',
      PrimaryColor: o.primaryColor,
      BranchesCount: branches.filter((b) => b.organizationId === o.id).length,
      Status: o.isActive ? 'Active' : 'Inactive',
    }));
    exportToCSV(exportData, `Organizations_Export_${new Date().toISOString().slice(0, 10)}`);
    showSuccess('Exported', 'Organizations list exported to CSV.');
  };

  // Table Columns Definition
  const columns: ColumnDef<any>[] = [
    {
      key: 'name',
      header: 'Organization / Legal Entity',
      render: (org) => {
        return (
          <div
            className="flex items-center gap-3 cursor-pointer group py-1"
            onClick={() => navigate(`/settings/organizations/${org.publicId}`)}
          >
            <div
              className="w-8 h-8 rounded-[4px] flex items-center justify-center shrink-0 font-bold text-xs shadow-xs overflow-hidden border border-[var(--rule)]"
              style={{ backgroundColor: org.primaryColor || '#D97706', color: '#FFFFFF' }}
            >
              {org.logoUrl ? (
                <img
                  src={org.logoUrl}
                  alt={org.name}
                  className="w-full h-full object-contain p-0.5 bg-[var(--surface)]"
                />
              ) : (
                <span className="font-display font-bold text-xs">
                  {(org.name || 'O').charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-xs text-[var(--ink)] group-hover:text-[var(--gold-600)] transition-colors">
                {org.name}
              </span>
              <span className="font-mono text-[10px] text-[var(--ink-muted)]">
                ID: {org.publicId.slice(0, 8)}...
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'code',
      header: 'Code',
      width: '100px',
      render: (org) => (
        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--surface-sunken)] border border-[var(--rule)] text-[var(--ink)]">
          {org.code || '—'}
        </span>
      ),
    },
    {
      key: 'customDomain',
      header: 'Subdomain / Domain',
      render: (org) =>
        org.customDomain ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium">
            <Globe size={11} />
            {org.customDomain}
          </span>
        ) : (
          <span className="text-[var(--ink-muted)] text-[11px]">—</span>
        ),
    },
    {
      key: 'address',
      header: 'Headquarters Address',
      render: (org) =>
        org.address ? (
          <div className="flex items-center gap-1 text-xs text-[var(--ink-muted)] max-w-xs truncate" title={org.address}>
            <MapPin size={11} className="shrink-0 text-[var(--ink-muted)]" />
            <span className="truncate">{org.address}</span>
          </div>
        ) : (
          <span className="text-[var(--ink-muted)] text-xs">—</span>
        ),
    },
    {
      key: 'branches',
      header: 'Branches',
      width: '110px',
      render: (org) => {
        const count = branches.filter((b) => b.organizationId === org.id).length;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/settings/organizations/${org.publicId}/branches`);
            }}
            className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[var(--surface-sunken)] hover:bg-[var(--paper)] border border-[var(--rule)] text-[var(--ink)] cursor-pointer transition-colors"
          >
            {count} {count === 1 ? 'branch' : 'branches'}
          </button>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '90px',
      render: (org) =>
        org.isActive !== false ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-500/10 text-[var(--ink-muted)] border border-[var(--rule)]">
            Archived
          </span>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '48px',
      align: 'right',
      render: (org) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActionMenu
            actions={[
              {
                label: 'Edit Details & Logo',
                icon: <Edit2 size={14} />,
                onClick: () => navigate(`/settings/organizations/${org.publicId}`),
              },
              {
                label: 'Manage Branches',
                icon: <Eye size={14} />,
                onClick: () => navigate(`/settings/organizations/${org.publicId}/branches`),
              },
            ] as RowAction[]}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-6xl font-ui">
      {/* KPI Top Stat Summary Chips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px]">
          <div className="w-8 h-8 rounded-[4px] bg-[var(--gold-500)]/10 text-[var(--gold-600)] dark:text-[var(--gold-400)] flex items-center justify-center font-bold">
            <Building2 size={16} />
          </div>
          <div>
            <div className="font-mono text-base font-bold text-[var(--ink)] leading-none">
              {organizations.length}
            </div>
            <div className="text-[11px] text-[var(--ink-muted)] mt-0.5">Total Organizations</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px]">
          <div className="w-8 h-8 rounded-[4px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Layers size={16} />
          </div>
          <div>
            <div className="font-mono text-base font-bold text-[var(--ink)] leading-none">
              {totalBranchesCount}
            </div>
            <div className="text-[11px] text-[var(--ink-muted)] mt-0.5">Configured Branches</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-[var(--surface)] border border-[var(--rule)] rounded-[4px]">
          <div className="w-8 h-8 rounded-[4px] bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Globe size={16} />
          </div>
          <div>
            <div className="font-mono text-base font-bold text-[var(--ink)] leading-none">
              {customDomainsCount}
            </div>
            <div className="text-[11px] text-[var(--ink-muted)] mt-0.5">Custom Subdomains</div>
          </div>
        </div>
      </div>

      {/* Reusable DataToolbar */}
      <DataToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, code, domain, or address..."
        archiveFilter={{
          value: archiveFilter,
          onChange: setArchiveFilter,
          activeCount,
          archivedCount,
          allCount: organizations.length,
        }}
        onExport={handleExport}
        exportLabel="Export CSV"
        primaryAction={{
          label: 'Add Organization',
          icon: <Plus size={14} />,
          onClick: () => navigate('/settings/organizations/new'),
        }}
      />

      {/* Structured DataTable */}
      <DataTable
        columns={columns}
        data={filteredOrgs}
        loading={loading}
        emptyMessage="No organizations found matching the selected criteria."
        keyExtractor={(item) => item.id}
      />
    </div>
  );
};
