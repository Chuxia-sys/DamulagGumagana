'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}: StatsCardProps) {
  const variantStyles = {
    default: 'from-card via-card to-primary/5',
    success: 'from-card via-card to-emerald-500/5',
    warning: 'from-card via-card to-amber-500/5',
    danger: 'from-card via-card to-red-500/5',
  };

  const iconStyles = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-500',
    warning: 'bg-amber-500/10 text-amber-500',
    danger: 'bg-red-500/10 text-red-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn('relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300', className)}>
        <div className={cn('absolute inset-0 bg-gradient-to-br pointer-events-none rounded-lg', variantStyles[variant])} />
        <div className="relative">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            <div className={cn('flex items-center justify-center w-8 h-8 rounded-lg', iconStyles[variant])}>
              <Icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                <div className={cn(
                  'flex items-center gap-0.5 text-xs font-medium',
                  trend.positive ? 'text-emerald-500' : 'text-red-500'
                )}>
                  {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
                </div>
                <span className="text-xs text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
}
