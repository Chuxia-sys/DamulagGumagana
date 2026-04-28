'use client';

import { useState, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from './DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, RefreshCw, User, MapPin, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Conflict } from '@/types';

interface ConflictWithDetails extends Conflict {
  schedule1?: {
    id: string;
    subject?: { subjectName: string };
    faculty?: { name: string };
    room?: { roomName: string };
    section?: { sectionName: string };
    day: string;
    startTime: string;
    endTime: string;
  };
  schedule2?: {
    id: string;
    subject?: { subjectName: string };
    faculty?: { name: string };
    room?: { roomName: string };
    section?: { sectionName: string };
    day: string;
    startTime: string;
    endTime: string;
  } | null;
}

export function ConflictsView() {
  const [conflicts, setConflicts] = useState<ConflictWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConflict, setSelectedConflict] = useState<ConflictWithDetails | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);

  useEffect(() => {
    fetchConflicts();
  }, []);

  const fetchConflicts = async () => {
    try {
      const res = await fetch('/api/conflicts');
      const data = await res.json();
      setConflicts(data.conflicts || []);
    } catch (error) {
      console.error('Error fetching conflicts:', error);
      toast.error('Failed to load conflicts');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedConflict) return;

    try {
      const res = await fetch(`/api/conflicts/${selectedConflict.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolvedBy: 'current-user' }),
      });

      if (res.ok) {
        toast.success('Conflict marked as resolved');
        setResolveDialogOpen(false);
        fetchConflicts();
      } else {
        toast.error('Failed to resolve conflict');
      }
    } catch {
      toast.error('Failed to resolve conflict');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'faculty_double_booking':
        return <User className="h-4 w-4" />;
      case 'room_double_booking':
        return <MapPin className="h-4 w-4" />;
      case 'section_overlap':
        return <Users className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const columns: ColumnDef<ConflictWithDetails>[] = [
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const type = row.original.type;
        return (
          <div className="flex items-center gap-2">
            {getTypeIcon(type)}
            <span className="capitalize">{type.replace(/_/g, ' ')}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'severity',
      header: 'Severity',
      cell: ({ row }) => {
        const severity = row.original.severity;
        return (
          <Badge
            variant={severity === 'critical' ? 'destructive' : severity === 'warning' ? 'secondary' : 'outline'}
          >
            {severity || 'warning'}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <p className="text-sm text-muted-foreground max-w-md truncate">
          {row.original.description}
        </p>
      ),
    },
    {
      accessorKey: 'resolved',
      header: 'Status',
      cell: ({ row }) => {
        const resolved = row.original.resolved;
        return (
          <Badge variant={resolved ? 'default' : 'destructive'}>
            {resolved ? 'Resolved' : 'Active'}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const conflict = row.original;
        if (conflict.resolved) return null;
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedConflict(conflict);
              setResolveDialogOpen(true);
            }}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Resolve
          </Button>
        );
      },
    },
  ];

  const activeConflicts = conflicts.filter((c) => !c.resolved);
  const resolvedConflicts = conflicts.filter((c) => c.resolved);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertTriangle className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conflict Resolution</h1>
          <p className="text-muted-foreground">Detect and resolve scheduling conflicts</p>
        </div>
        <Button onClick={fetchConflicts} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Conflicts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{conflicts.length}</div>
          </CardContent>
        </Card>
        <Card className="border-destructive/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{activeConflicts.length}</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-500">{resolvedConflicts.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Conflicts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Active Conflicts
          </CardTitle>
          <CardDescription>Conflicts that require immediate attention</CardDescription>
        </CardHeader>
        <CardContent>
          {activeConflicts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
              <p className="font-medium text-lg">No Active Conflicts</p>
              <p className="text-muted-foreground">All schedules are conflict-free</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={activeConflicts}
              searchKey="description"
              searchPlaceholder="Search conflicts..."
            />
          )}
        </CardContent>
      </Card>

      {/* Resolved Conflicts */}
      {resolvedConflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Resolved Conflicts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={resolvedConflicts}
              searchKey="description"
              searchPlaceholder="Search resolved..."
            />
          </CardContent>
        </Card>
      )}

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Conflict</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark this conflict as resolved?
            </DialogDescription>
          </DialogHeader>
          {selectedConflict && (
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">
                {selectedConflict.description}
              </p>
              <p className="text-sm">
                <strong>Type:</strong> {selectedConflict.type.replace(/_/g, ' ')}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResolve}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark as Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
