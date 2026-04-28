'use client';

import { useState, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from './DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Users,
  Mail,
  Phone,
  Building2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { User, Department, Schedule } from '@/types';

export function FacultyView() {
  const [faculty, setFaculty] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, deptsRes, schedulesRes] = await Promise.all([
        fetch('/api/users?role=faculty'),
        fetch('/api/departments'),
        fetch('/api/schedules'),
      ]);

      const usersData = await usersRes.json();
      const deptsData = await deptsRes.json();
      const schedulesData = await schedulesRes.json();

      setFaculty(usersData);
      setDepartments(deptsData);
      setSchedules(schedulesData);
    } catch (error) {
      console.error('Error fetching faculty:', error);
      toast.error('Failed to load faculty data');
    } finally {
      setLoading(false);
    }
  };

  const getFacultyLoad = (facultyId: string) => {
    return schedules
      .filter((s) => s.facultyId === facultyId)
      .reduce((sum, s) => sum + (s.subject?.units || 0), 0);
  };

  const handleCreate = () => {
    setSelectedFaculty(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'faculty',
      contractType: 'full-time',
      maxUnits: 24,
      departmentId: '',
      specialization: [],
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleEdit = (user: User) => {
    setSelectedFaculty(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      contractType: user.contractType,
      maxUnits: user.maxUnits,
      departmentId: user.departmentId || '',
      specialization: user.specialization,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.name || (formData.name as string).trim() === '') {
      errors.name = 'Name is required';
    }
    
    if (!formData.email || (formData.email as string).trim() === '') {
      errors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email as string)) {
        errors.email = 'Please enter a valid email address';
      }
    }
    
    if (!selectedFaculty) {
      if (!formData.password || (formData.password as string).length < 6) {
        errors.password = 'Password must be at least 6 characters';
      }
    }
    
    if (!formData.departmentId) {
      errors.departmentId = 'Department is required';
    }
    
    if (!formData.maxUnits || (formData.maxUnits as number) < 1) {
      errors.maxUnits = 'Max units must be at least 1';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setSaving(true);
    try {
      const url = selectedFaculty ? `/api/users/${selectedFaculty.id}` : '/api/users';
      const method = selectedFaculty ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success(selectedFaculty ? 'Faculty updated successfully' : 'Faculty created successfully');
        setDialogOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Operation failed');
      }
    } catch {
      toast.error('Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (user: User) => {
    setSelectedFaculty(user);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedFaculty) return;

    try {
      const res = await fetch(`/api/users/${selectedFaculty.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Faculty deleted successfully');
        setDeleteDialogOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Delete failed');
      }
    } catch {
      toast.error('Delete failed');
    }
  };

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.image || ''} />
              <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'department',
      header: 'Department',
      cell: ({ row }) => {
        const dept = row.original.department;
        return dept ? (
          <Badge variant="secondary">{dept.name}</Badge>
        ) : (
          <span className="text-muted-foreground">Unassigned</span>
        );
      },
    },
    {
      accessorKey: 'contractType',
      header: 'Contract',
      cell: ({ row }) => (
        <Badge variant={row.original.contractType === 'full-time' ? 'default' : 'outline'}>
          {row.original.contractType}
        </Badge>
      ),
    },
    {
      id: 'load',
      header: 'Load',
      cell: ({ row }) => {
        const user = row.original;
        const load = getFacultyLoad(user.id);
        const maxUnits = user.maxUnits || 24;
        const percentage = Math.round((load / maxUnits) * 100);
        const isOverloaded = load > maxUnits;

        return (
          <div className="w-32">
            <div className="flex justify-between text-xs mb-1">
              <span>{load}/{maxUnits} units</span>
              <span className={isOverloaded ? 'text-red-500' : ''}>{percentage}%</span>
            </div>
            <Progress
              value={Math.min(percentage, 100)}
              className={`h-1.5 ${isOverloaded ? '[&>div]:bg-red-500' : ''}`}
            />
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const user = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleEdit(user)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(user)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Users className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Faculty Management</h1>
          <p className="text-muted-foreground">Manage faculty members and teaching loads</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Faculty
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{faculty.length}</div>
            <p className="text-sm text-muted-foreground">Total Faculty</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {faculty.filter((f) => f.contractType === 'full-time').length}
            </div>
            <p className="text-sm text-muted-foreground">Full-time</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {faculty.filter((f) => f.contractType === 'part-time').length}
            </div>
            <p className="text-sm text-muted-foreground">Part-time</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {faculty.filter((f) => getFacultyLoad(f.id) > f.maxUnits).length}
            </div>
            <p className="text-sm text-muted-foreground">Overloaded</p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={faculty}
            searchKey="name"
            searchPlaceholder="Search faculty..."
            mobileCardRender={(user) => (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.image || ''} />
                      <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(user)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(user)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{user.department?.name || 'Unassigned'}</Badge>
                  <Badge variant={user.contractType === 'full-time' ? 'default' : 'outline'}>
                    {user.contractType}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Load: {getFacultyLoad(user.id)}/{user.maxUnits || 24} units</span>
                    <span>{Math.round((getFacultyLoad(user.id) / (user.maxUnits || 24)) * 100)}%</span>
                  </div>
                  <Progress value={Math.min((getFacultyLoad(user.id) / (user.maxUnits || 24)) * 100, 100)} className="h-1.5" />
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedFaculty ? 'Edit Faculty' : 'Add New Faculty'}</DialogTitle>
            <DialogDescription>
              {selectedFaculty
                ? 'Update faculty information'
                : 'Fill in the details to add a new faculty member'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name as string || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter faculty name"
                className={formErrors.name ? 'border-destructive' : ''}
              />
              {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email as string || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email address"
                className={formErrors.email ? 'border-destructive' : ''}
              />
              {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
            </div>
            {!selectedFaculty && (
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password as string || ''}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password (min 6 characters)"
                  className={formErrors.password ? 'border-destructive' : ''}
                />
                {formErrors.password && <p className="text-xs text-destructive">{formErrors.password}</p>}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Select
                  value={formData.departmentId as string || ''}
                  onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                >
                  <SelectTrigger className={formErrors.departmentId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.departmentId && <p className="text-xs text-destructive">{formErrors.departmentId}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractType">Contract</Label>
                <Select
                  value={formData.contractType as string || 'full-time'}
                  onValueChange={(value) => setFormData({ ...formData, contractType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxUnits">Max Units *</Label>
              <Input
                id="maxUnits"
                type="number"
                value={formData.maxUnits as number || 24}
                onChange={(e) => setFormData({ ...formData, maxUnits: parseInt(e.target.value) || 24 })}
                className={formErrors.maxUnits ? 'border-destructive' : ''}
              />
              {formErrors.maxUnits && <p className="text-xs text-destructive">{formErrors.maxUnits}</p>}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} className="w-full sm:w-auto">
              {saving ? 'Saving...' : selectedFaculty ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Faculty</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedFaculty?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
