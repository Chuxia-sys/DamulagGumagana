'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChartData {
  day?: string;
  count?: number;
  status?: string;
  value?: number;
  name?: string;
}

interface SchedulesChartProps {
  data: ChartData[];
  title: string;
  description?: string;
  type: 'bar' | 'pie' | 'line';
}

// Green gradient colors for charts
const GREEN_COLORS = [
  '#22c55e', // green-500
  '#16a34a', // green-600
  '#15803d', // green-700
  '#4ade80', // green-400
  '#86efac', // green-300
];

// Green gradient for dark mode
const GREEN_GRADIENT = {
  start: '#22c55e', // green-500
  end: '#15803d', // green-700
};

export function SchedulesChart({ data, title, description, type }: SchedulesChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <Card className="relative overflow-hidden border-0 shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-card via-card to-green-500/5 dark:to-green-500/10 pointer-events-none rounded-lg" />
        <div className="relative">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-500/10 dark:bg-green-500/20">
                {type === 'pie' ? (
                  <PieChartIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  <BarChart3 className="w-5 h-5 text-green-600 dark:text-green-400" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {type === 'bar' ? (
                  <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="greenBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GREEN_GRADIENT.start} stopOpacity={1} />
                        <stop offset="50%" stopColor="#16a34a" stopOpacity={0.8} />
                        <stop offset="100%" stopColor={GREEN_GRADIENT.end} stopOpacity={0.5} />
                      </linearGradient>
                      <linearGradient id="greenBarGradientDark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4ade80" stopOpacity={1} />
                        <stop offset="50%" stopColor="#22c55e" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#16a34a" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                        padding: '12px 16px',
                      }}
                      cursor={{ fill: 'rgba(34, 197, 94, 0.1)' }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="url(#greenBarGradient)" 
                      radius={[6, 6, 0, 0]} 
                      maxBarSize={50}
                      className="dark:[fill:url(#greenBarGradientDark)]"
                    />
                  </BarChart>
                ) : type === 'pie' ? (
                  <PieChart>
                    <defs>
                      {GREEN_COLORS.map((color, index) => (
                        <linearGradient key={`pieGradient-${index}`} id={`pieGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={1} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {data.map((_, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={`url(#pieGradient-${index % GREEN_COLORS.length})`}
                          stroke="transparent"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                      }}
                    />
                    <Legend />
                  </PieChart>
                ) : (
                  <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4ade80" stopOpacity={1} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#22c55e"
                      strokeWidth={3}
                      dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                      activeDot={{ fill: '#4ade80', strokeWidth: 2, r: 6 }}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
}
