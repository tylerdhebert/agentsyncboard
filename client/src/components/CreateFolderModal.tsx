import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requestJson } from '../api/client'
import { queryKeys } from '../api/keys'
import type { Folder } from '../api/types'

const SWATCHES = [
  '#7dd3fc',
  '#a78bfa',
  '#34d399',
  '#f59e0b',
  '#f87171',
  '#c084fc',
  '#fb923c',
  '#94a3b8',
]

const inputCls =
  'w-full rounded-md border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--dim)] transition focus:border-[var(--border-strong)] focus:bg-[rgba(255,255,255,0.06)]'

function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2">
      {SWATCHES.map(swatch => (
        <button
          key={swatch}
          type="button"
          onClick={() => onChange(swatch)}
          className="h-5 w-5 rounded-full transition hover:scale-110"
          style={{
            background: swatch,
            outline: value === swatch ? `2px solid ${swatch}` : 'none',
            outlineOffset: '2px',
          }}
        />
      ))}
    </div>
  )
}

function AddTab({ folders, onClose }: { folders: Folder[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [color, setColor] = useState(SWATCHES[0])
  const [parentFolderId, setParentFolderId] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      requestJson<Folder>('/folders', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          color,
          ...(parentFolderId ? { parentFolderId } : {}),
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.folders })
      onClose()
    },
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && name.trim()) {
        createMutation.mutate()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [name, createMutation])

  return (
    <div className="space-y-4 p-5">
      <div>
        <div className="mb-1 text-[11px] font-medium text-[var(--muted)]">Name</div>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Sprint 1"
          className={inputCls}
        />
      </div>

      <div>
        <div className="mb-2 text-[11px] font-medium text-[var(--muted)]">Color</div>
        <ColorSwatches value={color} onChange={setColor} />
      </div>

      {folders.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-medium text-[var(--muted)]">
            Parent folder <span className="text-[var(--dim)]">(optional)</span>
          </div>
          <select
            value={parentFolderId}
            onChange={e => setParentFolderId(e.target.value)}
            className={inputCls + ' cursor-pointer'}
          >
            <option value="">None (top level)</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-[11px] text-[var(--dim)]">⌘↵ to create</span>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
          >
            Cancel
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || createMutation.isPending}
            className="rounded-md bg-[var(--accent-strong)] px-3 py-1.5 text-[12px] font-medium text-[#0a0c11] transition hover:opacity-90 disabled:opacity-40"
          >
            {createMutation.isPending ? 'Creating…' : 'Create folder'}
          </button>
        </div>
      </div>
    </div>
  )
}

function isDescendantFolder(folderId: string, candidateParentId: string, folders: Folder[]): boolean {
  let current = folders.find(folder => folder.id === candidateParentId) ?? null

  while (current) {
    if (current.parentFolderId === folderId) {
      return true
    }
    current = current.parentFolderId
      ? (folders.find(folder => folder.id === current?.parentFolderId) ?? null)
      : null
  }

  return false
}

function FolderRow({ folder, folders }: { folder: Folder; folders: Folder[] }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(folder.name)
  const [color, setColor] = useState(folder.color ?? SWATCHES[0])
  const [parentFolderId, setParentFolderId] = useState(folder.parentFolderId ?? '')

  const updateMutation = useMutation({
    mutationFn: () =>
      requestJson<Folder>(`/folders/${folder.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), color, parentFolderId: parentFolderId || null }),
      }),
    onSuccess: async () => {
      setEditing(false)
      await queryClient.invalidateQueries({ queryKey: queryKeys.folders })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      requestJson<{ ok: boolean }>(`/folders/${folder.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders })
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs })
    },
  })

  const isDirty = name.trim() !== folder.name || color !== (folder.color ?? SWATCHES[0])
    || parentFolderId !== (folder.parentFolderId ?? '')

  const availableParents = folders.filter(candidate =>
    candidate.id !== folder.id && !isDescendantFolder(folder.id, candidate.id, folders),
  )

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[rgba(255,255,255,0.02)]">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span
          className="h-3 w-3 flex-shrink-0 rounded-sm"
          style={{ background: folder.color ?? SWATCHES[0] }}
        />
        <span className="flex-1 text-[13px] text-[var(--ink)]">{folder.name}</span>
        <button
          onClick={() => setEditing(v => !v)}
          className="rounded px-2 py-0.5 text-[11px] text-[var(--dim)] transition hover:bg-white/5 hover:text-[var(--ink)]"
        >
          {editing ? 'cancel' : 'edit'}
        </button>
        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="rounded px-2 py-0.5 text-[11px] text-rose-400/60 transition hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-40"
        >
          delete
        </button>
      </div>

      {editing && (
        <div className="border-t border-[var(--border)] px-3 pb-3 pt-3 space-y-3">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            className={inputCls}
            placeholder="Folder name"
          />
          <ColorSwatches value={color} onChange={setColor} />
          <div>
            <div className="mb-1 text-[11px] font-medium text-[var(--muted)]">
              Parent folder <span className="text-[var(--dim)]">(optional)</span>
            </div>
            <select
              value={parentFolderId}
              onChange={e => setParentFolderId(e.target.value)}
              className={inputCls + ' cursor-pointer'}
            >
              <option value="">None (top level)</option>
              {availableParents.map(candidate => (
                <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => updateMutation.mutate()}
              disabled={!isDirty || !name.trim() || updateMutation.isPending}
              className="rounded-md bg-[var(--accent-strong)] px-3 py-1.5 text-[12px] font-medium text-[#0a0c11] transition hover:opacity-90 disabled:opacity-40"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ManageTab({ folders, onClose }: { folders: Folder[]; onClose: () => void }) {
  if (folders.length === 0) {
    return (
      <div className="p-5">
        <div className="rounded-lg border border-dashed border-[var(--border)] px-4 py-8 text-center text-[13px] text-[var(--dim)]">
          No folders yet. Switch to Add to create one.
        </div>
      </div>
    )
  }

  return (
      <div className="p-5 space-y-2">
      {folders.map(folder => (
        <FolderRow key={folder.id} folder={folder} folders={folders} />
      ))}
      <div className="flex justify-end pt-1">
        <button
          onClick={onClose}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
        >
          Done
        </button>
      </div>
    </div>
  )
}

export function CreateFolderModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'add' | 'manage'>('add')

  const { data: folders = [] } = useQuery<Folder[]>({
    queryKey: queryKeys.folders,
    queryFn: () => requestJson<Folder[]>('/folders'),
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center p-4"
      style={{ background: 'rgba(5, 7, 12, 0.82)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-[var(--border-strong)] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        style={{ background: '#111520' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header with tabs */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5">
          <div className="flex items-end gap-0">
            {(['add', 'manage'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  '-mb-px border-b-2 px-3 py-3 text-[13px] font-medium capitalize transition',
                  tab === t
                    ? 'border-[var(--accent)] text-[var(--ink)]'
                    : 'border-transparent text-[var(--dim)] hover:text-[var(--muted)]',
                ].join(' ')}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--dim)] transition hover:bg-white/6 hover:text-[var(--ink)]"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>

        {/* Fixed-height body so the modal doesn't jump when edit rows expand */}
        <div className="h-[340px] overflow-y-auto">
          {tab === 'add'
            ? <AddTab folders={folders} onClose={onClose} />
            : <ManageTab folders={folders} onClose={onClose} />
          }
        </div>
      </div>
    </div>
  )
}
