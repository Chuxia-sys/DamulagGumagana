'use client';

import { useState, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from './DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
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
import { Plus, MoreHorizontal, Pencil, Trash2, GraduationCap, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Section, Department } from '@/types';

export function SectionsView() {
  const [sections, setSections] = useState<Section[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sectionsRes, deptsRes] = await Promise.all([
        fetch('/api/sections'),
        fetch('/api/departments'),
      ]);

      const sectionsData = await sectionsRes.json();
      const deptsData = await deptsRes.json();

      setSections(sectionsData);
      setDepartments(deptsData);
    } catch (error) {
      console.error('Error fetching sections:', error);
      toast.error('Failed to load sections');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedSection(null);
    setFormData({
      sectionName: '',
      sectionCode: '',
      yearLevel: 1,
      departmentId: '',
      studentCount: 40,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleEdit = (section: Section) => {
    setSelectedSection(section);
    setFormData({
      sectionName: section.sectionName,
      sectionCode: section.sectionCode || '',
      yearLevel: section.yearLevel,
      departmentId: section.departmentId,
      studentCount: section.studentCount,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleDelete = (section: Section) => {
    setSelectedSection(section);
    setDeleteDialogOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.sectionName || (formData.sectionName as string).trim() === '') {
      errors.sectionName = 'Section name is required';
    }

    if (!formData.yearLevel || (formData.yearLevel as number) < 1 || (formData.yearLevel as number) > 5) {
      errors.yearLevel = 'Year level must be between 1 and 5';
    }

    if (!formData.departmentId) {
      errors.departmentId = 'Department is required';
    }

    if (!formData.studentCount || (formData.studentCount as number) < 1) {
      errors.studentCount = 'Student count must be at least 1';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const url = selectedSection ? `/api/sections/${selectedSection.id}` : '/api/sections';
      const method = selectedSection ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success(selectedSection ? 'Section updated' : 'Section created');
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

  const confirmDelete = async () => {
    if (!selectedSection) return;

    try {
      const res = await fetch(`/api/sections/${selectedSection.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Section deleted');
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

  const columns: ColumnDef<Section>[] = [
    {
      accessorKey: 'sectionName',
      header: 'Section Name',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.sectionName}</p>
          {row.original.sectionCode && (
            <p className="text-xs text-muted-foreground">{row.original.sectionCode}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'yearLevel',
      header: 'Year Level',
      cell: ({ row }) => (
        <Badge variant="outline">Year {row.original.yearLevel}</Badge>
      ),
    },
    {
      accessorKey: 'department',
      header: 'Department',
      cell: ({ row }) => {
        const dept = row.original.department;
        return dept ? (
          <Badge variant="secondary">{dept.name}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      accessorKey: 'studentCount',
      header: 'Students',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>{row.original.studentCount}</span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const section = row.original;
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
              <DropdownMenuItem onClick={() => handleEdit(section)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(section)}>
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
        <GraduationCap className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sections</h1>
          <p className="text-muted-foreground">Manage student sections and cohorts</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Section
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={sections}
            searchKey="sectionName"
            searchPlaceholder="Search sections..."
          />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedSection ? 'Edit Section' : 'Add New Section'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Name *</Label>
              <div className="col-span-3 space-y-1">
                <Input
                  value={formData.sectionName as string || ''}
                  onChange={(e) => setFormData({ ...formData, sectionName: e.target.value })}
                  className={formErrors.sectionName ? 'border-destructive' : ''}
                />
                {formErrors.sectionName && <p className="text-xs text-destructive">{formErrors.sectionName}</p>}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Year Level *</Label>
              <div className="col-span-3 space-y-1">
                <Select
                  value={String(formData.yearLevel || 1)}
                  onValueChange={(value) => setFormData({ ...formData, yearLevel: parseInt(value) })}
                >
                  <SelectTrigger className={formErrors.yearLevel ? 'border-destructive' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((year) => (
                      <SelectItem key={year} value={String(year)}>Year {year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.yearLevel && <p className="text-xs text-destructive">{formErrors.yearLevel}</p>}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Department *</Label>
              <div className="col-span-3 space-y-1">
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
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Students *</Label>
              <div className="col-span-3 space-y-1">
                <Input
                  type="number"
                  value={formData.studentCount as number || 40}
                  onChange={(e) => setFormData({ ...formData, studentCount: parseInt(e.target.value) })}
                  className={formErrors.studentCount ? 'border-destructive' : ''}
                />
                {formErrors.studentCount && <p className="text-xs text-destructive">{formErrors.studentCount}</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : selectedSection ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Section</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete {selectedSection?.sectionName}?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
