import React, { useCallback, useState } from 'react';
import { Trash2, RotateCcw } from 'lucide-react';
import { apiClient } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import type { RowAction } from '../components/ui/RowActionMenu';
import type { BulkAction, TableSelection } from '../components/ui/DataTable';

export interface UseArchiveActionsOptions {
  /**
   * Base REST path for the resource, no trailing slash. e.g. '/masters/departments' or '/recruitment/candidates'.
   */
  endpoint: string;

  /** Called after any successful mutation — normally your fetch/refetch function. */
  onDone?: () => void;

  /** Singular noun used in toasts, e.g. "Department". Defaults to "Record". */
  label?: string;

  /** Permission key to evaluate scopes for, e.g. "Shifts.Delete", "Masters.Departments.Delete", etc. */
  permissionKey?: string;

  /** Whether the row can be permanently deleted. Defaults to true (subject to RBAC). */
  canPermanentDelete?: boolean;

  /** Whether bulk archive/delete operations are enabled. Defaults to true (subject to RBAC). */
  canBulkDelete?: boolean;
}

export interface ArchiveRowTarget {
  id: string | number;
  /** Shown in the confirm dialog and toasts. */
  name?: string;
  /** Which view this row is rendered in. Drives what "Delete" does. */
  isArchived: boolean;
  /** Set to disable the destructive actions for this row (e.g. system-owned records). */
  disabled?: boolean;
}

