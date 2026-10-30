import React, { useEffect, useState } from 'react';
import { KeyRound, Pencil, RefreshCw, ShieldCheck, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const emptyCreateForm = { username: '', name: '', email: '', password: '', role: 'user' as 'user' | 'admin' };
const emptyEditForm = { username: '', name: '', email: '', role: 'user' as 'user' | 'admin', isActive: true };

type ManagedUser = {
  id: number;
  username: string | null;
  name: string | null;
  email: string | null;
  role: 'user' | 'admin';
  isActive: boolean;
  loginMethod: string | null;
  lastSignedIn: Date | null;
};

export default function AdminUsers() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [passwordUser, setPasswordUser] = useState<ManagedUser | null>(null);
  const [password, setPassword] = useState('');
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<ManagedUser | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) setLocation('/login');
    else if (!loading && user?.role !== 'admin') setLocation('/');
  }, [loading, user, setLocation]);

  const utils = trpc.useUtils();
  const usersQuery = trpc.admin.users.list.useQuery(undefined, { enabled: user?.role === 'admin' });
  const createMutation = trpc.admin.users.create.useMutation({
    onSuccess: () => {
      setCreateForm(emptyCreateForm);
      toast.success('User account created');
      utils.admin.users.list.invalidate();
    },
    onError: (error) => toast.error(error.message || 'Could not create user'),
  });
  const updateMutation = trpc.admin.users.update.useMutation({
    onSuccess: () => {
      setEditingUser(null);
      toast.success('User account updated');
      utils.admin.users.list.invalidate();
    },
    onError: (error) => toast.error(error.message || 'Could not update user'),
  });
  const changePasswordMutation = trpc.admin.users.changePassword.useMutation({
    onSuccess: () => {
      setPassword('');
      setPasswordUser(null);
      toast.success('Password changed');
      utils.admin.users.list.invalidate();
    },
    onError: (error) => toast.error(error.message || 'Could not change password'),
  });
  const resetPasswordMutation = trpc.admin.users.resetPassword.useMutation({
    onSuccess: (result) => {
      setResetUser(null);
      setTemporaryPassword(result.temporaryPassword);
      toast.success('Temporary password generated');
      utils.admin.users.list.invalidate();
    },
    onError: (error) => toast.error(error.message || 'Could not reset password'),
  });
  const deleteMutation = trpc.admin.users.delete.useMutation({
    onSuccess: () => {
      setDeleteUser(null);
      toast.success('User account deleted');
      utils.admin.users.list.invalidate();
    },
    onError: (error) => toast.error(error.message || 'Could not delete user'),
  });

  if (loading || !user || user.role !== 'admin') return null;

  const managedUsers = (usersQuery.data || []) as ManagedUser[];

  const submitCreate = (event: React.FormEvent) => {
    event.preventDefault();
    createMutation.mutate(createForm);
  };

  const openEdit = (managedUser: ManagedUser) => {
    setEditingUser(managedUser);
    setEditForm({
      username: managedUser.username || '',
      name: managedUser.name || '',
      email: managedUser.email || '',
      role: managedUser.role,
      isActive: managedUser.isActive,
    });
  };

  const submitEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;
    updateMutation.mutate({
      id: editingUser.id,
      username: editForm.username,
      name: editForm.name,
      email: editForm.email,
      role: editForm.role,
      isActive: editForm.isActive,
    });
  };

  const submitPasswordChange = (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordUser) return;
    changePasswordMutation.mutate({ id: passwordUser.id, password });
  };

  return (
    <div className="space-y-7">
      <div>
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#5367f2]">Administration</p>
        <h1 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">User management</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Create accounts, update access, change passwords, and remove former team members.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="soft-panel overflow-hidden rounded-2xl border-0 bg-white dark:bg-card">
          <CardHeader className="border-b border-border/70 bg-[#fafaff] px-6 py-5 dark:bg-white/[0.03]">
            <CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-blue-600" />Personnel accounts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {usersQuery.isLoading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading users…</div> : usersQuery.error ? <div className="p-8 text-center text-sm text-destructive">Unable to load users. Refresh and try again.</div> : (
              <div className="divide-y">
                {managedUsers.map((managedUser) => (
                  <div key={managedUser.id} className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{managedUser.name || managedUser.username || 'Unnamed user'}</p>
                        <Badge variant={managedUser.role === 'admin' ? 'default' : 'secondary'}>{managedUser.role === 'admin' ? 'Admin' : 'IT Personnel'}</Badge>
                        <Badge variant={managedUser.isActive ? 'outline' : 'destructive'}>{managedUser.isActive ? 'Active' : 'Inactive'}</Badge>
                        {managedUser.loginMethod === 'password' && <Badge variant="outline">Local login</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">@{managedUser.username || 'OAuth account'}{managedUser.email ? ` · ${managedUser.email}` : ''}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Last sign-in: {managedUser.lastSignedIn ? new Date(managedUser.lastSignedIn).toLocaleString() : 'Never'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-[#fafaff] px-2.5 py-1.5 dark:bg-white/[0.03]"><span className="text-xs font-medium text-muted-foreground">Active</span><Switch checked={managedUser.isActive} disabled={managedUser.id === user.id || updateMutation.isPending} onCheckedChange={(checked) => updateMutation.mutate({ id: managedUser.id, isActive: checked })} /></div>
                      <select aria-label={`Role for ${managedUser.username || managedUser.name || managedUser.id}`} value={managedUser.role} disabled={managedUser.id === user.id || updateMutation.isPending} onChange={(event) => updateMutation.mutate({ id: managedUser.id, role: event.target.value as 'user' | 'admin' })} className="h-9 rounded-xl border border-input bg-background px-2 text-sm"><option value="user">IT Personnel</option><option value="admin">Admin</option></select>
                      <Button variant="outline" size="sm" onClick={() => openEdit(managedUser)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>
                      <Button variant="outline" size="sm" onClick={() => { setPasswordUser(managedUser); setPassword(''); }}><KeyRound className="mr-1.5 h-3.5 w-3.5" />Change pass</Button>
                      <Button variant="outline" size="sm" disabled={resetPasswordMutation.isPending} onClick={() => setResetUser(managedUser)}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Reset</Button>
                      <Button variant="outline" size="sm" disabled={managedUser.id === user.id} onClick={() => setDeleteUser(managedUser)} className="text-destructive hover:text-destructive"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button>
                    </div>
                  </div>
                ))}
                {managedUsers.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No accounts have been created yet.</div>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="soft-panel rounded-2xl border-0 bg-white dark:bg-card">
          <CardHeader className="border-b border-border/70 bg-[#eef0ff] px-6 py-5 dark:border-[#3c4472] dark:bg-[#2b3155]"><CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/70 text-[#5367f2] dark:bg-white/10 dark:text-[#cdd3ff]"><UserPlus className="h-4 w-4" /></span>Create account</CardTitle></CardHeader>
          <CardContent className="pt-6"><form onSubmit={submitCreate} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="personnel-username">Username</Label><Input id="personnel-username" value={createForm.username} onChange={(event) => setCreateForm({ ...createForm, username: event.target.value })} placeholder="alex.it" /></div>
            <div className="space-y-2"><Label htmlFor="personnel-name">Full name</Label><Input id="personnel-name" value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} placeholder="Alex Rivera" /></div>
            <div className="space-y-2"><Label htmlFor="personnel-email">Email <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="personnel-email" type="email" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} placeholder="alex@example.com" /></div>
            <div className="space-y-2"><Label htmlFor="personnel-password">Temporary password</Label><Input id="personnel-password" type="password" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} placeholder="At least 8 characters" /></div>
            <div className="space-y-2"><Label htmlFor="personnel-role">Role</Label><select id="personnel-role" value={createForm.role} onChange={(event) => setCreateForm({ ...createForm, role: event.target.value as 'user' | 'admin' })} className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"><option value="user">IT Personnel</option><option value="admin">Administrator</option></select></div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating account…' : 'Create account'}</Button>
          </form></CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit user account</DialogTitle><DialogDescription>Update identity details, role, or access status. Password changes are handled separately.</DialogDescription></DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="edit-username">Username</Label><Input id="edit-username" value={editForm.username} onChange={(event) => setEditForm({ ...editForm, username: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="edit-name">Full name</Label><Input id="edit-name" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="edit-email">Email</Label><Input id="edit-email" type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="edit-role">Role</Label><select id="edit-role" value={editForm.role} onChange={(event) => setEditForm({ ...editForm, role: event.target.value as 'user' | 'admin' })} className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"><option value="user">IT Personnel</option><option value="admin">Administrator</option></select></div>
            <div className="flex items-center justify-between rounded-md border p-3"><div><Label htmlFor="edit-active">Account active</Label><p className="text-xs text-muted-foreground">Inactive users cannot sign in or use existing sessions.</p></div><Switch id="edit-active" checked={editForm.isActive} onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button><Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving…' : 'Save changes'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(passwordUser)} onOpenChange={(open) => { if (!open) { setPasswordUser(null); setPassword(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change password</DialogTitle><DialogDescription>Set a new password for {passwordUser?.username || passwordUser?.name || 'this user'}. The password is never shown in audit history.</DialogDescription></DialogHeader>
          <form onSubmit={submitPasswordChange} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="change-password">New password</Label><Input id="change-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setPasswordUser(null)}>Cancel</Button><Button type="submit" disabled={changePasswordMutation.isPending}>{changePasswordMutation.isPending ? 'Changing…' : 'Change password'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(resetUser)} onOpenChange={(open) => !open && setResetUser(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reset this password?</AlertDialogTitle><AlertDialogDescription>A new temporary password will replace the current password for {resetUser?.username || resetUser?.name || 'this user'}. The user will be required to choose a new private password at their next sign-in.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => resetUser && resetPasswordMutation.mutate({ id: resetUser.id })} disabled={resetPasswordMutation.isPending}>{resetPasswordMutation.isPending ? 'Resetting…' : 'Generate temporary password'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deleteUser)} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this user?</AlertDialogTitle><AlertDialogDescription>This permanently removes {deleteUser?.username || deleteUser?.name || 'the account'}. Their historical audit events remain, but the account cannot be restored.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteUser && deleteMutation.mutate({ id: deleteUser.id })} disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleteMutation.isPending ? 'Deleting…' : 'Delete account'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(temporaryPassword)} onOpenChange={(open) => !open && setTemporaryPassword(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Temporary password generated</DialogTitle><DialogDescription>Share this one-time password securely with the user. They must choose a new password at their next sign-in, and this value will not be shown again after closing the dialog.</DialogDescription></DialogHeader>
          <div className="rounded-md border bg-muted/50 p-4 font-mono text-lg tracking-wider">{temporaryPassword}</div>
          <DialogFooter><Button variant="outline" onClick={() => { if (temporaryPassword) navigator.clipboard?.writeText(temporaryPassword); toast.success('Temporary password copied'); }}>Copy password</Button><Button onClick={() => setTemporaryPassword(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
