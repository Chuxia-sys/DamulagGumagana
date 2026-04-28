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
import { toast } from 'sonner';
import { Plus, MoreHorizontal, Pencil, Trash2, DoorOpen, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Room } from '@/types';

export function RoomsView() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      const data = await res.json();
      setRooms(data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedRoom(null);
    setFormData({
      roomName: '',
      roomCode: '',
      capacity: 40,
      equipment: [],
      building: '',
      floor: 1,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleEdit = (room: Room) => {
    setSelectedRoom(room);
    setFormData({
      roomName: room.roomName,
      roomCode: room.roomCode || '',
      capacity: room.capacity,
      equipment: room.equipment,
      building: room.building,
      floor: room.floor,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleDelete = (room: Room) => {
    setSelectedRoom(room);
    setDeleteDialogOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.roomName || (formData.roomName as string).trim() === '') {
      errors.roomName = 'Room name is required';
    }

    if (!formData.capacity || (formData.capacity as number) < 1) {
      errors.capacity = 'Capacity must be at least 1';
    }

    if (!formData.building || (formData.building as string).trim() === '') {
      errors.building = 'Building is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const url = selectedRoom ? `/api/rooms/${selectedRoom.id}` : '/api/rooms';
      const method = selectedRoom ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success(selectedRoom ? 'Room updated' : 'Room created');
        setDialogOpen(false);
        fetchRooms();
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
    if (!selectedRoom) return;

    try {
      const res = await fetch(`/api/rooms/${selectedRoom.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Room deleted');
        setDeleteDialogOpen(false);
        fetchRooms();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Delete failed');
      }
    } catch {
      toast.error('Delete failed');
    }
  };

  const columns: ColumnDef<Room>[] = [
    {
      accessorKey: 'roomName',
      header: 'Room Name',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.roomName}</p>
          {row.original.roomCode && (
            <p className="text-xs text-muted-foreground">{row.original.roomCode}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'building',
      header: 'Building',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span>{row.original.building}</span>
        </div>
      ),
    },
    {
      accessorKey: 'capacity',
      header: 'Capacity',
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.capacity} seats</Badge>
      ),
    },
    {
      accessorKey: 'equipment',
      header: 'Equipment',
      cell: ({ row }) => {
        const equipment = row.original.equipment;
        if (!equipment || equipment.length === 0) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {equipment.slice(0, 3).map((eq, i) => (
              <Badge key={i} variant="outline" className="text-xs">{eq}</Badge>
            ))}
            {equipment.length > 3 && (
              <Badge variant="outline" className="text-xs">+{equipment.length - 3}</Badge>
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const room = row.original;
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
              <DropdownMenuItem onClick={() => handleEdit(room)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(room)}>
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
        <DoorOpen className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rooms</h1>
          <p className="text-muted-foreground">Manage classrooms and facilities</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Room
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={rooms}
            searchKey="roomName"
            searchPlaceholder="Search rooms..."
          />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedRoom ? 'Edit Room' : 'Add New Room'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Name *</Label>
              <div className="col-span-3 space-y-1">
                <Input
                  value={formData.roomName as string || ''}
                  onChange={(e) => setFormData({ ...formData, roomName: e.target.value })}
                  className={formErrors.roomName ? 'border-destructive' : ''}
                />
                {formErrors.roomName && <p className="text-xs text-destructive">{formErrors.roomName}</p>}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Building *</Label>
              <div className="col-span-3 space-y-1">
                <Input
                  value={formData.building as string || ''}
                  onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                  className={formErrors.building ? 'border-destructive' : ''}
                />
                {formErrors.building && <p className="text-xs text-destructive">{formErrors.building}</p>}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Capacity *</Label>
              <div className="col-span-3 space-y-1">
                <Input
                  type="number"
                  value={formData.capacity as number || 40}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                  className={formErrors.capacity ? 'border-destructive' : ''}
                />
                {formErrors.capacity && <p className="text-xs text-destructive">{formErrors.capacity}</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : selectedRoom ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Room</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete {selectedRoom?.roomName}?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