function getArchiveSlug(endpoint: string): string {
  const clean = endpoint.split('?')[0].replace(/^\/api\//, '').replace(/^\//, '');
  const segments = clean.split('/').filter(Boolean);
  return segments[segments.length - 1] || clean;
}

export function useArchiveActions({
  endpoint,
  onDone,
  label = 'Record',
  permissionKey,
  canPermanentDelete: optCanPermanent = true,
  canBulkDelete: optCanBulk = true,
}: UseArchiveActionsOptions) {
  const { showSuccess, showError } = useToast();
  const { isAdmin, hasPermission, getPermissionScope } = useAuth();

  const [pending, setPending] = useState<ArchiveRowTarget | null>(null);
  const [pendingBulkIds, setPendingBulkIds] = useState<(string | number)[] | null>(null);
  const [clearSelectionCallback, setClearSelectionCallback] = useState<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);

  // ── RBAC Scope Resolution ──────────────────────────────────────────────────
  // Scopes:
  // - "Soft Delete"     : can only archive individual records. No permanent delete, no bulk delete.
  // - "Permanent Delete": can archive and permanently delete individual records. No bulk delete.
  // - "Bulk Delete"     : can archive, permanently delete, and multi-select / bulk delete.
  // - "All" / SuperAdmin: full access.
  const hasDeletePerm = permissionKey ? (isAdmin || hasPermission(permissionKey)) : true;
  const deleteScope = permissionKey ? getPermissionScope(permissionKey) : undefined;

  const allowsPermanent =
    !permissionKey ||
    isAdmin ||
    deleteScope === 'All' ||
    deleteScope === 'Permanent Delete' ||
    deleteScope === 'Bulk Delete';

  const allowsBulk =
    !permissionKey ||
    isAdmin ||
    deleteScope === 'All' ||
    deleteScope === 'Permanent Delete' ||
    deleteScope === 'Bulk Delete';

  const canPermanentDelete = optCanPermanent && hasDeletePerm && allowsPermanent;
  const canBulkDelete = optCanBulk && hasDeletePerm && allowsBulk;

  const fail = useCallback(
    (err: any, fallback: string) => {
      if (err?.response?.status === 403) {
        showError('Access Restricted', 'You do not have permission to delete or archive this record.');
        return;
      }
      showError(fallback, err?.response?.data?.message || 'Server error');
    },
    [showError]
  );

  /** "Delete" in the active list. Reversible, so no confirmation. */
  const archive = useCallback(
    async (target: ArchiveRowTarget) => {
      if (!hasDeletePerm) {
        showError('Access Restricted', 'You do not have permission to delete records.');
        return;
      }
      try {
        await apiClient.delete(`${endpoint}/${target.id}`);
        showSuccess(`${label} Deleted`, `${target.name ?? label} moved to archive.`);
        onDone?.();
      } catch (err) {
        fail(err, 'Delete Failed');
      }
    },
    [endpoint, label, onDone, showSuccess, fail, hasDeletePerm, showError]
  );

  const restore = useCallback(
    async (target: ArchiveRowTarget) => {
      if (!hasDeletePerm) {
        showError('Access Restricted', 'You do not have permission to restore records.');
        return;
      }
      try {
        await apiClient.post(`${endpoint}/${target.id}/restore`);
        showSuccess(`${label} Restored`, `${target.name ?? label} is active again.`);
        onDone?.();
      } catch (err) {
        fail(err, 'Restore Failed');
      }
    },
    [endpoint, label, onDone, showSuccess, fail, hasDeletePerm, showError]
  );

  /** "Delete" inside the archive view. Irreversible, so it opens the confirm modal first. */
  const confirmPermanentDelete = useCallback(
    (target: ArchiveRowTarget) => {
      if (!canPermanentDelete) {
        showError('Access Restricted', 'You do not have permission to permanently delete records.');
        return;
      }
      setPending(target);
    },
    [canPermanentDelete, showError]
  );

  /** Bulk soft-delete / archive */
  const bulkArchive = useCallback(
    async (ids: (string | number)[], clearSelection?: () => void) => {
      if (!canBulkDelete) {
        showError('Access Restricted', 'You do not have permission to perform bulk delete operations.');
        return;
      }
      if (ids.length === 0) return;
      try {
        const slug = getArchiveSlug(endpoint);
        try {
          await apiClient.post(`/archive/${slug}/bulk-archive`, { ids: ids.map(String) });
        } catch (err: any) {
          if (err?.response?.status === 404) {
            await apiClient.post(`${endpoint}/bulk-archive`, { ids: ids.map(String) });
          } else {
            throw err;
          }
        }
        showSuccess(`Bulk Deleted`, `${ids.length} ${label.toLowerCase()}(s) moved to archive.`);
        clearSelection?.();
        onDone?.();
      } catch (err) {
        fail(err, 'Bulk Delete Failed');
      }
    },
    [endpoint, label, onDone, showSuccess, fail, canBulkDelete, showError]
  );

  /** Bulk restore */
  const bulkRestore = useCallback(
    async (ids: (string | number)[], clearSelection?: () => void) => {
      if (!canBulkDelete) {
        showError('Access Restricted', 'You do not have permission to perform bulk restore operations.');
        return;
      }
      if (ids.length === 0) return;
      try {
        const slug = getArchiveSlug(endpoint);
        try {
          await apiClient.post(`/archive/${slug}/bulk-restore`, { ids: ids.map(String) });
        } catch (err: any) {
          if (err?.response?.status === 404) {
            await apiClient.post(`${endpoint}/bulk-restore`, { ids: ids.map(String) });
          } else {
            throw err;
          }
        }
        showSuccess(`Bulk Restored`, `${ids.length} ${label.toLowerCase()}(s) restored.`);
        clearSelection?.();
        onDone?.();
      } catch (err) {
        fail(err, 'Bulk Restore Failed');
      }
    },
    [endpoint, label, onDone, showSuccess, fail, canBulkDelete, showError]
  );

  /** Confirm bulk permanent delete */
  const confirmBulkPermanentDelete = useCallback(
    (ids: (string | number)[], clearSelection?: () => void) => {
      if (!canPermanentDelete || !canBulkDelete) {
        showError('Access Restricted', 'You do not have permission to perform bulk permanent delete.');
        return;
      }
      setPendingBulkIds(ids);
      setClearSelectionCallback(() => clearSelection || null);
    },
    [canPermanentDelete, canBulkDelete, showError]
  );

  const runPermanentDelete = useCallback(async () => {
    if (pendingBulkIds && pendingBulkIds.length > 0) {
      if (!canPermanentDelete || !canBulkDelete) {
        showError('Access Restricted', 'You do not have permission to permanently delete records.');
        return;
      }
      setBusy(true);
      try {
        const slug = getArchiveSlug(endpoint);
        try {
          await apiClient.post(`/archive/${slug}/bulk-delete`, { ids: pendingBulkIds.map(String) });
        } catch (err: any) {
          if (err?.response?.status === 404) {
            await apiClient.post(`${endpoint}/bulk-delete`, { ids: pendingBulkIds.map(String) });
          } else {
            throw err;
          }
        }
        showSuccess(`Bulk Deleted`, `${pendingBulkIds.length} ${label.toLowerCase()}(s) permanently deleted.`);
        clearSelectionCallback?.();
        setPendingBulkIds(null);
        setClearSelectionCallback(null);
        onDone?.();
      } catch (err) {
        fail(err, 'Bulk Permanent Delete Failed');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!pending) return;
    if (!canPermanentDelete) {
      showError('Access Restricted', 'You do not have permission to permanently delete records.');
      return;
    }
    setBusy(true);
    try {
      await apiClient.delete(`${endpoint}/${pending.id}`, { params: { permanent: true } });
      showSuccess(`${label} Deleted`, `${pending.name ?? label} permanently deleted.`);
      setPending(null);
      onDone?.();
    } catch (err) {
      fail(err, 'Delete Failed');
    } finally {
      setBusy(false);
    }
  }, [pending, pendingBulkIds, clearSelectionCallback, endpoint, label, onDone, showSuccess, fail, canPermanentDelete, canBulkDelete, showError]);

  /**
   * Builds the action list for RowActionMenu.
   */
  const rowActions = useCallback(
    (target: ArchiveRowTarget): RowAction[] => {
      if (!hasDeletePerm) return [];
      const actions: RowAction[] = [];

      if (target.isArchived) {
        actions.push({
          label: 'Restore',
          icon: <RotateCcw size={14} />,
          onClick: () => void restore(target),
          variant: 'success',
          disabled: target.disabled,
          dividerBefore: true,
        });

        if (canPermanentDelete) {
          actions.push({
            label: 'Delete Permanently',
            icon: <Trash2 size={14} />,
            onClick: () => confirmPermanentDelete(target),
            variant: 'danger',
            disabled: target.disabled,
            dividerBefore: false,
          });
        }
      } else {
        actions.push({
          label: 'Delete',
          icon: <Trash2 size={14} />,
          onClick: () => void archive(target),
          variant: 'danger',
          disabled: target.disabled,
          dividerBefore: true,
        });
      }

      return actions;
    },
    [archive, restore, confirmPermanentDelete, canPermanentDelete, hasDeletePerm]
  );

  /**
   * Generates standard BulkAction definitions for DataTable.
   */
  const bulkActions = useCallback(
    (isArchivedView: boolean): BulkAction[] => {
      if (!canBulkDelete) return [];

      if (isArchivedView) {
        const actions: BulkAction[] = [
          {
            label: 'Restore Selected',
            icon: <RotateCcw size={13} />,
            variant: 'primary',
            onClick: (keys, _, clear) => bulkRestore(keys, clear),
          },
        ];

        if (canPermanentDelete) {
          actions.push({
            label: 'Delete Permanently',
            icon: <Trash2 size={13} />,
            variant: 'danger',
            onClick: (keys, _, clear) => confirmBulkPermanentDelete(keys, clear),
          });
        }

        return actions;
      }

      return [
        {
          label: 'Delete Selected',
          icon: <Trash2 size={13} />,
          variant: 'danger',
          onClick: (keys, _, clear) => bulkArchive(keys, clear),
        },
      ];
    },
    [bulkArchive, bulkRestore, confirmBulkPermanentDelete, canPermanentDelete, canBulkDelete]
  );

  /**
   * Helper to construct DataTable selection object. Returns undefined if user cannot bulk delete.
   */
  const getSelectionConfig = useCallback(
    <T = any>(
      selectedRowKeys: (string | number)[],
      onChange: (keys: (string | number)[], selectedRows?: T[]) => void,
      isArchivedView: boolean = false
    ): TableSelection<T> | undefined => {
      if (!canBulkDelete) return undefined;
      return {
        selectedRowKeys,
        onChange: (keys: (string | number)[], selectedRows: T[]) => onChange(keys, selectedRows),
        bulkActions: bulkActions(isArchivedView),
      };
    },
    [canBulkDelete, bulkActions]
  );

  /** Render this once per page so the confirm modal has a mount point. */
  const dialog = (
    <ConfirmDialog
      open={pending !== null || (pendingBulkIds !== null && pendingBulkIds.length > 0)}
      onClose={() => {
        setPending(null);
        setPendingBulkIds(null);
        setClearSelectionCallback(null);
      }}
      onConfirm={runPermanentDelete}
      itemName={pendingBulkIds ? `${pendingBulkIds.length} selected ${label.toLowerCase()}s` : pending?.name}
      busy={busy}
      tone="danger"
    />
  );

  return {
    canDelete: hasDeletePerm,
    canPermanentDelete,
    canBulkDelete,
    rowActions,
    dialog,
    archive,
    restore,
    confirmPermanentDelete,
    bulkArchive,
    bulkRestore,
    confirmBulkPermanentDelete,
    bulkActions,
    getSelectionConfig,
  };
}

/**
 * Shared predicate for "is this row archived?".
 * Handles both storage conventions in the codebase: the new `archivedAt` timestamp and the
 * legacy `status`/`isActive` markers.
 */
export function isRowArchived(row: any): boolean {
  if (row?.archivedAt) return true;
  const status = String(row?.status ?? '').toLowerCase();
  if (status === 'inactive' || status === 'archived') return true;
  if (row?.isActive === false) return true;
  return false;
}
