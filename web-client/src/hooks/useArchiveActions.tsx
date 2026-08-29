import React, { useCallback, useState } from 'react';
import { Trash2, RotateCcw } from 'lucide-react';
import { apiClient } from '../api/client';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import type { RowAction } from '../components/ui/RowActionMenu';

/**
 * ONE button, always labelled "Delete", everywhere in the app.
 *
 *   Row in the ACTIVE list   → "Delete" archives it (reversible, one click, no modal)
 *   Row in the ARCHIVE view  → "Delete" permanently removes it (confirm modal, red)
 *                              plus a separate "Restore" action
 *
 * There is no "Archive" button and no "Soft delete" label in the UI. The label never
 * changes; only the endpoint it calls does.
 *
 * USAGE
 * -----
 *   const archive = useArchiveActions({ endpoint: '/masters/departments', onDone: fetchData });
 *
 *   <RowActionMenu actions={[
 *     { label: 'Edit', icon: <Edit2 size={14} />, onClick: () => openEdit(item) },
 *     ...archive.rowActions({ id: item.id, name: item.name, isArchived: isArchived(item) }),
 *   ]} />
 *
 *   {archive.dialog}   ← render once per page, outside the table
 */

export interface UseArchiveActionsOptions {
  /**
   * Base REST path for the resource, no trailing slash. e.g. '/masters/departments'.
   * Conventions the backend implements for every archivable resource:
   *   DELETE {endpoint}/{id}                 → archive
   *   DELETE {endpoint}/{id}?permanent=true  → permanent delete
   *   POST   {endpoint}/{id}/restore         → restore
   */
  endpoint: string;

  /** Called after any successful mutation — normally your fetch/refetch function. */
  onDone?: () => void;

  /** Singular noun used in toasts, e.g. "Department". Defaults to "Record". */
  label?: string;
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

export function useArchiveActions({ endpoint, onDone, label = 'Record' }: UseArchiveActionsOptions) {
  const { showSuccess, showError } = useToast();
  const [pending, setPending] = useState<ArchiveRowTarget | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = useCallback(
    (err: any, fallback: string) =>
      showError(fallback, err?.response?.data?.message || 'Server error'),
    [showError]
  );

  /** "Delete" in the active list. Reversible, so no confirmation. */
  const archive = useCallback(
    async (target: ArchiveRowTarget) => {
      try {
        await apiClient.delete(`${endpoint}/${target.id}`);
        showSuccess(`${label} Deleted`, `${target.name ?? label} moved to archive.`);
        onDone?.();
      } catch (err) {
        fail(err, 'Delete Failed');
      }
    },
    [endpoint, label, onDone, showSuccess, fail]
  );

  const restore = useCallback(
    async (target: ArchiveRowTarget) => {
      try {
        await apiClient.post(`${endpoint}/${target.id}/restore`);
        showSuccess(`${label} Restored`, `${target.name ?? label} is active again.`);
        onDone?.();
      } catch (err) {
        fail(err, 'Restore Failed');
      }
    },
    [endpoint, label, onDone, showSuccess, fail]
  );

  /** "Delete" inside the archive view. Irreversible, so it opens the confirm modal first. */
  const confirmPermanentDelete = useCallback((target: ArchiveRowTarget) => setPending(target), []);

  const runPermanentDelete = useCallback(async () => {
    if (!pending) return;
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
  }, [pending, endpoint, label, onDone, showSuccess, fail]);

  /**
   * Builds the action list for RowActionMenu. Always emits exactly one "Delete";
   * archived rows additionally get "Restore".
   */
  const rowActions = useCallback(
    (target: ArchiveRowTarget): RowAction[] => {
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
      }

      actions.push({
        label: 'Delete',
        icon: <Trash2 size={14} />,
        onClick: () =>
          target.isArchived ? confirmPermanentDelete(target) : void archive(target),
        variant: 'danger',
        disabled: target.disabled,
        dividerBefore: !target.isArchived,
      });

      return actions;
    },
    [archive, restore, confirmPermanentDelete]
  );

  /** Render this once per page so the confirm modal has a mount point. */
  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      onClose={() => setPending(null)}
      onConfirm={runPermanentDelete}
      itemName={pending?.name}
      busy={busy}
      tone="danger"
    />
  );

  return { rowActions, dialog, archive, restore, confirmPermanentDelete };
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
